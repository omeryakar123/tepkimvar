import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/**
 * Firma doğrulama başvuruları.
 * `?brandId=` verilirse o firmanın belgeleri döner — belge yolları YALNIZCA
 * personele açıktır (dosyanın kendisi /api/files/<path> ucundan servis edilir).
 */
export const Route = createFileRoute("/api/admin/verification")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const brandId = new URL(request.url).searchParams.get("brandId");

          if (brandId) {
            const documents = await db
              .select({
                id: schema.brandDocuments.id,
                doc_type: schema.brandDocuments.docType,
                storage_path: schema.brandDocuments.storagePath,
                created_at: schema.brandDocuments.createdAt,
              })
              .from(schema.brandDocuments)
              .where(eq(schema.brandDocuments.brandId, brandId))
              .orderBy(desc(schema.brandDocuments.createdAt));
            return Response.json({ documents });
          }

          const rows = await db
            .select({ v: schema.brandVerificationRequests, b: schema.brands })
            .from(schema.brandVerificationRequests)
            .leftJoin(
              schema.brands,
              eq(schema.brandVerificationRequests.brandId, schema.brands.id),
            )
            .orderBy(desc(schema.brandVerificationRequests.createdAt));

          const items = rows.map((r) => ({
            id: r.v.id,
            brand_id: r.v.brandId,
            submitted_by: r.v.submittedBy,
            company_name: r.v.companyName,
            contact_name: r.v.contactName,
            phone: r.v.phone,
            email: r.v.email,
            website: r.v.website,
            message: r.v.message,
            status: r.v.status,
            reviewer_note: r.v.reviewerNote,
            created_at: r.v.createdAt,
            brands: r.b ? { name: r.b.name, slug: r.b.slug } : null,
          }));

          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Onayla / reddet. reviewer_id istemciden ALINMAZ — oturumdan.
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            approve?: boolean;
            reviewerNote?: string | null;
          };
          if (!b.id) throw new HttpError(400, "Başvuru belirtilmeli");
          if (typeof b.approve !== "boolean") throw new HttpError(400, "Geçersiz karar");

          const status: "approved" | "rejected" = b.approve ? "approved" : "rejected";

          const [updated] = await db
            .update(schema.brandVerificationRequests)
            .set({
              status,
              reviewerId: user.id,
              reviewerNote: b.reviewerNote?.trim().slice(0, 2000) || null,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.brandVerificationRequests.id, b.id))
            .returning({
              id: schema.brandVerificationRequests.id,
              brandId: schema.brandVerificationRequests.brandId,
            });
          if (!updated) throw new HttpError(404, "Başvuru bulunamadı");

          // Rozet: marka id'si başvuru kaydından okunur, istemciden değil.
          if (b.approve) {
            await db
              .update(schema.brands)
              .set({ verified: true, updatedAt: new Date() })
              .where(eq(schema.brands.id, updated.brandId));
          }

          await audit(request, user.id, {
            action: `verification.${status}`,
            entityType: "brand",
            entityId: updated.brandId,
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
