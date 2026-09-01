import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isManualBrandLogoUrl } from "@/lib/brand-logo-manual";
import { getObject, putObject } from "@/lib/server/storage";
import { TELEGRAM_BRAND_CHANNELS } from "@/lib/telegram-brand-channels";

const UA = { "user-agent": "Mozilla/5.0 Chrome/126 Safari/537.36" };

const DOMAIN_OVERRIDES: Record<string, string> = {
  jojobet: "jojobet.com",
  matbet: "matbet.com",
  holiganbet: "holiganbet.com",
  casibom: "casibom.com",
  meritking: "mrking.com",
  grandpashabet: "grandpashabet.com",
  marsbahis: "marsbahis.com",
  kazansana: "kazansana.com",
  bovbet: "bovbet.com",
  bahsine: "bahsine.com",
  betnano: "betnano.com",
  tekelbet: "tekelbet.net",
  trendyol: "trendyol.com",
  hepsiburada: "hepsiburada.com",
};

const BAD = ["ui-avatars.com", "unavatar.io", "placeholder", "logo.clearbit.com", "superbonus14.pro"];

export type ResolvedLogo = { buf: Buffer; type: string; src: string };

function isBadUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  const u = url.toLowerCase();
  if (u.includes("google.com/s2/favicons") || u.includes("gstatic.com/favicon")) return true;
  return BAD.some((p) => u.includes(p));
}

function storageKeyFromUrl(url: string): string | null {
  const m = url.match(/^\/api\/files\/(.+)$/);
  return m?.[1] ?? null;
}

function domainFor(slug: string, website: string | null): string {
  if (DOMAIN_OVERRIDES[slug]) return DOMAIN_OVERRIDES[slug];
  if (website) {
    let d = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    d = d.split("/")[0].split("?")[0];
    if (d.includes(".")) return d;
  }
  return `${slug.replace(/-/g, "")}.com`;
}

async function download(url: string, minBytes = 800): Promise<ResolvedLogo | null> {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("image") && !url.endsWith(".ico")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < minBytes) return null;
    return { buf, type: ct.split(";")[0] || "image/png", src: "fetch" };
  } catch {
    return null;
  }
}

async function fetchTelegram(slug: string): Promise<ResolvedLogo | null> {
  const channel = TELEGRAM_BRAND_CHANNELS[slug];
  if (!channel) return null;
  try {
    const r = await fetch(`https://t.me/${channel}`, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/tgme_page_photo_image[^>]+src="([^"]+)"/i);
    if (!m) return null;
    const src = m[1].replace(/&amp;/g, "&");
    if (src.startsWith("data:")) return null;
    const hit = await download(src, 1000);
    return hit ? { ...hit, src: "telegram" } : null;
  } catch {
    return null;
  }
}

async function fetchSiteIcon(domain: string): Promise<ResolvedLogo | null> {
  for (const path of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
    const hit = await download(`https://${domain}${path}`, 1200);
    if (hit) return { ...hit, src: "site" };
  }
  return null;
}

async function fetchBest(slug: string, website: string | null): Promise<ResolvedLogo | null> {
  const dom = domainFor(slug, website);
  return (
    (await fetchTelegram(slug)) ??
    (await fetchSiteIcon(dom)) ??
    (await download(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${dom}`)}&size=256`,
      400,
    ))
  );
}

/** Depolanmış logo dosyasını döner; yoksa çözümler, kaydeder, DB günceller. */
export async function resolveBrandLogo(slug: string): Promise<{ buf: Buffer; type: string; logoUrl: string } | null> {
  const [brand] = await db
    .select({
      id: schema.brands.id,
      logoUrl: schema.brands.logoUrl,
      website: schema.brands.website,
    })
    .from(schema.brands)
    .where(eq(schema.brands.slug, slug))
    .limit(1);
  if (!brand) return null;

  const current = brand.logoUrl?.trim() ?? "";

  // Manuel yüklenen logo asla otomatik çözümleyici ile ezilmez.
  if (isManualBrandLogoUrl(current)) {
    const key = storageKeyFromUrl(current);
    if (key) {
      try {
        const obj = await getObject(key);
        if (obj.Body) {
          const buf = Buffer.from(await obj.Body.transformToByteArray());
          if (buf.length > 0) {
            return { buf, type: obj.ContentType || "image/png", logoUrl: current };
          }
        }
      } catch {
        /* dosya geçici olarak okunamadı — DB'yi değiştirme */
      }
    }
    return null;
  }

  if (!isBadUrl(current) && current.startsWith("/api/files/")) {
    const key = storageKeyFromUrl(current);
    if (key) {
      try {
        const obj = await getObject(key);
        if (obj.Body) {
          const buf = Buffer.from(await obj.Body.transformToByteArray());
          if (buf.length >= 400) {
            return { buf, type: obj.ContentType || "image/png", logoUrl: current };
          }
        }
      } catch {
        /* yeniden çöz */
      }
    }
  }

  const resolved = await fetchBest(slug, brand.website);
  if (!resolved) return null;

  const key = `brand-logos/seed/${slug}.png`;
  await putObject(key, resolved.buf, resolved.type);
  const logoUrl = `/api/files/${key}`;
  await db
    .update(schema.brands)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(schema.brands.id, brand.id));

  return { buf: resolved.buf, type: resolved.type, logoUrl };
}
