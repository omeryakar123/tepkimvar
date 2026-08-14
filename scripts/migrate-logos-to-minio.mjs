/**
 * Dış (unavatar/clearbit) logo URL'lerini kalıcı hale getirir:
 * favicon'u bir kez indirir (gstatic; yoksa ui-avatars monogram), MinIO'ya
 * yükler ve brands.logo_url'i /api/files/brand-logos/seed/<slug>.png yapar.
 * Böylece sayfa açılışında dış servise istek gitmez (unavatar 429 sorunu biter).
 *
 * Gereksinim: .env'de DATABASE_URL + S3_* (public MinIO) dolu olmalı.
 * Çalıştır: bun scripts/migrate-logos-to-minio.mjs
 */
import postgres from "postgres";
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const BUCKET = process.env.S3_BUCKET || "itirazvar";
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const GSTATIC = "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=";

async function fetchLogo(name, website) {
  const domain = (website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (domain) {
    try {
      const r = await fetch(GSTATIC + "https://" + domain, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 100) return { buf, type: r.headers.get("content-type") || "image/png" };
      }
    } catch {}
  }
  // Monogram fallback — her marka için garantili görsel.
  const ua = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=1B263B&color=fff&bold=true&length=2&format=png`;
  const r = await fetch(ua, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`ui-avatars ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), type: "image/png" };
}

try { await s3.send(new HeadBucketCommand({ Bucket: BUCKET })); }
catch { await s3.send(new CreateBucketCommand({ Bucket: BUCKET })); }

const brands = await sql`SELECT id, slug, name, website, logo_url FROM brands WHERE logo_url LIKE ${"http%"} ORDER BY slug`;
console.log(`Taşınacak: ${brands.length} marka (dış logo URL'li)`);

let ok = 0, mono = 0, fail = 0;
for (const b of brands) {
  try {
    const domain = (b.website ?? "").replace(/^https?:\/\//, "").split("/")[0];
    const { buf, type } = await fetchLogo(b.name, b.website);
    const isMono = !domain || buf.length < 400 ? false : false; // sayaç aşağıda
    const key = `brand-logos/seed/${b.slug}.png`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: type }));
    await sql`UPDATE brands SET logo_url=${"/api/files/" + key}, updated_at=now() WHERE id=${b.id}`;
    ok++;
    if (ok % 20 === 0) console.log(`  ${ok}/${brands.length}…`);
  } catch (e) {
    fail++;
    console.error(`  HATA ${b.slug}: ${e.message}`);
  }
}
console.log(`Bitti: ${ok} yüklendi, ${fail} hata.`);
await sql.end();
