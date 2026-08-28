/**
 * Prod'da eksik markaları geri yükler. MEVCUT VERİYİ SİLMEZ — idempotent.
 *
 * Sıra:
 *   1. Kategoriler (eksik slug'lar)
 *   2. Demo Türk markaları (Trendyol, Turkcell, …)
 *   3. Casino markaları (küçük liste)
 *   4. Casino büyük markalar (Jojobet, Casibom, …)
 *   5. Casino markalarına demo şikayetler (şikayeti olmayan markalara)
 *
 * Coolify app container (DATABASE_URL zaten env'de):
 *   bun scripts/restore-all-brands.mjs
 *
 * Lokal / SSH:
 *   DATABASE_URL='postgres://...' bun scripts/restore-all-brands.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const steps = [
  "scripts/seed-categories.mjs",
  "scripts/seed-demo.mjs",
  "scripts/seed-casino-brands.mjs",
  "scripts/seed-casino-brands-big.mjs",
  "scripts/seed-casino-complaints.mjs",
];

console.log("=== Marka geri yükleme başlıyor ===\n");

for (const rel of steps) {
  const script = path.join(root, rel);
  console.log(`→ ${rel}`);
  const r = spawnSync("bun", [script], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`\nHata: ${rel} (çıkış ${r.status})`);
    process.exit(r.status ?? 1);
  }
  console.log("");
}

console.log("=== Tamamlandı ===");
