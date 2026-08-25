import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";

/** Super admin escalation incelemesi. Personel dışına kapalı. */

// Panelin sunduğu kararlar. Bilinmeyen aksiyon 400.
const ACTIONS = [
  "approve",
  "reject",
  "change_brand",
  "delete",
  "hide",
  "spam",
  "warn_user",
  "ban_user",
  "return",
] as const;
type Action = (typeof ACTIONS)[number];

export const Route = createFileRoute("/api/admin/escalations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);

          const rows = await db
            .select({
              e: schema.complaintEscalations,
              brandName: schema.brands.name,
              brandSlug: schema.brands.slug,
              complaintTitle: schema.complaints.title,
              complaintShortId: schema.complaints.shortId,
            })
            .from(schema.complaintEscalations)
            .leftJoin(schema.brands, eq(schema.complaintEscalations.brandId, schema.brands.id))
            .leftJoin(
              schema.complaints,
              eq(schema.complaintEscalations.complaintId, schema.complaints.id),
            )
            .orderBy(desc(schema.complaintEscalations.createdAt));

          const items = rows.map((r) => ({
            id: r.e.id,
            complaint_id: r.e.complaintId,
            brand_id: r.e.brandId,
            reason: r.e.reason,
            note: r.e.note,
            status: r.e.status,
            decision: r.e.decision,
            created_at: r.e.createdAt,
            brands: r.brandName ? { name: r.brandName, slug: r.brandSlug as string } : null,
            complaints: r.complaintTitle
              ? { title: r.complaintTitle, short_id: r.complaintShortId }
              : null,
          }));

          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Karar uygula. GÜVENLİK: decided_by istemciden ALINMAZ, oturumdan gelir;
      // şikayet id'si de escalation kaydından okunur (istemci gönderemez).
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { id?: string; action?: string; note?: string };
          if (!b.id) throw new HttpError(400, "Escalation belirtilmeli");
          if (!ACTIONS.includes(b.action as Action)) throw new HttpError(400, "Geçersiz işlem");
          const action = b.action as Action;
          const note = (b.note ?? "").trim().slice(0, 2000);

          const [esc] = await db
            .select({
              id: schema.complaintEscalations.id,
              complaintId: schema.complaintEscalations.complaintId,
              brandId: schema.complaintEscalations.brandId,
            })
            .from(schema.complaintEscalations)
            .where(eq(schema.complaintEscalations.id, b.id))
            .limit(1);
          if (!esc) throw new HttpError(404, "Escalation bulunamadı");

          let escStatus: "approved" | "rejected" | "returned" | "resolved" = "approved";
          if (action === "delete") escStatus = "resolved";
          else if (action === "return") escStatus = "returned";
          else if (action === "reject") escStatus = "rejected";

          // Önce escalation kaydı: "delete" aksiyonunda şikayet silinince bu satır
          // cascade ile gideceği için sıralama önemli.
          await db
            .update(schema.complaintEscalations)
            .set({
              decision: note ? `${action}: ${note}` : action,
              decidedBy: user.id,
              decidedAt: new Date(),
              status: escStatus,
              updatedAt: new Date(),
            })
            .where(eq(schema.complaintEscalations.id, esc.id));

          const cId = esc.complaintId;
          if (action === "delete") {
            await db.delete(schema.complaints).where(eq(schema.complaints.id, cId));
          } else if (action === "hide") {
            await db
              .update(schema.complaints)
              .set({ hidden: true, status: "archived", updatedAt: new Date() })
              .where(eq(schema.complaints.id, cId));
          } else if (action === "spam") {
            await db
              .update(schema.complaints)
              .set({ status: "spam", updatedAt: new Date() })
              .where(eq(schema.complaints.id, cId));
          } else if (action === "return") {
            await db
              .update(schema.complaints)
              .set({ status: "in_review", escalated: false, updatedAt: new Date() })
              .where(eq(schema.complaints.id, cId));
          } else if (action === "reject") {
            await db
              .update(schema.complaints)
              .set({ escalated: false, status: "in_review", updatedAt: new Date() })
              .where(eq(schema.complaints.id, cId));
          } else if (action === "approve") {
            await db
              .update(schema.complaints)
              .set({ status: "in_review", updatedAt: new Date() })
              .where(eq(schema.complaints.id, cId));
          }

          // Silme/spam/arşiv gibi aksiyonlar şikayeti sayaçlardan çıkarır.
          await refreshBrandAggregates(esc.brandId);

          await audit(request, user.id, {
            action: `escalation.${action}`,
            entityType: "complaint_escalations",
            entityId: esc.id,
            metadata: { action, note },
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
