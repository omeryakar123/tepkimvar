import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { deleteObject } from "@/lib/server/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/complaint-attachments")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            sensitive?: boolean;
            visibility?: "public" | "brand_only" | "super_admin_only";
          };

          if (!b.id || !UUID_RE.test(b.id)) throw new HttpError(400, "Geçersiz ek");

          const patch: Partial<{
            sensitive: boolean;
            visibility: "public" | "brand_only" | "super_admin_only";
          }> = {};

          if (typeof b.sensitive === "boolean") patch.sensitive = b.sensitive;
          if (b.visibility) {
            if (!["public", "brand_only", "super_admin_only"].includes(b.visibility)) {
              throw new HttpError(400, "Geçersiz görünürlük");
            }
            patch.visibility = b.visibility;
          }

          if (Object.keys(patch).length === 0) throw new HttpError(400, "Güncellenecek alan yok");

          const [row] = await db
            .update(schema.complaintAttachments)
            .set(patch)
            .where(eq(schema.complaintAttachments.id, b.id))
            .returning({
              id: schema.complaintAttachments.id,
              complaintId: schema.complaintAttachments.complaintId,
            });

          if (!row) throw new HttpError(404, "Ek bulunamadı");

          await audit(request, user.id, {
            action: "complaint.attachment.update",
            entityType: "complaint_attachment",
            entityId: row.id,
            metadata: { complaintId: row.complaintId, ...patch },
          });

          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { id?: string };

          if (!b.id || !UUID_RE.test(b.id)) throw new HttpError(400, "Geçersiz ek");

          const [row] = await db
            .select({
              id: schema.complaintAttachments.id,
              complaintId: schema.complaintAttachments.complaintId,
              storagePath: schema.complaintAttachments.storagePath,
            })
            .from(schema.complaintAttachments)
            .where(eq(schema.complaintAttachments.id, b.id))
            .limit(1);

          if (!row) throw new HttpError(404, "Ek bulunamadı");

          await db.delete(schema.complaintAttachments).where(eq(schema.complaintAttachments.id, b.id));

          try {
            await deleteObject(row.storagePath);
          } catch {
            /* depolama silinemese de kayıt kaldırıldı */
          }

          await audit(request, user.id, {
            action: "complaint.attachment.delete",
            entityType: "complaint_attachment",
            entityId: row.id,
            metadata: { complaintId: row.complaintId, storagePath: row.storagePath },
          });

          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
