/**
 * S3/MinIO yoksa veya STORAGE_BACKEND=local ise dosyalar konteyner diski/volume'da tutulur.
 * Coolify'da kalıcılık için /app/data/storage dizinine persistent volume bağlayın.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const LOCAL_ROOT =
  process.env.STORAGE_LOCAL_PATH?.trim() ||
  path.join(process.cwd(), "data", "storage");

function safeKey(key: string): string {
  const n = key.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!n || n.includes("..")) throw new Error("Geçersiz dosya anahtarı");
  return n;
}

function filePath(key: string): string {
  return path.join(LOCAL_ROOT, ...safeKey(key).split("/"));
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

export function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export async function ensureLocalRoot(): Promise<void> {
  await fs.mkdir(LOCAL_ROOT, { recursive: true });
}

export async function localPutObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await ensureLocalRoot();
  const fp = filePath(key);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body);
  await fs.writeFile(`${fp}.ctype`, contentType, "utf8");
}

export async function localGetObject(key: string) {
  const fp = filePath(key);
  const buf = await fs.readFile(fp);
  let contentType = mimeFromKey(key);
  try {
    contentType = (await fs.readFile(`${fp}.ctype`, "utf8")).trim() || contentType;
  } catch {
    /* uzantıdan tahmin */
  }
  return {
    Body: { transformToByteArray: async () => buf },
    ContentType: contentType,
  };
}

export async function localDeleteObject(key: string): Promise<void> {
  const fp = filePath(key);
  await fs.unlink(fp).catch(() => {});
  await fs.unlink(`${fp}.ctype`).catch(() => {});
}

export async function localListObjects(
  prefix: string,
  maxKeys = 100,
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  await ensureLocalRoot();
  const base = filePath(prefix.endsWith("/") ? prefix : `${prefix}/`);
  const out: { key: string; size: number; lastModified: Date }[] = [];

  async function walk(dir: string, relPrefix: string) {
    if (out.length >= maxKeys) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= maxKeys) break;
      const abs = path.join(dir, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(abs, rel);
      } else if (!ent.name.endsWith(".ctype")) {
        const st = await fs.stat(abs);
        out.push({ key: rel.replace(/\\/g, "/"), size: st.size, lastModified: st.mtime });
      }
    }
  }

  await walk(base, prefix.replace(/\/$/, ""));
  return out.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}
