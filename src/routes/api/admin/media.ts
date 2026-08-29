import { createFileRoute } from "@tanstack/react-router";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { deleteObject, ensureBucket, listObjects } from "@/lib/server/storage";

/**
 * Medya kütüphanesi (MinIO). Yükleme /api/upload üzerinden yapılır.
 * Silme YALNIZCA CMS medya klasörleriyle sınırlı: bu uçtan şikayet
 * kanıtları veya marka belgeleri silinemez.
 */
const MEDIA_FOLDERS = ["banner-images", "blog-images"] as const;
type MediaFolder = (typeof MEDIA_FOLDERS)[number];

const MIME: Record<string, string> = {
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

function mimeOf(key: string): string | undefined {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext];
}

export const Route = createFileRoute("/api/admin/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const folder = new URL(request.url).searchParams.get("folder") ?? "banner-images";
          if (!MEDIA_FOLDERS.includes(folder as MediaFolder))
            throw new HttpError(400, "Geçersiz klasör");

          await ensureBucket();
          const rows = await listObjects(`${folder}/`, 100);

          const items = rows
            .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
            .map((o) => ({
              name: o.key,
              id: null,
              updated_at: o.lastModified.toISOString(),
              metadata: { size: o.size, mimetype: mimeOf(o.key) },
            }));

          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json().catch(() => ({}))) as { key?: string };
          const key = (b.key ?? "").trim();
          if (!key || key.includes("..")) throw new HttpError(400, "Geçersiz dosya");

          const folder = key.split("/")[0];
          if (!MEDIA_FOLDERS.includes(folder as MediaFolder))
            throw new HttpError(403, "Bu dosya buradan silinemez");

          await deleteObject(key);
          await audit(request, user.id, {
            action: "media.delete",
            entityType: "media",
            entityId: key,
            severity: "warn",
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
