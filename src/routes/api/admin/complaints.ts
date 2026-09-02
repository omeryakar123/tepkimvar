import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordStatusChange } from "@/lib/server/history";
import { notifyComplaintOwner } from "@/lib/server/notify";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";
import { loadAuthorProfile } from "@/lib/server/author-profile";
import { displayPhone } from "@/lib/phone-mask";
import { normalizePlatformUsername } from "@/lib/server/ai/prompts";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sourceFilter(source: Source): SQL | undefined {
  if (source === "organic") return eq(schema.complaints.isSynthetic, false);
  if (source === "bot") return eq(schema.complaints.isSynthetic, true);
  return undefined;
}

function textField(v: unknown, max: number, label: string): string {
  if (typeof v !== "string") throw new HttpError(400, `Geçersiz ${label}`);
  const s = v.trim();
  if (!s) throw new HttpError(400, `${label} boş olamaz`);
  return s.slice(0, max);
}

function optionalText(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new HttpError(400, "Geçersiz metin");
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export const Route = createFileRoute("/api/admin/complaints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const p = new URL(request.url).searchParams;

          const detailId = p.get("id");
          if (detailId) {
            if (!UUID_RE.test(detailId)) throw new HttpError(400, "Geçersiz şikayet");

            const [row] = await db
              .select({
                id: schema.complaints.id,
                public_id: schema.complaints.publicId,
                title: schema.complaints.title,
                body: schema.complaints.body,
                status: schema.complaints.status,
                created_at: schema.complaints.createdAt,
                updated_at: schema.complaints.updatedAt,
                brand_id: schema.complaints.brandId,
                brand_name: schema.brands.name,
                brand_slug: schema.brands.slug,
                user_id: schema.complaints.userId,
                user_email: schema.user.email,
                is_anonymous: schema.complaints.isAnonymous,
                anon_name: schema.complaints.anonName,
                platform_username: schema.complaints.platformUsername,
                contact_phone: schema.complaints.contactPhone,
                city: schema.complaints.city,
                rating: schema.complaints.rating,
                is_public: schema.complaints.isPublic,
                is_synthetic: schema.complaints.isSynthetic,
                hidden: schema.complaints.hidden,
                sensitive: schema.complaints.sensitive,
                admin_notes: schema.complaints.adminNotes,
                brand_response: schema.complaints.brandResponse,
                brand_response_at: schema.complaints.brandResponseAt,
                tags: schema.complaints.tags,
              })
              .from(schema.complaints)
              .innerJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
              .innerJoin(schema.user, eq(schema.user.id, schema.complaints.userId))
              .where(eq(schema.complaints.id, detailId))
              .limit(1);
            if (!row) throw new HttpError(404, "Şikayet bulunamadı");

            const author = row.is_anonymous ? null : await loadAuthorProfile(row.user_id);

            return Response.json({
              complaint: {
                ...row,
                platform_username: row.platform_username
                  ? normalizePlatformUsername(row.platform_username)
                  : null,
                contact_phone_display: displayPhone(row.contact_phone, "full"),
                author,
              },
            });
          }

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
          const b = (await request.json()) as {
            id?: string;
            status?: string;
            title?: string;
            body?: string;
            admin_notes?: string | null;
            platform_username?: string | null;
          };
          if (!b.id) throw new HttpError(400, "Şikayet belirtilmeli");

          const [before] = await db
            .select({
              status: schema.complaints.status,
              brandId: schema.complaints.brandId,
              isPublic: schema.complaints.isPublic,
              title: schema.complaints.title,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.id))
            .limit(1);
          if (!before) throw new HttpError(404, "Şikayet bulunamadı");

          const patch: Partial<typeof schema.complaints.$inferInsert> = {
            updatedAt: new Date(),
          };
          const editFields: string[] = [];

          if (b.title !== undefined) {
            const title = textField(b.title, 200, "Başlık");
            if (title.length < 6) throw new HttpError(400, "Başlık en az 6 karakter olmalı");
            patch.title = title;
            editFields.push("title");
          }
          if (b.body !== undefined) {
            const body = textField(b.body, 5000, "Şikayet metni");
            if (body.length < 20) throw new HttpError(400, "Şikayet detayı en az 20 karakter olmalı");
            patch.body = body;
            editFields.push("body");
          }
          if (b.admin_notes !== undefined) {
            patch.adminNotes = optionalText(b.admin_notes, 5000);
            editFields.push("admin_notes");
          }
          if (b.platform_username !== undefined) {
            const raw = optionalText(b.platform_username, 80);
            patch.platformUsername = raw ? normalizePlatformUsername(raw) : null;
            editFields.push("platform_username");
          }

          if (b.status !== undefined) {
            if (!STATUSES.includes(b.status as Status)) throw new HttpError(400, "Geçersiz durum");
            const nextStatus = b.status as Status;
            patch.status = nextStatus;
            if (nextStatus === "approved") patch.isPublic = true;
            if (nextStatus === "rejected" || nextStatus === "spam") patch.isPublic = false;
          }

          if (editFields.length === 0 && b.status === undefined) {
            throw new HttpError(400, "Güncellenecek alan belirtilmeli");
          }

          await db.update(schema.complaints).set(patch).where(eq(schema.complaints.id, b.id));

          await refreshBrandAggregates(before.brandId);

          if (b.status !== undefined && b.status !== before.status) {
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
          }

          if (editFields.length > 0) {
            await audit(request, user.id, {
              action: "complaint.edit",
              entityType: "complaint",
              entityId: b.id,
              metadata: { fields: editFields },
            });
          }

          if (b.status !== undefined) {
            await audit(request, user.id, {
              action: "complaint.status",
              entityType: "complaint",
              entityId: b.id,
              metadata: { from: before.status, to: b.status },
            });
          }

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
