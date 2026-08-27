import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";

/**
 * Bot üretimi şikayet listesi / detay / yanıt düzenleme / silme.
 *
 * GÜVENLİK: hepsi requireStaff. DELETE yalnızca `is_synthetic` satırlarda
 * çalışır — gerçek kullanıcı şikayetleri bu uçtan silinemez (moderasyon
 * kararları /api/admin/complaints üzerinden verilir).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 20;

const ALL_STATUSES = [
  "pending", "approved", "in_review", "answered", "resolved",
  "rejected", "spam", "user_replied", "super_admin_review", "escalated", "archived",
] as const;
type Status = (typeof ALL_STATUSES)[number];

export const Route = createFileRoute("/api/admin/bot/complaints")({
  server: {
    handlers: {
      /**
       * GET ?id=       -> tek şikayet detayı (yanıtlar + bot çalıştırma bilgisi)
       * GET (filtreli) -> liste. Filtreler: brandId, rating, scenario, language,
       *                   status, from, to, q, source, page, pageSize
       */
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const p = new URL(request.url).searchParams;

          /* ------------------------------ Detay ------------------------------ */
          const id = p.get("id");
          if (id) {
            if (!UUID_RE.test(id)) throw new HttpError(400, "Geçersiz kayıt");

            const [row] = await db
              .select({
                id: schema.complaints.id,
                brand_id: schema.complaints.brandId,
                brand_name: schema.brands.name,
                brand_slug: schema.brands.slug,
                title: schema.complaints.title,
                body: schema.complaints.body,
                rating: schema.complaints.rating,
                status: schema.complaints.status,
                scenario: schema.complaints.botScenario,
                language: schema.complaints.language,
                is_synthetic: schema.complaints.isSynthetic,
                generated_by: schema.complaints.generatedBy,
                is_public: schema.complaints.isPublic,
                anon_name: schema.complaints.anonName,
                brand_response: schema.complaints.brandResponse,
                brand_response_at: schema.complaints.brandResponseAt,
                first_response_minutes: schema.complaints.firstResponseMinutes,
                bot_error: schema.complaints.botError,
                bot_run_id: schema.complaints.botRunId,
                created_at: schema.complaints.createdAt,
                updated_at: schema.complaints.updatedAt,
              })
              .from(schema.complaints)
              .innerJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
              .where(eq(schema.complaints.id, id))
              .limit(1);
            if (!row) throw new HttpError(404, "Şikayet bulunamadı");

            const replies = await db
              .select({
                id: schema.complaintReplies.id,
                body: schema.complaintReplies.body,
                is_brand: schema.complaintReplies.isBrand,
                language: schema.complaintReplies.language,
                generated_by: schema.complaintReplies.generatedBy,
                created_at: schema.complaintReplies.createdAt,
              })
              .from(schema.complaintReplies)
              .where(eq(schema.complaintReplies.complaintId, id))
              .orderBy(desc(schema.complaintReplies.createdAt));

            const run = row.bot_run_id
              ? (
                  await db
                    .select({
                      id: schema.botRuns.id,
                      trigger: schema.botRuns.trigger,
                      status: schema.botRuns.status,
                      provider: schema.botRuns.provider,
                      started_at: schema.botRuns.startedAt,
                    })
                    .from(schema.botRuns)
                    .where(eq(schema.botRuns.id, row.bot_run_id))
                    .limit(1)
                )[0] ?? null
              : null;

            return Response.json({ complaint: row, replies, run });
          }

          /* ------------------------------ Liste ------------------------------ */
          const conditions: SQL[] = [];

          // source=bot (varsayılan) yalnızca sentetik içerik; all = hepsi.
          if (p.get("source") !== "all") {
            conditions.push(eq(schema.complaints.isSynthetic, true));
          }

          const brandId = p.get("brandId");
          if (brandId) {
            if (!UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");
            conditions.push(eq(schema.complaints.brandId, brandId));
          }

          const rating = Number(p.get("rating"));
          if (rating >= 1 && rating <= 5) {
            conditions.push(eq(schema.complaints.rating, Math.round(rating)));
          }

          const scenario = p.get("scenario");
          if (scenario) conditions.push(eq(schema.complaints.botScenario, scenario));

          const language = p.get("language");
          if (language) conditions.push(eq(schema.complaints.language, language));

          const status = p.get("status");
          if (status) {
            if (!ALL_STATUSES.includes(status as Status))
              throw new HttpError(400, "Geçersiz durum");
            conditions.push(eq(schema.complaints.status, status as Status));
          }

          const from = p.get("from");
          if (from && !Number.isNaN(Date.parse(from))) {
            conditions.push(gte(schema.complaints.createdAt, new Date(from)));
          }
          const to = p.get("to");
          if (to && !Number.isNaN(Date.parse(to))) {
            // Bitiş tarihi DAHİL olsun: günün sonuna kaydır.
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            conditions.push(lte(schema.complaints.createdAt, end));
          }

          const q = p.get("q")?.trim();
          if (q) {
            const like = `%${q}%`;
            const search = or(
              ilike(schema.complaints.title, like),
              ilike(schema.complaints.body, like),
              ilike(schema.complaints.brandResponse, like),
            );
            if (search) conditions.push(search);
          }

          const where = conditions.length ? and(...conditions) : undefined;
          const page = Math.max(1, Number(p.get("page")) || 1);
          const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize")) || DEFAULT_PAGE_SIZE));

          const items = await db
            .select({
              id: schema.complaints.id,
              brand_id: schema.complaints.brandId,
              brand_name: schema.brands.name,
              title: schema.complaints.title,
              body: schema.complaints.body,
              rating: schema.complaints.rating,
              scenario: schema.complaints.botScenario,
              language: schema.complaints.language,
              status: schema.complaints.status,
              brand_response: schema.complaints.brandResponse,
              generated_by: schema.complaints.generatedBy,
              is_synthetic: schema.complaints.isSynthetic,
              is_public: schema.complaints.isPublic,
              bot_error: schema.complaints.botError,
              created_at: schema.complaints.createdAt,
            })
            .from(schema.complaints)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
            .where(where)
            .orderBy(desc(schema.complaints.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
            .where(where);

          return Response.json({ items, total: Number(count) });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /**
       * Yanıtı elle düzelt ve/veya durumu değiştir.
       * GÜVENLİK: gövdeden yalnızca `response` ve `status` okunur.
       */
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            response?: string;
            status?: string;
          };
          if (!b.id || !UUID_RE.test(b.id)) throw new HttpError(400, "Şikayet belirtilmeli");

          const [c] = await db
            .select({
              id: schema.complaints.id,
              brandId: schema.complaints.brandId,
              createdAt: schema.complaints.createdAt,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.id))
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");

          const now = new Date();
          const patch: Record<string, unknown> = { updatedAt: now };

          if (typeof b.response === "string") {
            const text = b.response.trim();
            if (text.length < 10) throw new HttpError(400, "Yanıt en az 10 karakter olmalı");
            patch.brandResponse = text.slice(0, 5000);
            patch.brandResponseAt = now;
            patch.status = "answered";
            patch.botError = null;

            // Bot yanıtı `complaint_replies` içinde de duruyor; elle düzeltme
            // orada da güncellenir, aksi halde detay/akış eski metni gösterir.
            const [reply] = await db
              .select({ id: schema.complaintReplies.id })
              .from(schema.complaintReplies)
              .where(
                and(
                  eq(schema.complaintReplies.complaintId, c.id),
                  eq(schema.complaintReplies.isBrand, true),
                ),
              )
              .orderBy(desc(schema.complaintReplies.createdAt))
              .limit(1);

            if (reply) {
              await db
                .update(schema.complaintReplies)
                .set({ body: text.slice(0, 5000), generatedBy: "admin_edited" })
                .where(eq(schema.complaintReplies.id, reply.id));
            } else {
              await db.insert(schema.complaintReplies).values({
                complaintId: c.id,
                userId: user.id,
                body: text.slice(0, 5000),
                isBrand: true,
                generatedBy: "admin_edited",
              });
            }

            if (!(await hasFirstResponse(c.id))) {
              patch.firstResponseAt = now;
              patch.firstResponseMinutes = Math.max(
                1,
                Math.round((now.getTime() - new Date(c.createdAt).getTime()) / 60_000),
              );
            }
          }

          if (typeof b.status === "string") {
            if (!ALL_STATUSES.includes(b.status as Status))
              throw new HttpError(400, "Geçersiz durum");
            patch.status = b.status as Status;
          }

          await db.update(schema.complaints).set(patch).where(eq(schema.complaints.id, c.id));
          await refreshBrandAggregates(c.brandId);

          await audit(request, user.id, {
            action: "bot.complaint_edit",
            entityType: "complaint",
            entityId: c.id,
            metadata: { response: typeof b.response === "string", status: b.status ?? null },
          });

          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /** Sentetik şikayeti sil (yanıtları cascade ile gider). */
      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json().catch(() => ({}))) as { id?: string };
          if (!b.id || !UUID_RE.test(b.id)) throw new HttpError(400, "Şikayet belirtilmeli");

          const [c] = await db
            .select({
              id: schema.complaints.id,
              brandId: schema.complaints.brandId,
              isSynthetic: schema.complaints.isSynthetic,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.id))
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");
          if (!c.isSynthetic)
            throw new HttpError(400, "Bu uçtan yalnızca bot üretimi kayıtlar silinebilir");

          await db.delete(schema.complaints).where(eq(schema.complaints.id, c.id));
          await refreshBrandAggregates(c.brandId);

          await audit(request, user.id, {
            action: "bot.complaint_delete",
            entityType: "complaint",
            entityId: c.id,
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

async function hasFirstResponse(complaintId: string): Promise<boolean> {
  const [row] = await db
    .select({ at: schema.complaints.firstResponseAt })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, complaintId))
    .limit(1);
  return !!row?.at;
}
