import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordStatusChange } from "@/lib/server/history";
import { notifyComplaintOwner } from "@/lib/server/notify";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";

// schema.complaintStatus enum ile birebir. İstemciden gelen değer BURADA doğrulanır.
const STATUSES = [
  "pending",
  "approved",
  "in_review",
  "answered",
  "resolved",
  "rejected",
  "spam",
  "user_replied",
  "super_admin_review",
  "escalated",
  "archived",
] as const;
type Status = (typeof STATUSES)[number];

const SOURCES = ["organic", "bot", "all"] as const;
type Source = (typeof SOURCES)[number];

function sourceFilter(source: Source): SQL | undefined {
  if (source === "organic") return eq(schema.complaints.isSynthetic, false);
  if (source === "bot") return eq(schema.complaints.isSynthetic, true);
  return undefined;
}

export const Route = createFileRoute("/api/admin/complaints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const p = new URL(request.url).searchParams;

          const page = Math.max(1, Number(p.get("page")) || 1);
          const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize")) || 12));
          const status = p.get("status") ?? "";
          const q = (p.get("q") ?? "").trim();
          const sourceParam = (p.get("source") ?? "organic") as Source;
          if (!SOURCES.includes(sourceParam)) throw new HttpError(400, "Geçersiz kaynak filtresi");

          const conditions: SQL[] = [];
          const src = sourceFilter(sourceParam);
          if (src) conditions.push(src);
          if (status) {
            if (!STATUSES.includes(status as Status)) throw new HttpError(400, "Geçersiz durum");
            conditions.push(eq(schema.complaints.status, status as Status));
          }
          if (q) conditions.push(ilike(schema.complaints.title, `%${q}%`));
          const where = conditions.length ? and(...conditions) : undefined;

          const rows = await db
            .select({
              id: schema.complaints.id,
              title: schema.complaints.title,
              status: schema.complaints.status,
              created_at: schema.complaints.createdAt,
              brand_id: schema.complaints.brandId,
              user_id: schema.complaints.userId,
              is_synthetic: schema.complaints.isSynthetic,
              brand_name: schema.brands.name,
            })
            .from(schema.complaints)
            .leftJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
            .where(where)
            .orderBy(desc(schema.complaints.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(where);

          return Response.json({ items: rows, total: Number(count), source: sourceParam });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { id?: string; status?: string };
          if (!b.id) throw new HttpError(400, "Şikayet belirtilmeli");
          if (!STATUSES.includes(b.status as Status)) throw new HttpError(400, "Geçersiz durum");

          const [before] = await db
            .select({
              status: schema.complaints.status,
              brandId: schema.complaints.brandId,
              isPublic: schema.complaints.isPublic,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.id))
            .limit(1);
          if (!before) throw new HttpError(404, "Şikayet bulunamadı");

          const nextStatus = b.status as Status;
          const patch: Partial<typeof schema.complaints.$inferInsert> = {
            status: nextStatus,
            updatedAt: new Date(),
          };
          if (nextStatus === "approved") patch.isPublic = true;
          if (nextStatus === "rejected" || nextStatus === "spam") patch.isPublic = false;

          await db.update(schema.complaints).set(patch).where(eq(schema.complaints.id, b.id));

          await refreshBrandAggregates(before.brandId);

          await recordStatusChange({
            complaintId: b.id,
            fromStatus: before.status,
            toStatus: b.status as Status,
            changedBy: user.id,
            actorRole: "admin",
          });
          await notifyComplaintOwner(b.id, {
            type: "status_change",
            title:
              b.status === "approved"
                ? "Şikayetiniz yayınlandı"
                : "Şikayetinizin durumu güncellendi",
            body: `Yeni durum: ${b.status}`,
            skipIfSameAs: user.id,
          });

          await audit(request, user.id, {
            action: "complaint.status",
            entityType: "complaint",
            entityId: b.id,
            metadata: { from: before.status, to: b.status },
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json().catch(() => ({}))) as { id?: string };
          if (!b.id) throw new HttpError(400, "Şikayet belirtilmeli");

          const [deleted] = await db
            .delete(schema.complaints)
            .where(eq(schema.complaints.id, b.id))
            .returning({ id: schema.complaints.id, brandId: schema.complaints.brandId });
          if (!deleted) throw new HttpError(404, "Şikayet bulunamadı");

          // Silinen şikayet marka sayaçlarından da düşmeli.
          await refreshBrandAggregates(deleted.brandId);

          await audit(request, user.id, {
            action: "complaint.delete",
            entityType: "complaint",
            entityId: deleted.id,
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
