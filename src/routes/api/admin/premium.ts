import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notify";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

// Premium başvuru yönetimi (admin). Onay markanın premium bayrağını açar.
export const Route = createFileRoute("/api/admin/premium")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const status = new URL(request.url).searchParams.get("status") ?? "pending";

          const rows = await db
            .select({
              id: schema.premiumRequests.id,
              brand_id: schema.premiumRequests.brandId,
              brand_name: schema.brands.name,
              brand_slug: schema.brands.slug,
              plan: schema.premiumRequests.plan,
              status: schema.premiumRequests.status,
              note: schema.premiumRequests.note,
              requested_by: schema.premiumRequests.requestedBy,
              created_at: schema.premiumRequests.createdAt,
            })
            .from(schema.premiumRequests)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.premiumRequests.brandId))
            .where(eq(schema.premiumRequests.status, status as "pending" | "approved" | "rejected" | "cancelled"))
            .orderBy(desc(schema.premiumRequests.createdAt))
            .limit(100);

          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Onayla / reddet.
      PATCH: async ({ request }) => {
        try {
          const staff = await requireStaff(request);
          const b = (await request.json()) as { id?: string; decision?: "approved" | "rejected" };
          if (!b.id) throw new HttpError(400, "Başvuru belirtilmeli");
          if (b.decision !== "approved" && b.decision !== "rejected")
            throw new HttpError(400, "Geçersiz karar");

          const [req] = await db
            .select({
              id: schema.premiumRequests.id,
              brandId: schema.premiumRequests.brandId,
              requestedBy: schema.premiumRequests.requestedBy,
              status: schema.premiumRequests.status,
              plan: schema.premiumRequests.plan,
            })
            .from(schema.premiumRequests)
            .where(eq(schema.premiumRequests.id, b.id))
            .limit(1);
          if (!req) throw new HttpError(404, "Başvuru bulunamadı");
          if (req.status !== "pending") throw new HttpError(409, "Bu başvuru zaten sonuçlanmış");

          await db
            .update(schema.premiumRequests)
            .set({ status: b.decision, decidedBy: staff.id, decidedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.premiumRequests.id, req.id));

          if (b.decision === "approved") {
            // Markayı premium yap (bir yıllık; süreyi admin sonra düzenleyebilir).
            await db
              .update(schema.brands)
              .set({
                premium: true,
                tier: req.plan,
                premiumUntil: new Date(Date.now() + 365 * 86400_000),
                updatedAt: new Date(),
              })
              .where(eq(schema.brands.id, req.brandId));
          }

          await notify({
            userId: req.requestedBy,
            type: "system",
            title: b.decision === "approved" ? "Premium başvurunuz onaylandı" : "Premium başvurunuz reddedildi",
            body:
              b.decision === "approved"
                ? "Firmanız artık premium. Ayrıcalıklar aktif edildi."
                : "Başvurunuz onaylanmadı. Detay için bizimle iletişime geçebilirsiniz.",
            link: "/brand",
          });

          await audit(request, staff.id, {
            action: `premium.${b.decision}`,
            entityType: "brand",
            entityId: req.brandId,
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
