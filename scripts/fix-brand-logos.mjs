#!/usr/bin/env bun
/**
 * Marka logolarını yüksek çözünürlüğe yükseltir.
 * Öncelik: superbonus PNG → site ikonu → gstatic 256 → s2 256
 * S3 varsa MinIO'ya yükler (/api/files/brand-logos/seed/<slug>-hq.png).
 *
 *   bun scripts/fix-brand-logos.mjs
 *   bun scripts/fix-brand-logos.mjs --all
 *   bun scripts/fix-brand-logos.mjs --all --force
 */
import postgres from "postgres";

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
const MIN = 1500;
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const useS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const allBrands = process.argv.includes("--all");
const force = process.argv.includes("--force");
const sql = postgres(process.env.DATABASE_URL, { max: 3 });

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
  const u = (url ?? "").toLowerCase();
  return FAVICON_PROXY.some((p) => u.includes(p));
}

function isBad(url) {
  if (!url?.trim()) return true;
  const u = url.toLowerCase();
  if (isFaviconProxy(u)) return true;
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
  return `${slug}.com`;
}

function gstatic256(domain) {
  const page = encodeURIComponent(`https://${domain}`);
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${page}&size=256`;
}

async function download(url, minBytes = MIN) {
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
    const hit = await download(`https://${domain}${path}`, 2000);
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
        const hit = await download(iconUrl, 1500);
        if (hit) return { ...hit, src: "site" };
      } catch {}
    }
  } catch {}
  return null;
}

async function bestLogo(slug, name, website) {
  const dom = domainFor(slug, website);

  if (SUPERBONUS.has(slug) || isGambling(slug, name)) {
    const sb = await download(`https://superbonus14.pro/clients/logo/${slug.replace(/copy$/i, "")}.png`, 1500);
    if (sb) return { ...sb, src: "superbonus" };
  }

  const site = await trySiteIcons(dom);
  if (site) return site;

  const g = await download(gstatic256(dom), MIN);
  if (g) return { ...g, src: "gstatic256" };

  const s2 = await download(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=256`,
    MIN,
  );
  if (s2) return { ...s2, src: "s2" };

  return {
    url: gstatic256(dom),
    size: 0,
    src: "gstatic-fallback",
    buf: null,
    type: "image/png",
  };
}

async function persistLogo(slug, hit) {
  if (useS3 && hit.buf && hit.buf.length >= MIN) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = `brand-logos/seed/${slug}-hq.png`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: hit.buf, ContentType: hit.type }));
    return `/api/files/${key}`;
  }
  return hit.url;
}

const rows = await sql`
  SELECT b.id, b.slug, b.name, b.website, b.logo_url, c.slug AS cat
  FROM brands b
  JOIN categories c ON c.id = b.category_id
  WHERE ${allBrands ? sql`true` : sql`c.slug IN ('bilisim-teknoloji', 'telekomunikasyon', 'elektronik', 'beyaz-esya-elektronik')`}
  ORDER BY b.slug
`;

const toFix = rows.filter((r) => {
  if (force) return true;
  const url = r.logo_url ?? "";
  if (isBad(url)) return true;
  if (url.startsWith("/api/files/") && !url.includes("-hq.png") && !url.includes("-superbonus")) return true;
  return false;
});

console.log(`Toplam: ${rows.length}, düzeltilecek: ${toFix.length}${useS3 ? " (MinIO yükleme açık)" : ""}`);

let updated = 0;
for (const row of toFix) {
  const hit = await bestLogo(row.slug, row.name, row.website);
  if (!hit?.url && !hit?.buf) continue;

  const logoUrl = await persistLogo(row.slug, hit);
  if (!logoUrl || logoUrl === (row.logo_url ?? "").trim()) continue;

  await sql`UPDATE brands SET logo_url = ${logoUrl}, updated_at = now() WHERE id = ${row.id}`;
  updated++;
  if (updated <= 30 || updated % 40 === 0) {
    console.log(`  ${row.slug.padEnd(22)} → ${hit.src} (${hit.size}b)`);
  }
}

console.log(`Güncellenen logo: ${updated}`);
await sql.end();
