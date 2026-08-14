/**
 * Logo kalite yükseltme (v2). Sıralı kaynak merdiveni:
 *   1. Sitenin kendi apple-touch-icon / yüksek çözünürlüklü icon'u (genelde 180-512px PNG)
 *   2. gstatic faviconV2 size=256
 *   3. ui-avatars monogram 256px
 * En iyi bulunanı MinIO'ya  brand-logos/seed/<slug>-v2.png  olarak yükler
 * (yeni key = tarayıcı cache'i otomatik patlar) ve logo_url'i günceller.
 * Çalıştır: bun scripts/upgrade-logos-v2.mjs
 */
import postgres from "postgres";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function get(url, ms = 9000) {
  return fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(ms) });
}

/** Sitenin HTML'inden icon linklerini çıkar, büyükten küçüğe sırala. */
function parseIcons(html, base) {
  const out = [];
  const linkRe = /<link\s[^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const rel = /rel=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/apple-touch-icon|^icon$|shortcut/.test(rel)) continue;
    const href = /href=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1];
    if (!href || href.endsWith(".svg")) continue;
    const sizes = /sizes=["']?(\d+)/i.exec(tag)?.[1];
    let score = sizes ? Number(sizes) : rel.includes("apple") ? 180 : 32;
    try { out.push({ url: new URL(href, base).href, score }); } catch {}
  }
  return out.sort((a, b) => b.score - a.score);
}

async function tryDownload(url, minBytes) {
  try {
    const r = await get(url);
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!OK_TYPES.includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < minBytes) return null;
    return { buf, type };
  } catch { return null; }
}

async function bestLogo(name, website) {
  const domain = (website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  // 1) Sitenin kendi yüksek çözünürlüklü ikonları
  if (domain) {
    for (const path of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
      const hit = await tryDownload(`https://${domain}${path}`, 2000);
      if (hit) return { ...hit, src: "site" };
    }
    try {
      const r = await get(`https://${domain}/`);
      if (r.ok) {
        const html = (await r.text()).slice(0, 200_000);
        for (const cand of parseIcons(html, `https://${domain}/`).slice(0, 4)) {
          const hit = await tryDownload(cand.url, 1500);
          if (hit) return { ...hit, src: "site" };
        }
      }
    } catch {}
    // 2) gstatic 256
    const g = await tryDownload(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url=https://${domain}`,
      1200,
    );
    if (g) return { ...g, src: "gstatic" };
  }
  // 3) Monogram 256
  const m = await tryDownload(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&background=1B263B&color=fff&bold=true&length=2&format=png`,
    200,
  );
  if (m) return { ...m, src: "monogram" };
  throw new Error("hiçbir kaynak çalışmadı");
}

const brands = await sql`SELECT id, slug, name, website FROM brands WHERE logo_url LIKE ${"/api/files/brand-logos/seed/%"} ORDER BY slug`;
console.log(`Yükseltilecek: ${brands.length} marka`);

const stats = { site: 0, gstatic: 0, monogram: 0, fail: 0 };
let done = 0;

// 6'lı gruplar halinde paralel (siteler yavaş olabilir)
for (let i = 0; i < brands.length; i += 6) {
  await Promise.all(brands.slice(i, i + 6).map(async (b) => {
    try {
      const { buf, type, src } = await bestLogo(b.name, b.website);
      const key = `brand-logos/seed/${b.slug}-v2.png`;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: type }));
      await sql`UPDATE brands SET logo_url=${"/api/files/" + key}, updated_at=now() WHERE id=${b.id}`;
      stats[src]++;
    } catch (e) {
      stats.fail++;
      console.error(`  HATA ${b.slug}: ${e.message}`);
    }
    if (++done % 20 === 0) console.log(`  ${done}/${brands.length}…`);
  }));
}

console.log(`Bitti. Kaynaklar → site ikonu: ${stats.site}, gstatic-256: ${stats.gstatic}, monogram: ${stats.monogram}, hata: ${stats.fail}`);
await sql.end();
