#!/usr/bin/env bun
/**
 * Kullanıcı tarafından sağlanan logo görsellerini public/brand-logos/ altına kopyalar,
 * manual-brand-logos.ts üretir ve (opsiyonel) DB günceller.
 *
 *   bun scripts/import-manual-brand-logos.mjs
 *   bun scripts/import-manual-brand-logos.mjs --db
 *   bun scripts/import-manual-brand-logos.mjs --db --telegram plazabet,betrabet
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { fetchTelegramLogo } from "./lib/telegram-logo.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const ASSETS =
  process.env.BRAND_LOGO_ASSETS_DIR ||
  join(process.env.HOME ?? "", ".cursor/projects/Users-omer-Desktop-ITIRAZVAR-tepkimvar/assets");
const OUT_DIR = join(ROOT, "public/brand-logos");
const MAP_PATH = join(__dir, "brand-logo-import-map.json");
const TS_OUT = join(ROOT, "src/lib/manual-brand-logos.ts");

const updateDb = process.argv.includes("--db");
const tgArg = process.argv.find((a) => a.startsWith("--telegram="));
const telegramSlugs = tgArg
  ? tgArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean)
  : ["plazabet", "betrabet", "casinodior", "casinoas", "gallerbahis", "gobahis"];

const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

function publicUrl(slug) {
  return `/brand-logos/${slug}.png`;
}

async function persistTelegram(slug) {
  const hit = await fetchTelegramLogo(slug);
  if (!hit?.buf?.length) return null;
  const out = join(OUT_DIR, `${slug}.png`);
  writeFileSync(out, hit.buf);
  return publicUrl(slug);
}

const overrides = {};

for (const [slug, file] of Object.entries(map)) {
  const src = join(ASSETS, file);
  if (!existsSync(src)) {
    console.warn(`  ATLA ${slug}: ${file} bulunamadı`);
    continue;
  }
  const dest = join(OUT_DIR, `${slug}.png`);
  // macOS sips ile JPG→PNG; yoksa doğrudan kopyala
  try {
    const { execSync } = await import("node:child_process");
    execSync(`sips -s format png "${src}" --out "${dest}"`, { stdio: "pipe" });
  } catch {
    copyFileSync(src, dest);
  }
  overrides[slug] = publicUrl(slug);
  console.log(`  ${slug} → ${dest}`);
}

for (const slug of telegramSlugs) {
  if (overrides[slug]) continue;
  console.log(`  ${slug} → Telegram…`);
  const url = await persistTelegram(slug);
  if (url) {
    overrides[slug] = url;
    console.log(`    OK`);
  } else {
    console.warn(`    Telegram logo alınamadı`);
  }
}

const slugs = Object.keys(overrides).sort();
const ts = `/** Otomatik üretildi — scripts/import-manual-brand-logos.mjs */\nexport const MANUAL_BRAND_LOGOS: Record<string, string> = ${JSON.stringify(
  Object.fromEntries(slugs.map((s) => [s, overrides[s]])),
  null,
  2,
)};\n`;
writeFileSync(TS_OUT, ts);
console.log(`\n${TS_OUT} (${slugs.length} marka)`);

if (updateDb) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL gerekli (--db)");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 3 });
  let n = 0;
  for (const [slug, url] of Object.entries(overrides)) {
    const res = await sql`
      UPDATE brands SET logo_url = ${url}, updated_at = now()
      WHERE slug = ${slug}
    `;
    if (res.count) n++;
  }
  await sql.end();
  console.log(`DB güncellendi: ${n} marka`);
}
