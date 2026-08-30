/**
 * Bilişim teknoloji markalarını toplu ekler. İdempotent.
 *   bun scripts/seed-bilisim-brands-bulk.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dir = dirname(fileURLToPath(import.meta.url));
const sql = postgres(process.env.DATABASE_URL!, { max: 3 });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const TR = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};
const slugify = (s) =>
  s
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const DOMAIN_OVERRIDES = {
  "21-com": "21.com",
  "1xbet": "1xbet.com",
  mostbet: "mostbet.com",
  grandpashabet: "grandpashabet.com",
  playbet: "playbet.io",
  "sans-casino": "sanscasino.com",
  "lord-palace-casino": "lordpalacecasino.com",
  istanbulbahis: "istanbulbahis.com",
  jojobet: "jojobet.com",
  mavibet: "mavibet.com",
  holiganbet: "holiganbet.com",
};

const LOGO_OVERRIDES = {
  matbet: "/brand-logos/matbet.png",
};

const NO_WEBSITE = new Set(["matbet"]);

function logoUrl(name, slug) {
  if (LOGO_OVERRIDES[slug]) return LOGO_OVERRIDES[slug];
  const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=1B263B&color=fff&bold=true&length=2`;
  return `https://unavatar.io/${dom}?fallback=${encodeURIComponent(fb)}`;
}

const raw = readFileSync(join(__dir, "bilisim-brand-names.txt"), "utf8");
const names = [];
const seen = new Set();
for (const line of raw.split("\n")) {
  const name = line.trim();
  if (!name) continue;
  const slug = slugify(name);
  if (seen.has(slug)) continue;
  seen.add(slug);
  names.push(name);
}

const [cat] = await sql`SELECT id FROM categories WHERE slug = ${"bilisim-teknoloji"}`;
if (!cat) {
  console.error("Kategori bulunamadı: bilisim-teknoloji");
  process.exit(1);
}

let added = 0;
let skipped = 0;
for (const name of names) {
  const slug = slugify(name);
  const [exists] = await sql`SELECT 1 FROM brands WHERE slug = ${slug}`;
  if (exists) {
    skipped++;
    continue;
  }
  const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
  const website = NO_WEBSITE.has(slug) ? null : dom.startsWith("http") ? dom : `https://${dom}`;
  const total = rnd(20, 180);
  const resolvedPct = rnd(8, 35);
  const resolved = Math.round((total * resolvedPct) / 100);
  await sql`
    INSERT INTO brands (
      slug, name, category_id, website, city, logo_url, verified, premium,
      rating, rating_count, total_complaints, complaints_resolved,
      resolution_rate, avg_response_minutes, is_active
    ) VALUES (
      ${slug}, ${name}, ${cat.id}, ${website}, ${"İstanbul"},
      ${logoUrl(name, slug)}, false, false,
      ${(rnd(18, 34) / 10).toFixed(2)}, ${rnd(8, 120)}, ${total},
      ${resolved}, ${resolvedPct}, ${rnd(90, 1800)}, true
    )`;
  added++;
}

const [{ n }] = await sql`SELECT count(*)::int n FROM brands WHERE category_id = ${cat.id}`;
console.log(`Eklendi: ${added}, atlandı: ${skipped}, kategori toplam: ${n}`);
await sql.end();
