/**
 * Kullanıcı listesindeki markaları ekler — sitede (DB) olan slug'ları atlar.
 *   bun scripts/seed-user-requested-brands.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { DOMAIN_OVERRIDES } from "./brand-domain-overrides.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 3 });

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

/** Görünen marka adı düzeltmeleri */
const NAME_OVERRIDES = {
  "im-jbet": "IM JBET",
  "bc-game": "BC.GAME",
  "cassino-bet-br": "CASSINO.BET.BR",
  ggbet: "GGBET",
  "nv-casino": "NV CASINO",
  "ice-casino": "ICE Casino",
  "6q-bet": "6Q Bet",
  "istinye-casino": "İstinye Casino",
  "discount-casino": "Discount Casino",
  "casino-metropol": "Casino Metropol",
  talksport: "talkSPORT",
  stake: "Stake",
  gamdom: "Gamdom",
};

function displayName(raw, slug) {
  return NAME_OVERRIDES[slug] ?? raw.trim();
}

function logoUrl(name, slug) {
  const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=1B263B&color=fff&bold=true&length=2`;
  return `https://unavatar.io/${dom}?fallback=${encodeURIComponent(fb)}`;
}

const raw = readFileSync(join(__dir, "user-requested-brands-missing.txt"), "utf8");
const names = [];
const seen = new Set();
for (const line of raw.split("\n")) {
  const name = line.trim();
  if (!name) continue;
  const slug = slugify(name);
  if (seen.has(slug)) continue;
  seen.add(slug);
  names.push(displayName(name, slug));
}

const [cat] = await sql`SELECT id FROM categories WHERE slug = ${"bilisim-teknoloji"}`;
if (!cat) {
  console.error("Kategori bulunamadı: bilisim-teknoloji");
  process.exit(1);
}

let added = 0;
let skipped = 0;
const skippedSlugs = [];

for (const name of names) {
  const slug = slugify(name);
  const [exists] = await sql`SELECT 1 FROM brands WHERE slug = ${slug}`;
  if (exists) {
    skipped++;
    skippedSlugs.push(slug);
    continue;
  }
  const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
  const website = dom.startsWith("http") ? dom : `https://${dom}`;
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
  console.log(`  + ${name} (${slug})`);
}

const [{ n }] = await sql`SELECT count(*)::int n FROM brands WHERE is_active = true`;
console.log(`\nListe: ${names.length} | Eklendi: ${added} | Zaten vardı (atlandı): ${skipped} | Site toplam: ${n}`);
if (skippedSlugs.length) {
  console.log(`Atlanan slug'lar: ${skippedSlugs.join(", ")}`);
}

await sql.end();
