/**
 * Pazarın EN BÜYÜK online casino/bahis markalarını ekler.
 * Logo: site ikonu (apple-touch-icon) → gstatic 256 → monogram; MinIO'ya yüklenir.
 * Büyük markalara yüksek sayaçlar verilir (total/rating_count) — köklü görünüm.
 * İdempotent.  Çalıştır: bun scripts/seed-casino-brands-big.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const useS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

function unavatarLogo(name, domain) {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&background=1B263B&color=fff&bold=true&length=2`;
  return `https://unavatar.io/${domain}?fallback=${encodeURIComponent(fb)}`;
}
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const NAMES = [
  "Jojobet","Grandpashabet","Meritking","Casibom","Bets10","Betboo","Mobilbahis",
  "Youwin","Superbetin","Tempobet","Bahigo","Bahsegel","Cratosslot","Vdcasino",
  "Sekabet","Onwin","Sahabet","Matadorbet","Holiganbet","Marsbahis","Betturkey",
  "Mariobet","Piabet","Pinbahis","Restbet","Klasbahis","Dinamobet","1xbet",
  "Mostbet","Betist","Pusulabet","Perabet","Jetbahis","Rexbet","Casinomaxi",
  "Casinometropol","Cratosroyal","Bettilt","Nakitbahis","İmajbet","Sultanbet",
  "Vevobahis","Betpark","Betpas","Kingroyal","Extrabet","Hepsibahis","Betebet",
  "Asyabahis","Casinoper","Betsat","Betgaranti",
];

const TR = { "ç":"c","Ç":"c","ğ":"g","Ğ":"g","ı":"i","I":"i","İ":"i","ö":"o","Ö":"o","ş":"s","Ş":"s","ü":"u","Ü":"u" };
const slugify = (s) => s.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR[c] ?? c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];
const get = (url, ms = 9000) => fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(ms) });

function parseIcons(html, base) {
  const out = [];
  for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
    const rel = /rel=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/apple-touch-icon|^icon$|shortcut/.test(rel)) continue;
    const href = /href=["']?([^"'>\s]+)["']?/i.exec(tag)?.[1];
    if (!href || href.endsWith(".svg")) continue;
    const sizes = /sizes=["']?(\d+)/i.exec(tag)?.[1];
    const score = sizes ? Number(sizes) : rel.includes("apple") ? 180 : 32;
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
    return buf.length < minBytes ? null : { buf, type };
  } catch { return null; }
}

async function bestLogo(name, domain) {
  for (const p of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
    const hit = await tryDownload(`https://${domain}${p}`, 2000);
    if (hit) return { ...hit, src: "site" };
  }
  try {
    const r = await get(`https://${domain}/`);
    if (r.ok) {
      for (const cand of parseIcons((await r.text()).slice(0, 200_000), `https://${domain}/`).slice(0, 4)) {
        const hit = await tryDownload(cand.url, 1500);
        if (hit) return { ...hit, src: "site" };
      }
    }
  } catch {}
  const g = await tryDownload(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url=https://${domain}`, 1200);
  if (g) return { ...g, src: "gstatic" };
  const m = await tryDownload(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&background=1B263B&color=fff&bold=true&length=2&format=png`, 200);
  if (m) return { ...m, src: "monogram" };
  throw new Error("logo kaynağı yok");
}

const [cat] = await sql`SELECT id FROM categories WHERE slug=${"bilisim-teknoloji"}`;
if (!cat) { console.error("bilisim-teknoloji kategorisi yok"); process.exit(1); }

const stats = { site: 0, gstatic: 0, monogram: 0 };
let added = 0, skipped = 0;

for (const name of NAMES) {
  const slug = slugify(name);
  const [exists] = await sql`SELECT 1 FROM brands WHERE slug=${slug}`;
  if (exists) { skipped++; continue; }

  const domain = `${slug.replace(/-/g, "")}.com`;
  let logoUrl;
  if (useS3) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    const { buf, type, src } = await bestLogo(name, domain);
    stats[src]++;
    const key = `brand-logos/seed/${slug}-v2.png`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: type }));
    logoUrl = `/api/files/${key}`;
  } else {
    stats.monogram++;
    logoUrl = unavatarLogo(name, domain);
  }

  // Büyük marka profili: yüksek hacim, düşük-orta çözüm oranı
  const total = rnd(800, 6500);
  const resolvedPct = rnd(15, 55);
  await sql`INSERT INTO brands
    (slug, name, category_id, website, city, logo_url, verified, premium,
     rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
    VALUES (${slug}, ${name}, ${cat.id}, ${"https://" + domain}, ${"İstanbul"}, ${logoUrl},
            false, false, ${(rnd(18, 36) / 10).toFixed(2)}, ${rnd(150, 3000)}, ${total},
            ${Math.round((total * resolvedPct) / 100)}, ${resolvedPct}, ${rnd(60, 1200)})`;
  added++;
  if (added % 10 === 0) console.log(`  ${added}…`);
}

const [{ n }] = await sql`SELECT count(*)::int n FROM brands`;
console.log(`Eklendi: ${added}, atlandı: ${skipped}. Logo → site: ${stats.site}, gstatic: ${stats.gstatic}, monogram: ${stats.monogram}. Toplam marka: ${n}`);
await sql.end();
