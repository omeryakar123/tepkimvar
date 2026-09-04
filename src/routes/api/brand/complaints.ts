import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ne, notInArray, sql, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordStatusChange } from "@/lib/server/history";
import { notifyComplaintOwner } from "@/lib/server/notify";
import { loadAuthorProfile } from "@/lib/server/author-profile";
import { displayPhone } from "@/lib/phone-mask";
import { normalizePlatformUsername } from "@/lib/server/ai/prompts";
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
  "rejected",
  "spam",
  "escalated",
];

const DEFAULT_PAGE_SIZE = 12;

const BRAND_VISIBLE_STATUSES = notInArray(schema.complaints.status, [
  "pending",
  "rejected",
  "spam",
] as const);

type ComplaintRow = {
  id: string;
  title: string;
  body: string;
  status: Status;
  created_at: Date;
  short_id: string | null;
  brand_response: string | null;
  rating: number | null;
  platform_username: string | null;
  contact_phone: string | null;
  user_id: string;
  is_anonymous: boolean;
  anon_name: string | null;
  public_id: string | null;
};

async function shapeBrandComplaint(
  row: ComplaintRow,
  opts?: { otherCount?: number },
) {
  let authorName: string | null = null;
  let siteUsername: string | null = null;

  if (row.is_anonymous) {
    authorName = row.anon_name?.trim() || "Anonim kullanıcı";
  } else {
    const profile = await loadAuthorProfile(row.user_id);
    authorName = profile?.full_name ?? null;
    siteUsername = profile?.username ?? null;
  }

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    created_at: row.created_at,
    short_id: row.short_id,
    public_id: row.public_id,
    brand_response: row.brand_response,
    rating: row.rating,
    platform_username: row.platform_username
      ? normalizePlatformUsername(row.platform_username)
      : null,
    contact_phone: row.contact_phone,
    contact_phone_display: displayPhone(row.contact_phone, "full"),
    author_name: authorName,
    site_username: siteUsername,
    is_anonymous: row.is_anonymous,
    other_complaints_count: opts?.otherCount ?? 0,
  };
}

async function loadOtherComplaintsForBrand(
  brandId: string,
  userId: string,
  excludeId: string,
) {
  const rows = await db
    .select({
      id: schema.complaints.id,
      title: schema.complaints.title,
      status: schema.complaints.status,
      created_at: schema.complaints.createdAt,
      short_id: schema.complaints.shortId,
      public_id: schema.complaints.publicId,
      rating: schema.complaints.rating,
    })
    .from(schema.complaints)
    .where(
      and(
        eq(schema.complaints.brandId, brandId),
        eq(schema.complaints.userId, userId),
        ne(schema.complaints.id, excludeId),
        eq(schema.complaints.hidden, false),
        BRAND_VISIBLE_STATUSES,
      ),
    )
    .orderBy(desc(schema.complaints.createdAt))
    .limit(15);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    created_at: r.created_at,
    short_id: r.short_id,
    public_id: r.public_id,
    rating: r.rating,
  }));
}

async function loadComplaintAttachments(complaintId: string) {
  const rows = await db
    .select({
      id: schema.complaintAttachments.id,
      storage_path: schema.complaintAttachments.storagePath,
      file_type: schema.complaintAttachments.fileType,
      visibility: schema.complaintAttachments.visibility,
      created_at: schema.complaintAttachments.createdAt,
    })
    .from(schema.complaintAttachments)
    .where(
      and(
        eq(schema.complaintAttachments.complaintId, complaintId),
        inArray(schema.complaintAttachments.visibility, ["public", "brand_only"]),
      ),
    )
    .orderBy(desc(schema.complaintAttachments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    url: `/api/files/${r.storage_path}`,
    file_type: r.file_type,
    visibility: r.visibility,
    created_at: r.created_at,
  }));
}

/** Şikayeti bul + üzerindeki markaya erişimi doğrula. brandId İSTEMCİDEN ALINMAZ. */
async function loadComplaintWithAccess(userId: string, complaintId: string) {
  if (!UUID_RE.test(complaintId))
    throw new HttpError(400, "Şikayet belirtilmeli");
  const [c] = await db
    .select({
      id: schema.complaints.id,
      brandId: schema.complaints.brandId,
      status: schema.complaints.status,
      hidden: schema.complaints.hidden,
      createdAt: schema.complaints.createdAt,
      firstResponseAt: schema.complaints.firstResponseAt,
    })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, complaintId))
    .limit(1);
  if (!c) throw new HttpError(404, "Şikayet bulunamadı");
  if (c.hidden && !(await isStaff(userId))) throw new HttpError(404, "Şikayet bulunamadı");
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

          const detailId = p.get("id");
          if (detailId) {
            if (!UUID_RE.test(detailId)) throw new HttpError(400, "Geçersiz şikayet");
            await loadComplaintWithAccess(user.id, detailId);

            const [row] = await db
              .select({
                id: schema.complaints.id,
                title: schema.complaints.title,
                body: schema.complaints.body,
                status: schema.complaints.status,
                created_at: schema.complaints.createdAt,
                short_id: schema.complaints.shortId,
                brand_response: schema.complaints.brandResponse,
                rating: schema.complaints.rating,
                platform_username: schema.complaints.platformUsername,
                contact_phone: schema.complaints.contactPhone,
                user_id: schema.complaints.userId,
                is_anonymous: schema.complaints.isAnonymous,
                anon_name: schema.complaints.anonName,
                public_id: schema.complaints.publicId,
              })
              .from(schema.complaints)
              .where(
                and(
                  eq(schema.complaints.id, detailId),
                  eq(schema.complaints.brandId, brandId),
                  eq(schema.complaints.hidden, false),
                  BRAND_VISIBLE_STATUSES,
                ),
              )
              .limit(1);
            if (!row) throw new HttpError(404, "Şikayet bulunamadı");

            const [otherComplaints, attachments, shaped] = await Promise.all([
              loadOtherComplaintsForBrand(brandId, row.user_id, row.id),
              loadComplaintAttachments(row.id),
              shapeBrandComplaint(row as ComplaintRow, {
                otherCount: 0,
              }),
            ]);

            return Response.json({
              complaint: { ...shaped, other_complaints_count: otherComplaints.length },
              other_complaints: otherComplaints,
              attachments,
            });
          }

          const page = Math.max(1, Number(p.get("page")) || 1);
          const pageSize = Math.min(
            50,
            Math.max(1, Number(p.get("pageSize")) || DEFAULT_PAGE_SIZE),
          );

          const conditions: SQL[] = [
            eq(schema.complaints.brandId, brandId),
            eq(schema.complaints.hidden, false),
            BRAND_VISIBLE_STATUSES,
          ];
          const statusParam = p.get("status");
          if (statusParam) {
            if (!ALL_STATUSES.includes(statusParam as Status))
              throw new HttpError(400, "Geçersiz durum");
            conditions.push(
              eq(schema.complaints.status, statusParam as Status),
            );
          }
          const where = and(...conditions);

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
              platform_username: schema.complaints.platformUsername,
              contact_phone: schema.complaints.contactPhone,
              user_id: schema.complaints.userId,
              is_anonymous: schema.complaints.isAnonymous,
              anon_name: schema.complaints.anonName,
              public_id: schema.complaints.publicId,
            })
            .from(schema.complaints)
            .where(where)
            .orderBy(desc(schema.complaints.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

          const userIds = [...new Set(rows.map((r) => r.user_id))];
          const otherCounts = new Map<string, number>();
          if (userIds.length > 0) {
            const counts = await db
              .select({
                userId: schema.complaints.userId,
                count: sql<number>`count(*)::int`,
              })
              .from(schema.complaints)
              .where(
                and(
                  eq(schema.complaints.brandId, brandId),
                  inArray(schema.complaints.userId, userIds),
                  eq(schema.complaints.hidden, false),
                  BRAND_VISIBLE_STATUSES,
                ),
              )
              .groupBy(schema.complaints.userId);
            for (const c of counts) {
              otherCounts.set(c.userId, Math.max(0, Number(c.count) - 1));
            }
          }

          const items = await Promise.all(
            rows.map((row) =>
              shapeBrandComplaint(row as ComplaintRow, {
                otherCount: otherCounts.get(row.user_id) ?? 0,
              }),
            ),
          );

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(where);

          return Response.json({ items, total: Number(count) });
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

          if (status === "answered") {
            await notifyComplaintOwner(c.id, {
              type: "status_change",
              title: "Şikayetinize yanıt verildi",
              body: "Firma şikayetinizi yanıtladı.",
              skipIfSameAs: user.id,
            });
          }

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

          await notifyComplaintOwner(c.id, {
            type: "system",
            title: "Memnuniyet anketinizi doldurun",
            body: "Firma yanıtına göre deneyiminizi 1–5 yıldızla değerlendirin.",
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
