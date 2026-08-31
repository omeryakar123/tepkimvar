#!/usr/bin/env bun
/**
 * Telegram kanal profil fotoğraflarını marka logoları olarak yükler.
 *   bun scripts/sync-telegram-logos.mjs
 *   bun scripts/sync-telegram-logos.mjs --force
 */
import postgres from "postgres";
import { TELEGRAM_BRAND_CHANNELS } from "./telegram-brand-channels.mjs";
import { fetchTelegramLogo } from "./lib/telegram-logo.mjs";

const BUCKET = process.env.S3_BUCKET || "itirazvar";
const force = process.argv.includes("--force");
const useS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

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

async function persistLogo(slug, hit) {
  const key = `brand-logos/seed/${slug}-tg.png`;
  if (useS3 && hit.buf) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: hit.buf, ContentType: hit.type }));
    return `/api/files/${key}`;
  }
  return hit.url?.startsWith("http") ? hit.url : null;
}

const slugs = Object.keys(TELEGRAM_BRAND_CHANNELS);
const rows = await sql`
  SELECT id, slug, logo_url FROM brands WHERE slug = ANY(${slugs})
`;
const bySlug = new Map(rows.map((r) => [r.slug, r]));

console.log(`Telegram eşlemesi: ${slugs.length}, DB'de bulunan: ${rows.length}${useS3 ? " (MinIO)" : ""}`);

let updated = 0;
let skipped = 0;
let failed = 0;

async function syncOne(slug) {
  const row = bySlug.get(slug);
  if (!row) {
    skipped++;
    return;
  }
  const channel = TELEGRAM_BRAND_CHANNELS[slug];
  const current = (row.logo_url ?? "").trim();
  if (!force && current.includes("-tg.png")) {
    skipped++;
    return;
  }

  try {
    const hit = await fetchTelegramLogo(slug);
    if (!hit) {
      failed++;
      console.log(`  ✗ ${slug.padEnd(22)} @${channel} — foto yok`);
      return;
    }
    const logoUrl = await persistLogo(slug, hit);
    if (!logoUrl || logoUrl === current) {
      skipped++;
      return;
    }
    await sql`UPDATE brands SET logo_url = ${logoUrl}, updated_at = now() WHERE id = ${row.id}`;
    updated++;
    console.log(`  ✓ ${slug.padEnd(22)} @${channel} (${hit.size}b)`);
  } catch (e) {
    failed++;
    console.error(`  HATA ${slug}: ${e.message}`);
  }
}

for (let i = 0; i < slugs.length; i += 4) {
  await Promise.all(slugs.slice(i, i + 4).map(syncOne));
}

console.log(`Güncellenen: ${updated}, atlandı: ${skipped}, başarısız: ${failed}`);
await sql.end();
