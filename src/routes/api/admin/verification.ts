import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { provisionBrandPortalAccess, resolveBrandForApproval } from "@/lib/server/brand-application";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/**
 * Firma doğrulama / marka başvuru talepleri.
 * `?brandId=` verilirse o firmanın belgeleri döner.
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
            telegram: r.v.telegram,
            address: r.v.address,
            photo_url: r.v.photoUrl,
            request_type: r.v.requestType,
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

      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            approve?: boolean;
            reviewerNote?: string | null;
            assignBrandId?: string | null;
            createBrand?: { name?: string; website?: string | null; slug?: string | null } | null;
            memberRole?: "manager" | "agent" | "owner";
          };
          if (!b.id) throw new HttpError(400, "Başvuru belirtilmeli");
          if (typeof b.approve !== "boolean") throw new HttpError(400, "Geçersiz karar");

          const [reqRow] = await db
            .select()
            .from(schema.brandVerificationRequests)
            .where(eq(schema.brandVerificationRequests.id, b.id))
            .limit(1);
          if (!reqRow) throw new HttpError(404, "Başvuru bulunamadı");

          const status: "approved" | "rejected" = b.approve ? "approved" : "rejected";
          let brandId = reqRow.brandId;
          let credentials: { email: string; password: string } | null = null;

          if (b.approve) {
            brandId = await resolveBrandForApproval({
              assignBrandId: b.assignBrandId,
              createBrand: b.createBrand?.name
                ? {
                    name: b.createBrand.name,
                    website: b.createBrand.website,
                    slug: b.createBrand.slug,
                  }
                : null,
              fallbackBrandId: reqRow.brandId,
            });

            if (reqRow.requestType === "brand_application") {
              credentials = await provisionBrandPortalAccess({
                brandId,
                userId: reqRow.submittedBy,
                email: reqRow.email,
                contactName: reqRow.contactName,
                phone: reqRow.phone,
                memberRole: b.memberRole ?? "manager",
              });
            } else {
              await db
                .update(schema.brands)
                .set({ verified: true, updatedAt: new Date() })
                .where(eq(schema.brands.id, brandId));
            }
          }

          const [updated] = await db
            .update(schema.brandVerificationRequests)
            .set({
              brandId,
              status,
              reviewerId: user.id,
              reviewerNote: b.reviewerNote?.trim().slice(0, 2000) || null,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.brandVerificationRequests.id, b.id))
            .returning({ id: schema.brandVerificationRequests.id });

          await audit(request, user.id, {
            action: `verification.${status}`,
            entityType: "brand",
            entityId: brandId,
            severity: "warn",
          });

          return Response.json({ ok: true, brandId, credentials });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
