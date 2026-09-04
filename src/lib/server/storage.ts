/**
 * Depolama katmanı — S3/MinIO veya yerel disk (volume).
 *
 * Coolify'da MinIO ayrı stack ise S3_* env'leri + aynı Docker ağı gerekir.
 * MinIO yoksa STORAGE_BACKEND=local (varsayılan) ile /app/data/storage kullanılır;
 * kalıcılık için Coolify'da bu dizine persistent volume bağlayın.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  LOCAL_ROOT,
  ensureLocalRoot,
  localDeleteObject,
  localGetObject,
  localListObjects,
  localPutObject,
} from "@/lib/server/storage-local";

export type StorageBackend = "s3" | "local";

const endpoint = process.env.S3_ENDPOINT?.trim() || "";
export const BUCKET = process.env.S3_BUCKET || "itirazvar";

let resolvedBackend: StorageBackend | null = null;

/** S3 yalnızca üç env de açıkça tanımlıysa tercih edilir. */
export function getPreferredStorageBackend(): StorageBackend {
  const forced = process.env.STORAGE_BACKEND?.trim().toLowerCase();
  if (forced === "local" || forced === "s3") return forced;
  const key = process.env.S3_ACCESS_KEY_ID?.trim();
  const secret = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (endpoint && key && secret) return "s3";
  return "local";
}

/** Gerçek backend — S3 erişilemezse otomatik yerel diske düşer. */
export async function getStorageBackend(): Promise<StorageBackend> {
  if (resolvedBackend) return resolvedBackend;
  const preferred = getPreferredStorageBackend();
  if (preferred === "local") {
    resolvedBackend = "local";
    return "local";
  }
  const forced = process.env.STORAGE_BACKEND?.trim().toLowerCase();
  if (forced === "s3") {
    await ensureS3Bucket();
    await s3ProbeWrite();
    resolvedBackend = "s3";
    return "s3";
  }
  try {
    await ensureS3Bucket();
    await s3ProbeWrite();
    resolvedBackend = "s3";
  } catch (e) {
    console.warn("[storage] S3 erişilemedi, yerel diske düşülüyor:", e);
    resolvedBackend = "local";
  }
  return resolvedBackend;
}

/** Senkron özet (log için); çözümlenmemişse tercih edilen backend. */
export function getStorageBackendSync(): StorageBackend {
  return resolvedBackend ?? getPreferredStorageBackend();
}

export function storageConfigSummary() {
  const backend = getStorageBackendSync();
  return {
    preferred: getPreferredStorageBackend(),
    active: backend,
    endpoint: backend === "s3" ? endpoint : null,
    bucket: backend === "s3" ? BUCKET : null,
    localPath: backend === "local" ? LOCAL_ROOT : null,
  };
}

export const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: endpoint || "http://127.0.0.1:9",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "unused",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "unused",
  },
});

let bucketReady = false;

async function ensureS3Bucket(): Promise<void> {
  if (bucketReady) return;
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  bucketReady = true;
}

async function s3ProbeWrite(): Promise<void> {
  const key = `_health/${Date.now()}.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from("ok"),
      ContentType: "text/plain",
    }),
  );
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function ensureBucket(): Promise<void> {
  if ((await getStorageBackend()) === "local") {
    await ensureLocalRoot();
    return;
  }
  try {
    await ensureS3Bucket();
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    bucketReady = true;
  }
}

/** Başlangıç / admin teşhisi için kısa yazma testi. */
export async function testStorageWrite(): Promise<void> {
  const probeKey = `_health/${Date.now()}.txt`;
  const body = Buffer.from("ok");
  await putObject(probeKey, body, "text/plain");
  await deleteObject(probeKey);
}

export const FOLDERS = [
  "avatars",
  "brand-logos",
  "brand-covers",
  "brand-gallery",
  "banner-images",
  "blog-images",
  "complaint-images",
  "complaint-files",
  "complaint-evidence",
  "brand-documents",
  "brand-application-photos",
  "brand-videos",
] as const;
export type Folder = (typeof FOLDERS)[number];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function validateUpload(
  folder: string,
  contentType: string,
  size: number,
): { ok: true; folder: Folder } | { ok: false; error: string } {
  if (!FOLDERS.includes(folder as Folder)) return { ok: false, error: "Geçersiz klasör" };

  if (folder === "brand-videos") {
    if (!VIDEO_TYPES.includes(contentType))
      return { ok: false, error: "Sadece video yükleyebilirsiniz (mp4, webm, mov)" };
    if (size > MAX_VIDEO_BYTES) return { ok: false, error: "Video en fazla 100 MB olabilir" };
    return { ok: true, folder: folder as Folder };
  }

  if (folder === "complaint-evidence") {
    if (VIDEO_TYPES.includes(contentType)) {
      if (size > MAX_VIDEO_BYTES) return { ok: false, error: "Video en fazla 100 MB olabilir" };
      return { ok: true, folder: folder as Folder };
    }
    if (IMAGE_TYPES.includes(contentType)) {
      if (size > MAX_IMAGE_BYTES) return { ok: false, error: "Görsel en fazla 10 MB olabilir" };
      return { ok: true, folder: folder as Folder };
    }
    if (contentType === "application/pdf") {
      if (size > MAX_FILE_BYTES) return { ok: false, error: "PDF en fazla 25 MB olabilir" };
      return { ok: true, folder: folder as Folder };
    }
    return { ok: false, error: "Kanıt olarak görsel, video veya PDF yükleyebilirsiniz" };
  }

  const isImageFolder = folder !== "complaint-files" && folder !== "brand-documents";

  if (isImageFolder) {
    if (!IMAGE_TYPES.includes(contentType))
      return { ok: false, error: "Sadece görsel yükleyebilirsiniz (SVG hariç)" };
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

export function inferContentType(file: File): string {
  const t = file.type?.trim();
  if (t) return t;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

function s3ErrorHint(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect/i.test(msg)) {
    return (
      `MinIO/S3'e bağlanılamadı (${endpoint}). Coolify'da MinIO stack'inin deploy edildiğinden, ` +
      `uygulamanın aynı Docker ağına bağlı olduğundan ve S3_ENDPOINT=http://minio:9000 olduğundan emin olun. ` +
      `Alternatif: STORAGE_BACKEND=local + /app/data/storage volume.`
    );
  }
  if (/InvalidAccessKeyId|SignatureDoesNotMatch|Access Denied/i.test(msg)) {
    return "S3 kimlik bilgileri hatalı. S3_ACCESS_KEY_ID ve S3_SECRET_ACCESS_KEY değerlerini kontrol edin.";
  }
  return `Depolama hatası: ${msg}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if ((await getStorageBackend()) === "local") {
    await localPutObject(key, body, contentType);
    return;
  }
  try {
    await ensureBucket();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition:
          contentType.startsWith("image/") || contentType.startsWith("video/")
            ? "inline"
            : "attachment",
      }),
    );
  } catch (e) {
    console.error("[storage] putObject S3 failed:", key, e);
    throw new Error(s3ErrorHint(e));
  }
}

export async function getObject(key: string) {
  if ((await getStorageBackend()) === "local") {
    await ensureLocalRoot();
    return localGetObject(key);
  }
  await ensureBucket();
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deleteObject(key: string): Promise<void> {
  if ((await getStorageBackend()) === "local") {
    await localDeleteObject(key);
    return;
  }
  await ensureBucket();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function listObjects(prefix: string, maxKeys = 100) {
  if ((await getStorageBackend()) === "local") {
    return localListObjects(prefix, maxKeys);
  }
  await ensureBucket();
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: maxKeys }),
  );
  return (res.Contents ?? [])
    .filter((o) => o.Key && !o.Key.endsWith("/"))
    .map((o) => ({
      key: o.Key as string,
      size: o.Size ?? 0,
      lastModified: o.LastModified ?? new Date(0),
    }));
}

/** Sunucu ayağa kalkarken backend seçimini logla. */
export async function logStorageBackendOnce(): Promise<void> {
  if (logged) return;
  logged = true;
  const b = await getStorageBackend();
  const cfg = storageConfigSummary();
  console.log(
    `[storage] active=${b} preferred=${cfg.preferred}`,
    b === "s3" ? `endpoint=${cfg.endpoint} bucket=${cfg.bucket}` : `path=${cfg.localPath}`,
  );
}
let logged = false;
