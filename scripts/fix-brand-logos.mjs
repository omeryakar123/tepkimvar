#!/usr/bin/env bun
/**
 * Tüm marka logolarını yüksek çözünürlüğe yükseltir.
 * Öncelik: yerel static → superbonus PNG → site ikonu → gstatic 256
 * S3 varsa MinIO'ya yükler (/api/files/brand-logos/seed/<slug>-hq.png).
 *
 *   bun scripts/fix-brand-logos.mjs --all --force
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTelegramLogo } from "./lib/telegram-logo.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

const STATIC_BRANDS = {};

const FAVICON_PROXY = ["google.com/s2/favicons", "gstatic.com/favicon", "duckduckgo.com/ip3"];
const BAD = [
  "ui-avatars.com",
  "unavatar.io",
  "logo.clearbit.com",
  "via.placeholder",
  "porkbun-logo",
  "googleusercontent.com/a/default",
];
const GAMBLING_RE = /bet|bahis|casino|slot|poker|rulet|kumar|gambling/i;

const DOMAIN_OVERRIDES = {
  jojobet: "jojobet.com",
  matbet: "matbet.com",
  mavibet: "mavibet.com",
  holiganbet: "holiganbet.com",
  casibom: "casibom.com",
  meritking: "mrking.com",
  mrking: "mrking.com",
  grandpashabet: "grandpashabet.com",
  marsbahis: "marsbahis.com",
  kazansana: "kazansana.com",
  bovbet: "bovbet.com",
  bahsine: "bahsine.com",
  betnano: "betnano.com",
  exobet: "exobet.org",
  playbet: "playbet.io",
  tekelbet: "tekelbet.net",
  trendyol: "trendyol.com",
  hepsiburada: "hepsiburada.com",
  turkcell: "turkcell.com.tr",
  vodafone: "vodafone.com.tr",
  "turk-telekom": "turktelekom.com.tr",
  migros: "migros.com.tr",
  thy: "turkishairlines.com",
  arcelik: "arcelik.com.tr",
};

const SUPERBONUS = new Set([
  "kazansana", "evetabi", "betnano", "bovbet", "bahsine", "hadibet", "natobet", "exobet",
  "mexiwin", "pulibet", "padisahbet", "galabet", "bahiscasino", "favoribahis", "meritwin",
  "neredebahis", "yasalbahis", "tekelbet", "betmartin", "sanscasino", "marsbahis", "playbet",
  "hizlicasino", "betsmove", "virusbet",
]);

const UA = { "user-agent": "Mozilla/5.0 Chrome/126 Safari/537.36" };
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const useS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const allBrands = process.argv.includes("--all") || process.argv.includes("--force");
const force = process.argv.includes("--force");
const sql = postgres(process.env.DATABASE_URL, { max: 5 });

let s3;
if (useS3) {
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

function isFaviconProxy(url) {
  return FAVICON_PROXY.some((p) => (url ?? "").toLowerCase().includes(p));
}

function isLowResStored(url) {
  if (!(url ?? "").startsWith("/api/files/brand-logos/seed/")) return false;
  const u = url.toLowerCase();
  return !u.includes("-hq.png") && !u.includes("-superbonus.png") && !u.includes("-v2.png") && !u.includes("-tg.png");
}

function isBad(url) {
  if (!url?.trim()) return true;
  const u = url.toLowerCase();
  if (isFaviconProxy(u)) return true;
  if (isLowResStored(url)) return true;
  if (u.includes("superbonus14.pro")) return true;
  // Eski UUID tabanlı MinIO yüklemeleri sık 404 veriyor — yeniden çek
  if (u.startsWith("/api/files/brand-logos/") && !u.includes("/seed/")) return true;
  return BAD.some((p) => u.includes(p));
}

function isGambling(slug, name) {
  return GAMBLING_RE.test(slug) || GAMBLING_RE.test(name ?? "");
}

function domainFor(slug, website) {
  if (DOMAIN_OVERRIDES[slug]) return DOMAIN_OVERRIDES[slug];
  if (website) {
    let d = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    d = d.split("/")[0].split("?")[0];
    if (d.includes(".")) return d;
  }
  return `${slug.replace(/-/g, "")}.com`;
}

function gstatic256(domain) {
  const page = encodeURIComponent(`https://${domain}`);
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${page}&size=256`;
}

async function download(url, minBytes = 500) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("image") && !url.endsWith(".ico")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length >= minBytes ? { buf, type: ct.split(";")[0] || "image/png", size: buf.length, url } : null;
  } catch {
    return null;
  }
}

async function trySiteIcons(domain) {
  for (const path of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
    const hit = await download(`https://${domain}${path}`, 1200);
    if (hit) return { ...hit, src: "site" };
  }
  try {
    const r = await fetch(`https://${domain}/`, { headers: UA, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 150_000);
    for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
      const rel = /rel=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1]?.toLowerCase() ?? "";
      if (!/apple-touch-icon|^icon$|shortcut/.test(rel)) continue;
      const href = /href=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1];
      if (!href || href.endsWith(".svg")) continue;
      try {
        const iconUrl = new URL(href, `https://${domain}/`).href;
        const hit = await download(iconUrl, 1000);
        if (hit) return { ...hit, src: "site" };
      } catch {}
    }
  } catch {}
  return null;
}

async function bestLogo(slug, name, website) {
  const tg = await fetchTelegramLogo(slug);
  if (tg) return tg;

  const staticBrand = STATIC_BRANDS[slug];
  if (staticBrand) {
    const localPath = join(ROOT, "public", staticBrand.logo.replace(/^\//, ""));
    try {
      const buf = readFileSync(localPath);
      return { url: staticBrand.logo, buf, type: "image/png", size: buf.length, src: "static" };
    } catch {
      return { url: staticBrand.logo, buf: null, type: "image/png", size: 0, src: "static" };
    }
  }

  const dom = domainFor(slug, website);

  const site = await trySiteIcons(dom);
  if (site) return site;

  const g = await download(gstatic256(dom), 400);
  if (g) return { ...g, src: "gstatic256", url: gstatic256(dom) };

  const dd = await download(`https://icons.duckduckgo.com/ip3/${dom}.ico`, 400);
  if (dd) return { ...dd, src: "duckduckgo", url: `https://icons.duckduckgo.com/ip3/${dom}.ico` };

  // superbonus14.pro çoğu markada 404 — son çare
  const slugKey = slug.replace(/copy$/i, "");
  if (SUPERBONUS.has(slug) || isGambling(slug, name)) {
    const sb = await download(`https://superbonus14.pro/clients/logo/${slugKey}.png`, 800);
    if (sb) return { ...sb, src: "superbonus", url: `https://superbonus14.pro/clients/logo/${slugKey}.png` };
  }

  return null;
}

async function persistLogo(slug, hit) {
  if (useS3 && hit.buf && hit.buf.length >= 400) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = `brand-logos/seed/${slug}.png`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: hit.buf, ContentType: hit.type }));
    return `/api/files/${key}`;
  }
  if (STATIC_BRANDS[slug] && hit.src === "static") return hit.url;
  if (hit.url?.startsWith("http")) return hit.url;
  if (hit.url?.startsWith("/")) return hit.url;
  return null;
}

const rows = await sql`
  SELECT b.id, b.slug, b.name, b.website, b.logo_url
  FROM brands b
  WHERE ${allBrands ? sql`true` : sql`b.is_active = true`}
  ORDER BY b.slug
`;

const toFix = force ? rows : rows.filter((r) => isBad(r.logo_url ?? ""));

console.log(`Toplam: ${rows.length}, düzeltilecek: ${toFix.length}${useS3 ? " (MinIO)" : ""}`);

let updated = 0;
let failed = 0;

async function fixOne(row) {
  try {
    const hit = await bestLogo(row.slug, row.name, row.website);
    if (!hit) {
      failed++;
      return;
    }
    const logoUrl = await persistLogo(row.slug, hit);
    if (!logoUrl || logoUrl === (row.logo_url ?? "").trim()) return;
    await sql`UPDATE brands SET logo_url = ${logoUrl}, updated_at = now() WHERE id = ${row.id}`;
    updated++;
    if (updated <= 40 || updated % 50 === 0) {
      console.log(`  ${row.slug.padEnd(24)} → ${hit.src} (${hit.size}b)`);
    }
  } catch (e) {
    failed++;
    console.error(`  HATA ${row.slug}: ${e.message}`);
  }
}

for (let i = 0; i < toFix.length; i += 8) {
  await Promise.all(toFix.slice(i, i + 8).map(fixOne));
}

console.log(`Güncellenen: ${updated}, başarısız: ${failed}`);

for (const [slug, meta] of Object.entries(STATIC_BRANDS)) {
  const hit = await bestLogo(slug, meta.name, meta.website);
  const logoUrl = hit ? await persistLogo(slug, hit) : meta.logo;
  const [catRow] = await sql`SELECT id FROM categories WHERE slug = ${meta.category}`;
  if (!catRow) continue;
  await sql`
    UPDATE brands SET
      name = ${meta.name},
      logo_url = ${logoUrl},
      website = ${meta.website},
      category_id = ${catRow.id},
      is_active = true,
      updated_at = now()
    WHERE slug = ${slug}
  `;
}

await sql.end();
