import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordStatusChange } from "@/lib/server/history";
import { notifyComplaintOwner } from "@/lib/server/notify";
import {
  HttpError,
  errorResponse,
  isStaff,
  rateLimit,
  requireBrandAccess,
  requireUser,
} from "@/lib/server/guard";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** schema.ts -> complaint_status enum'unun tamamı. */
const ALL_STATUSES = [
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
type Status = (typeof ALL_STATUSES)[number];

/**
 * Marka temsilcisinin ATAYABİLECEĞİ durumlar (panel UI'ında görünenler +
 * escalate akışı). "approved" / "super_admin_review" gibi moderasyon
 * durumlarını yalnızca personel verebilir.
 */
const BRAND_STATUSES: readonly Status[] = [
  "pending",
  "in_review",
  "answered",
  "resolved",
  "rejected",
  "spam",
  "escalated",
];

const DEFAULT_PAGE_SIZE = 12;

/** Şikayeti bul + üzerindeki markaya erişimi doğrula. brandId İSTEMCİDEN ALINMAZ. */
async function loadComplaintWithAccess(userId: string, complaintId: string) {
  if (!UUID_RE.test(complaintId))
    throw new HttpError(400, "Şikayet belirtilmeli");
  const [c] = await db
    .select({
      id: schema.complaints.id,
      brandId: schema.complaints.brandId,
      status: schema.complaints.status,
      createdAt: schema.complaints.createdAt,
      firstResponseAt: schema.complaints.firstResponseAt,
    })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, complaintId))
    .limit(1);
  if (!c) throw new HttpError(404, "Şikayet bulunamadı");
  // Erişim, şikayetin GERÇEK brand_id'si üzerinden doğrulanır.
  await requireBrandAccess(userId, c.brandId);
  return c;
}

export const Route = createFileRoute("/api/brand/complaints")({
  server: {
    handlers: {
      /* ------------------------------ Liste ------------------------------ */
      // GET ?brandId=&page=&pageSize=&status=
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const p = new URL(request.url).searchParams;
          const brandId = p.get("brandId") ?? "";
          if (!UUID_RE.test(brandId))
            throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          const page = Math.max(1, Number(p.get("page")) || 1);
          const pageSize = Math.min(
            50,
            Math.max(1, Number(p.get("pageSize")) || DEFAULT_PAGE_SIZE),
          );

          const conditions: SQL[] = [eq(schema.complaints.brandId, brandId)];
          const statusParam = p.get("status");
          if (statusParam) {
            if (!ALL_STATUSES.includes(statusParam as Status))
              throw new HttpError(400, "Geçersiz durum");
            conditions.push(
              eq(schema.complaints.status, statusParam as Status),
            );
          }
          const where = and(...conditions);

          // PII: şikayetçiye ait hiçbir alan (user_id / ad / contact_phone)
          // döndürülmez — panelin ihtiyacı yok, anonimlik korunur.
          const rows = await db
            .select({
              id: schema.complaints.id,
              title: schema.complaints.title,
              body: schema.complaints.body,
              status: schema.complaints.status,
              created_at: schema.complaints.createdAt,
              short_id: schema.complaints.shortId,
              brand_response: schema.complaints.brandResponse,
              rating: schema.complaints.rating,
            })
            .from(schema.complaints)
            .where(where)
            .orderBy(desc(schema.complaints.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(where);

          return Response.json({ items: rows, total: Number(count) });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /* --------------------------- Durum güncelle ------------------------ */
      // GÜVENLİK: yalnızca `status` yazılır. title/body/user_id/votes/views/
      // rating/is_public/is_anonymous/contact_phone/hidden/sensitive/
      // admin_notes/public_id/short_id istemciden ASLA alınmaz (body spread yok).
      PATCH: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json()) as { id?: string; status?: string };
          if (!b.id) throw new HttpError(400, "Şikayet belirtilmeli");

          const c = await loadComplaintWithAccess(user.id, b.id);

          const status = b.status as Status | undefined;
          if (!status || !ALL_STATUSES.includes(status))
            throw new HttpError(400, "Geçersiz durum");
          const staff = await isStaff(user.id);
          if (!staff && !BRAND_STATUSES.includes(status))
            throw new HttpError(400, "Bu durumu atayamazsınız");

          await db
            .update(schema.complaints)
            .set({ status, updatedAt: new Date() })
            .where(eq(schema.complaints.id, c.id));

          await refreshBrandAggregates(c.brandId);

          await recordStatusChange({
            complaintId: c.id,
            fromStatus: c.status,
            toStatus: status,
            changedBy: user.id,
            actorRole: (await isStaff(user.id)) ? "admin" : "brand",
          });

          await notifyComplaintOwner(c.id, {
            type: "status_change",
            title: "Şikayetinizin durumu güncellendi",
            body: `Yeni durum: ${status}`,
            skipIfSameAs: user.id,
          });

          await db.insert(schema.auditLogs).values({
            userId: user.id,
            action: "complaint.status_change",
            entityType: "complaint",
            entityId: c.id,
            metadata: { status },
          });

          return Response.json({ ok: true, status });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /* ------------------------------ Yanıtla ---------------------------- */
      // Marka yanıtı. GÜVENLİK: user_id oturumdan, is_brand sunucuda true,
      // complaint_id'nin markası üyelikle doğrulanır.
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`brand-reply:${user.id}`, 120, 60 * 60_000);

          const b = (await request.json()) as {
            complaintId?: string;
            body?: string;
          };
          if (!b.complaintId) throw new HttpError(400, "Şikayet belirtilmeli");
          const text = (b.body ?? "").trim();
          if (!text) throw new HttpError(400, "Yanıt boş olamaz");

          const c = await loadComplaintWithAccess(user.id, b.complaintId);

          const [reply] = await db
            .insert(schema.complaintReplies)
            .values({
              complaintId: c.id,
              userId: user.id,
              body: text.slice(0, 5000),
              isBrand: true, // sunucu sabitler
              isInternal: false,
            })
            .returning({ id: schema.complaintReplies.id });

          const now = new Date();
          const firstResponse = c.firstResponseAt
            ? {}
            : {
                firstResponseAt: now,
                firstResponseMinutes: Math.max(
                  0,
                  Math.round(
                    (now.getTime() - new Date(c.createdAt).getTime()) / 60_000,
                  ),
                ),
              };

          // Yalnızca marka yanıtı alanları + status.
          await db
            .update(schema.complaints)
            .set({
              status: "answered",
              brandResponse: text.slice(0, 5000),
              brandResponseAt: now,
              brandResponseBy: user.id,
              updatedAt: now,
              ...firstResponse,
            })
            .where(eq(schema.complaints.id, c.id));

          // İlk yanıt süresi yazıldı: markanın ortalama yanıt süresi ve
          // bekleyen/yanıtlanan sayaçları tazelenir.
          await refreshBrandAggregates(c.brandId);

          await recordStatusChange({
            complaintId: c.id,
            fromStatus: c.status,
            toStatus: "answered",
            changedBy: user.id,
            actorRole: "brand",
            note: "Firma yanıt verdi",
          });

          await notifyComplaintOwner(c.id, {
            type: "brand_reply",
            title: "Firma şikayetinize yanıt verdi",
            body: text.slice(0, 160),
            skipIfSameAs: user.id,
          });

          await db.insert(schema.auditLogs).values({
            userId: user.id,
            action: "complaint.brand_reply",
            entityType: "complaint",
            entityId: c.id,
            metadata: { replyId: reply.id },
          });

          return Response.json(
            { id: reply.id, status: "answered" },
            { status: 201 },
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
