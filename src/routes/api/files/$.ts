import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, isBrandMember, isStaff, optionalUser } from "@/lib/server/guard";
import { getObject } from "@/lib/server/storage";

/**
 * Dosya servisi. Eski Supabase proxy'si (api/public/img) service-role ile
 * RLS'i bypass ediyor ve ek GÖRÜNÜRLÜĞÜNÜ hiç kontrol etmiyordu:
 * "super_admin_only" işaretli kanıt dosyaları bile yolu bilen herkese açıktı.
 * Burada görünürlük zorunlu olarak kontrol ediliyor.
 */
export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const key = (params as { _splat?: string })._splat ?? "";
          if (!key || key.includes("..")) return new Response("Not found", { status: 404 });

          // Marka başvuru fotoğrafları yalnızca personel + yükleyen görebilir.
          if (key.startsWith("brand-application-photos/")) {
            const user = await optionalUser(request);
            if (!user) return new Response("Not found", { status: 404 });
            const ownerPrefix = `brand-application-photos/${user.id}/`;
            const allowed = key.startsWith(ownerPrefix) || (await isStaff(user.id));
            if (!allowed) return new Response("Not found", { status: 404 });
          }

          // Bu dosya bir şikayet eki mi? Öyleyse görünürlük kuralını uygula.
          const [att] = await db
            .select({
              visibility: schema.complaintAttachments.visibility,
              uploaderId: schema.complaintAttachments.uploaderId,
              complaintId: schema.complaintAttachments.complaintId,
            })
            .from(schema.complaintAttachments)
            .where(eq(schema.complaintAttachments.storagePath, key))
            .limit(1);

          if (att && att.visibility !== "public") {
            const user = await optionalUser(request);
            if (!user) return new Response("Not found", { status: 404 });

            let allowed = att.uploaderId === user.id || (await isStaff(user.id));

            if (!allowed && att.visibility === "brand_only" && att.complaintId) {
              const [c] = await db
                .select({ brandId: schema.complaints.brandId })
                .from(schema.complaints)
                .where(eq(schema.complaints.id, att.complaintId))
                .limit(1);
              if (c) allowed = await isBrandMember(user.id, c.brandId);
            }
            // super_admin_only: yalnızca yükleyen + personel (yukarıda kapsandı)

            if (!allowed) return new Response("Not found", { status: 404 });
          }

          const obj = await getObject(key);
          if (!obj.Body) return new Response("Not found", { status: 404 });
          const buf = Buffer.from(await obj.Body.transformToByteArray());

          const type = obj.ContentType || "application/octet-stream";
          // SVG asla inline servis edilmez (stored-XSS).
          const safeType = type === "image/svg+xml" ? "application/octet-stream" : type;

          return new Response(buf, {
            headers: {
              "Content-Type": safeType,
              "Content-Disposition":
                safeType.startsWith("image/") || safeType.startsWith("video/")
                  ? "inline"
                  : "attachment",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": att && att.visibility !== "public"
                ? "private, no-store"
                : "public, max-age=3600, s-maxage=86400",
            },
          });
        } catch (e) {
          // Nesne yoksa S3 hata fırlatır
          if ((e as { name?: string })?.name === "NoSuchKey") {
            return new Response("Not found", { status: 404 });
          }
          return errorResponse(e);
        }
      },
    },
  },
});
