/**
 * MinIO / S3 uyumlu depolama katmanı.
 *
 * Supabase Storage'ın yerine geçer. Bucket'lar "klasör" (prefix) olarak tek
 * bucket içinde tutulur: <bucket>/<folder>/<complaintId>/<dosya>.
 * Nesneler PRIVATE; erişim /api/files/$ ucundan yetki kontrolüyle veriliyor.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
export const BUCKET = process.env.S3_BUCKET || "itirazvar";

export const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint,
  forcePathStyle: true, // MinIO için zorunlu
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
});

let bucketReady = false;
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  bucketReady = true;
}

/** İzin verilen mantıksal klasörler (eski Supabase bucket adlarının karşılığı). */
export const FOLDERS = [
  "avatars",
  "brand-logos",
  "brand-covers",
  "brand-gallery",
  "banner-images",
  "blog-images",
  "complaint-images",
  "complaint-files",
  "brand-documents",
  "brand-videos",
] as const;
export type Folder = (typeof FOLDERS)[number];

/* --------------------------- Sunucu tarafı doğrulama ----------------------- */
// İstemci doğrulaması atlanabilir; asıl kural BURADA.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];
// SVG BİLEREK YOK: aynı origin'den servis edilen SVG stored-XSS vektörüdür.
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function validateUpload(
  folder: string,
  contentType: string,
  size: number,
): { ok: true; folder: Folder } | { ok: false; error: string } {
  if (!FOLDERS.includes(folder as Folder)) return { ok: false, error: "Geçersiz klasör" };

  // Video klasörü: yalnızca mp4/webm/mov, 100 MB'a kadar. SVG yine yasak.
  if (folder === "brand-videos") {
    if (!VIDEO_TYPES.includes(contentType))
      return { ok: false, error: "Sadece video yükleyebilirsiniz (mp4, webm, mov)" };
    if (size > MAX_VIDEO_BYTES) return { ok: false, error: "Video en fazla 100 MB olabilir" };
    return { ok: true, folder: folder as Folder };
  }

  const isImageFolder = folder !== "complaint-files" && folder !== "brand-documents";

  if (isImageFolder) {
    if (!IMAGE_TYPES.includes(contentType)) return { ok: false, error: "Sadece görsel yükleyebilirsiniz (SVG hariç)" };
    if (size > MAX_IMAGE_BYTES) return { ok: false, error: "Görsel en fazla 10 MB olabilir" };
  } else {
    if (![...IMAGE_TYPES, ...DOC_TYPES].includes(contentType))
      return { ok: false, error: "Desteklenmeyen dosya türü" };
    if (size > MAX_FILE_BYTES) return { ok: false, error: "Dosya en fazla 25 MB olabilir" };
  }
  return { ok: true, folder: folder as Folder };
}

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // İçeriğin tarayıcıda script olarak çalışmasını engelle.
      // Görsel/video inline oynatılabilir; diğer her şey indirilir.
      ContentDisposition:
        contentType.startsWith("image/") || contentType.startsWith("video/")
          ? "inline"
          : "attachment",
    }),
  );
}

export async function getObject(key: string) {
  await ensureBucket();
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deleteObject(key: string): Promise<void> {
  await ensureBucket();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
