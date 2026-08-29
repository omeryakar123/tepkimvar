/**
 * SuperBonus sponsor listesindeki bahis/casino markalarını ekler.
 * Logo önceliği: superbonus14.pro/clients/logo → site ikonu → gstatic → monogram.
 * İdempotent. Çalıştır: DATABASE_URL=... bun scripts/seed-superbonus-brands.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const useS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
const SUPERBONUS_LOGO = "https://superbonus14.pro/clients/logo";

/** name, slug, domain, superbonus logo dosya adı (genelde slug ile aynı) */
const BRANDS = [
  { name: "Kazansana", slug: "kazansana", domain: "kazansana.com", logoKey: "kazansana" },
  { name: "Evetabi", slug: "evetabi", domain: "evetabi.com", logoKey: "evetabi" },
  { name: "Betnano", slug: "betnano", domain: "betnano.com", logoKey: "betnano" },
  { name: "Bovbet", slug: "bovbet", domain: "bovbet.com", logoKey: "bovbet" },
  { name: "Bahsine", slug: "bahsine", domain: "bahsine.com", logoKey: "bahsine" },
  { name: "Hadibet", slug: "hadibet", domain: "hadibet.com", logoKey: "hadibet" },
  { name: "Natobet", slug: "natobet", domain: "natobet.com", logoKey: "natobet" },
  { name: "Exobet", slug: "exobet", domain: "exobet.com", logoKey: "exobet" },
  { name: "Mexiwin", slug: "mexiwin", domain: "mexiwin.com", logoKey: "mexiwin" },
  { name: "Pulibet", slug: "pulibet", domain: "pulibet.com", logoKey: "pulibet" },
  { name: "Padişahbet", slug: "padisahbet", domain: "padisahbet.com", logoKey: "padisahbet" },
  { name: "Galabet", slug: "galabet", domain: "galabet.com", logoKey: "galabet" },
  { name: "Bahiscasino", slug: "bahiscasino", domain: "bahiscasino.com", logoKey: "bahiscasino" },
  { name: "Favoribahis", slug: "favoribahis", domain: "favoribahis.com", logoKey: "favoribahis" },
  { name: "Meritwin", slug: "meritwin", domain: "meritwin.com", logoKey: "meritwin" },
  { name: "Neredebahis", slug: "neredebahis", domain: "neredebahis.com", logoKey: "neredebahis" },
  { name: "Yasalbahis", slug: "yasalbahis", domain: "yasalbahis.com", logoKey: "yasalbahis" },
  { name: "Tekelbet", slug: "tekelbet", domain: "tekelbet.com", logoKey: "tekelbet" },
  { name: "Betmartin", slug: "betmartin", domain: "betmartin.com", logoKey: "betmartin" },
  { name: "Şans Casino", slug: "sanscasino", domain: "sanscasino.com", logoKey: "sanscasino" },
  { name: "Marsbahis", slug: "marsbahis", domain: "marsbahis.com", logoKey: "marsbahis" },
  { name: "Playbet", slug: "playbet", domain: "playbet.io", logoKey: "playbet" },
  { name: "Hızlı Casino", slug: "hizlicasino", domain: "hizlicasino.com", logoKey: "hizlicasino" },
  { name: "Betsmove", slug: "betsmove", domain: "betsmove.com", logoKey: "betsmove" },
  { name: "Virusbet", slug: "virusbet", domain: "virusbet.com", logoKey: "virusbet" },
];

const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
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

async function superbonusLogo(logoKey) {
  const url = `${SUPERBONUS_LOGO}/${logoKey.replace(/copy$/i, "")}.png`;
  const hit = await tryDownload(url, 800);
  return hit ? { ...hit, src: "superbonus", url } : null;
}

async function siteLogo(name, domain) {
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
  const g = await tryDownload(
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url=https://${domain}`,
    1200,
  );
  if (g) return { ...g, src: "gstatic" };
  const m = await tryDownload(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&background=1B263B&color=fff&bold=true&length=2&format=png`,
    200,
  );
  if (m) return { ...m, src: "monogram" };
  return null;
}

async function resolveLogo(name, domain, logoKey) {
  return (await superbonusLogo(logoKey)) ?? (await siteLogo(name, domain));
}

const [cat] = await sql`SELECT id FROM categories WHERE slug=${"beyaz-esya-elektronik"}`;
if (!cat) {
  console.error("Kategori bulunamadı: beyaz-esya-elektronik");
  process.exit(1);
}

const stats = { superbonus: 0, site: 0, gstatic: 0, monogram: 0, skipped: 0, added: 0, updated: 0 };
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

for (const b of BRANDS) {
  const [existing] = await sql`SELECT id, logo_url FROM brands WHERE slug=${b.slug}`;

  const logo = await resolveLogo(b.name, b.domain, b.logoKey);
  if (!logo) {
    console.warn(`  ⚠ logo bulunamadı: ${b.name}`);
    continue;
  }
  stats[logo.src]++;

  let logoUrl;
  if (useS3 && logo.buf) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = `brand-logos/seed/${b.slug}-superbonus.png`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: logo.buf, ContentType: logo.type }));
    logoUrl = `/api/files/${key}`;
  } else if (logo.url) {
    logoUrl = logo.url;
  } else {
    logoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}&size=256&background=1B263B&color=fff&bold=true&length=2`;
  }

  const total = rnd(40, 420);
  const resolvedPct = rnd(12, 48);

  if (existing) {
    if (!existing.logo_url || existing.logo_url.includes("ui-avatars") || existing.logo_url.includes("unavatar")) {
      await sql`UPDATE brands SET logo_url=${logoUrl}, website=${"https://" + b.domain} WHERE id=${existing.id}`;
      stats.updated++;
      console.log(`  ↻ logo güncellendi: ${b.name}`);
    } else {
      stats.skipped++;
    }
    continue;
  }

  await sql`INSERT INTO brands
    (slug, name, category_id, website, city, logo_url, verified, premium,
     rating, rating_count, total_complaints, complaints_resolved, resolution_rate, avg_response_minutes)
    VALUES (${b.slug}, ${b.name}, ${cat.id}, ${"https://" + b.domain}, ${"İstanbul"}, ${logoUrl},
            false, false, ${(rnd(16, 34) / 10).toFixed(2)}, ${rnd(8, 220)}, ${total},
            ${Math.round((total * resolvedPct) / 100)}, ${resolvedPct}, ${rnd(90, 1800)})`;
  stats.added++;
  console.log(`  + ${b.name}`);
}

const [{ n }] = await sql`SELECT count(*)::int n FROM brands`;
console.log(
  `\nEklendi: ${stats.added}, logo güncellendi: ${stats.updated}, atlandı: ${stats.skipped}. ` +
    `Logo → superbonus: ${stats.superbonus}, site: ${stats.site}, gstatic: ${stats.gstatic}, monogram: ${stats.monogram}. Toplam: ${n}`,
);
await sql.end();
