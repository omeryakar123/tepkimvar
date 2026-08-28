/**
 * Eksik kategorileri ekler (silmez). Demo + casino seed scriptleri için gerekli slug'lar.
 *   bun scripts/seed-categories.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });

const CATEGORIES = [
  ["Alışveriş / E-Ticaret", "alisveris-e-ticaret", "ShoppingCart", 1],
  ["Market / Süpermarket", "market-supermarket", "Store", 2],
  ["Telekomünikasyon", "telekomunikasyon", "Phone", 3],
  ["Bankacılık / Finans", "bankacilik-finans", "Landmark", 4],
  ["Ulaşım", "ulasim", "Plane", 5],
  ["Kargo / Lojistik", "kargo-lojistik", "Truck", 6],
  ["Restoran / Yeme-İçme", "restoran-yeme-icme", "Utensils", 7],
  ["Enerji", "enerji", "Zap", 8],
  ["Beyaz Eşya / Elektronik", "beyaz-esya-elektronik", "Tv", 9],
  ["Giyim / Moda / Tekstil", "giyim-moda-tekstil", "Shirt", 10],
  ["Bilişim / Teknoloji", "bilisim-teknoloji", "Cpu", 11],
  // Eski seed.ts slug'ları (varsa atlanır)
  ["E-Ticaret", "e-ticaret", "ShoppingCart", 12],
  ["Bankacılık", "bankacilik", "Landmark", 13],
  ["Kargo", "kargo", "Truck", 14],
  ["Market", "market", "Store", 15],
];

let added = 0;
for (const [name, slug, icon, sortOrder] of CATEGORIES) {
  const [exists] = await sql`SELECT 1 FROM categories WHERE slug=${slug} LIMIT 1`;
  if (exists) continue;
  await sql`
    INSERT INTO categories (name, slug, icon, sort_order, is_active)
    VALUES (${name}, ${slug}, ${icon}, ${sortOrder}, true)`;
  added++;
}

const [{ n }] = await sql`SELECT count(*)::int n FROM categories`;
console.log(`Kategori: ${added} yeni eklendi. Toplam: ${n}`);
await sql.end();
