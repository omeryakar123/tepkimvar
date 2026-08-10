import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  HttpError,
  errorResponse,
  isBrandMember,
  isStaff,
  rateLimit,
  requireUser,
} from "@/lib/server/guard";
import { putObject, sanitizeName, validateUpload } from "@/lib/server/storage";

/**
 * Dosya yükleme (MinIO). GÜVENLİK:
 *  - oturum zorunlu + rate limit
 *  - tür/boyut doğrulaması SUNUCUDA (istemci kontrolü atlanabilir)
 *  - complaint-* klasörlerine yalnızca şikayet SAHİBİ yükleyebilir
 *    (eskiden herkes başkasının klasörüne yükleyebiliyordu)
 *  - avatar yalnızca kendi klasörüne
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`upload:${user.id}`, 30, 60 * 60_000);

          const form = await request.formData();
          const file = form.get("file");
          const folder = String(form.get("folder") ?? "");
          const complaintId = (form.get("complaintId") as string) || null;
          const replyId = (form.get("replyId") as string) || null;
          const brandId = (form.get("brandId") as string) || null;
          const visibility = (form.get("visibility") as string) || "public";

          if (!(file instanceof File)) throw new HttpError(400, "Dosya bulunamadı");

          const check = validateUpload(folder, file.type, file.size);
          if (!check.ok) throw new HttpError(400, check.error);

          // Sahiplik kuralları
          let prefix: string;
          if (folder === "complaint-images" || folder === "complaint-files") {
            if (!complaintId || !UUID_RE.test(complaintId))
              throw new HttpError(400, "Şikayet belirtilmeli");
            const [c] = await db
              .select({
                id: schema.complaints.id,
                userId: schema.complaints.userId,
                brandId: schema.complaints.brandId,
              })
              .from(schema.complaints)
              .where(eq(schema.complaints.id, complaintId))
              .limit(1);
            if (!c) throw new HttpError(404, "Şikayet bulunamadı");
            // Sahibi, ilgili markanın temsilcisi veya personel yükleyebilir.
            const allowed =
              c.userId === user.id ||
              (await isBrandMember(user.id, c.brandId)) ||
              (await isStaff(user.id));
            if (!allowed) throw new HttpError(403, "Bu şikayete dosya ekleyemezsiniz");
            prefix = `${folder}/${complaintId}`;
          } else if (folder === "brand-logos" || folder === "brand-covers" || folder === "brand-gallery") {
            // Marka görselleri: yalnızca o markanın temsilcisi veya personel.
            // brandId istemciden gelir; üyelik doğrulanmadan ASLA kullanılmaz.
            if (!brandId || !UUID_RE.test(brandId)) throw new HttpError(400, "Firma belirtilmeli");
            const [b] = await db
              .select({ id: schema.brands.id })
              .from(schema.brands)
              .where(eq(schema.brands.id, brandId))
              .limit(1);
            if (!b) throw new HttpError(404, "Firma bulunamadı");
            if (!(await isBrandMember(user.id, brandId)) && !(await isStaff(user.id)))
              throw new HttpError(403, "Bu firmaya erişiminiz yok");
            prefix = `${folder}/${brandId}`;
          } else if (folder === "avatars") {
            prefix = `avatars/${user.id}`;
          } else {
            // blog/banner/marka-belge klasörleri yalnızca personel
            if (!(await isStaff(user.id))) throw new HttpError(403, "Yetkiniz yok");
            prefix = folder;
          }

          const key = `${prefix}/${Date.now()}-${sanitizeName(file.name)}`;
          const buf = Buffer.from(await file.arrayBuffer());
          await putObject(key, buf, file.type);

          // Şikayet eklerini kayda geç
          if (complaintId) {
            const vis = ["public", "brand_only", "super_admin_only"].includes(visibility)
              ? (visibility as "public" | "brand_only" | "super_admin_only")
              : "public";
            // replyId verildiyse gerçekten bu şikayete ait olmalı.
            let linkedReplyId: string | null = null;
            if (replyId && UUID_RE.test(replyId)) {
              const [r] = await db
                .select({ id: schema.complaintReplies.id })
                .from(schema.complaintReplies)
                .where(
                  and(
                    eq(schema.complaintReplies.id, replyId),
                    eq(schema.complaintReplies.complaintId, complaintId),
                  ),
                )
                .limit(1);
              linkedReplyId = r?.id ?? null;
            }

            await db.insert(schema.complaintAttachments).values({
              complaintId,
              replyId: linkedReplyId,
              uploaderId: user.id,
              storagePath: key,
              fileType: file.type,
              fileSize: file.size,
              visibility: vis,
            });
          }

          return Response.json({ key, url: `/api/files/${key}` }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
