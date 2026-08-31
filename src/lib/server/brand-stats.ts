import { and, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isSyntheticPublic } from "@/lib/server/synthetic";

/**
 * Marka puanı ve şikayet sayaçları TEK YERDEN, her zaman kaynak satırların
 * gerçek ortalaması/sayımı olarak hesaplanır.
 *
 * Puan YALNIZCA şikayet bazlıdır: `complaints.rating` — kullanıcı (veya bot)
 * şikayet sonucunu 1-5 yıldızla değerlendirdiğinde yazılır. Marka sayfası
 * doğrudan oyu (`brand_ratings`) ortalamaya KATILMAZ; şikayeti olmayan
 * markanın puanı da gösterilmez (rating_count = 0).
 */

/** Reddedilen/spam kayıtlar gerçek şikayet sayılmaz. */
export const COMPLAINT_COUNTED = sql`status NOT IN ('rejected', 'spam')`;

/** Bot/sentetik şikayetler marka sayacına girer; puan ortalamasına yalnızca SYNTHETIC_CONTENT_PUBLIC ile. */
function ratingSyntheticFilter() {
  return isSyntheticPublic() ? sql`TRUE` : sql`is_synthetic = false`;
}

/** Yanıtlanmış / kapatılmış — arayüzde «Çözüldü» sayılır. */
export const COMPLAINT_RESOLVED = sql`status IN ('resolved', 'answered')`;

/** Süreci hâlâ devam eden durumlar (answered/resolved hariç). */
export const COMPLAINT_OPEN = sql`status IN ('pending', 'approved', 'in_review', 'user_replied', 'super_admin_review', 'escalated')`;

/** Eski isimler — iç kullanım. */
const COUNTED = COMPLAINT_COUNTED;
const RESOLVED = COMPLAINT_RESOLVED;
const OPEN = COMPLAINT_OPEN;

export type LiveBrandMetrics = {
  totalComplaints: number;
  complaintsResolved: number;
  complaintsPending: number;
  resolutionRate: number;
  avgResponseMinutes: number;
  rating: number;
  ratingCount: number;
};

/** API yanıtları için şikayet tablosundan anlık sayaç (cache'e güvenilmez). */
export async function fetchLiveBrandMetrics(
  brandIds: string[],
): Promise<Map<string, LiveBrandMetrics>> {
  const out = new Map<string, LiveBrandMetrics>();
  if (brandIds.length === 0) return out;

  const empty = (): LiveBrandMetrics => ({
    totalComplaints: 0,
    complaintsResolved: 0,
    complaintsPending: 0,
    resolutionRate: 0,
    avgResponseMinutes: 0,
    rating: 0,
    ratingCount: 0,
  });

  for (const id of brandIds) out.set(id, empty());

  const ratingVisible = ratingSyntheticFilter();

  const counterRows = await db
    .select({
      brandId: schema.complaints.brandId,
      total: sql<number>`count(*) FILTER (WHERE ${COMPLAINT_COUNTED})::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${COMPLAINT_RESOLVED})::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${COMPLAINT_OPEN})::int`,
      avgResponse: sql<number | null>`round(avg(${schema.complaints.firstResponseMinutes}))::int`,
    })
    .from(schema.complaints)
    .where(inArray(schema.complaints.brandId, brandIds))
    .groupBy(schema.complaints.brandId);

  for (const r of counterRows) {
    const total = Number(r.total) || 0;
    const resolved = Number(r.resolved) || 0;
    out.set(r.brandId, {
      totalComplaints: total,
      complaintsResolved: resolved,
      complaintsPending: Number(r.pending) || 0,
      resolutionRate: total > 0 ? Math.round((resolved * 100) / total) : 0,
      avgResponseMinutes: Number(r.avgResponse) || 0,
      rating: 0,
      ratingCount: 0,
    });
  }

  const scoreRows = await db
    .select({
      brandId: schema.complaints.brandId,
      avg: sql<string | null>`round(avg(${schema.complaints.rating}), 2)`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.complaints)
    .where(
      and(
        inArray(schema.complaints.brandId, brandIds),
        sql`${schema.complaints.rating} IS NOT NULL`,
        sql`${COMPLAINT_COUNTED}`,
        sql`${ratingVisible}`,
      ),
    )
    .groupBy(schema.complaints.brandId);

  for (const r of scoreRows) {
    const m = out.get(r.brandId) ?? empty();
    m.rating = Number(r.avg) || 0;
    m.ratingCount = Number(r.count) || 0;
    out.set(r.brandId, m);
  }

  return out;
}

/** Canlı metrikleri marka satırına uygula (API yanıtı). */
export function applyLiveMetricsToBrand(
  row: typeof schema.brands.$inferSelect,
  live: LiveBrandMetrics | undefined,
): typeof schema.brands.$inferSelect {
  if (!live) return row;
  return {
    ...row,
    totalComplaints: live.totalComplaints,
    complaintsResolved: live.complaintsResolved,
    complaintsPending: live.complaintsPending,
    resolutionRate: live.resolutionRate,
    avgResponseMinutes: live.avgResponseMinutes,
    avgFirstResponseMinutes: live.avgResponseMinutes,
    rating: String(live.rating),
    ratingCount: live.ratingCount,
  };
}

export type BrandAggregates = {
  rating: number;
  ratingCount: number;
  totalComplaints: number;
  complaintsResolved: number;
  complaintsPending: number;
  resolutionRate: number;
  /** Veri yoksa 0 — arayüz bunu "—" olarak gösterir. */
  avgResponseMinutes: number;
};

type AggregateRow = {
  rating: string | number | null;
  rating_count: number | string;
  total_complaints: number | string;
  complaints_resolved: number | string;
  complaints_pending: number | string;
  resolution_rate: number | string;
  avg_response_minutes: number | string | null;
};

/**
 * Bir markanın puanını ve sayaçlarını sıfırdan hesaplayıp yazar. Puan/oy
 * değişimi, şikayet oluşturma/silme ve her durum geçişinden sonra çağrılır.
 */
export async function recomputeBrandAggregates(
  brandId: string,
): Promise<BrandAggregates | null> {
  const ratingVisible = ratingSyntheticFilter();

  const rows = (await db.execute(sql`
    WITH scores AS (
      SELECT rating::numeric AS value
        FROM complaints
       WHERE brand_id = ${brandId}
         AND rating IS NOT NULL
         AND ${COUNTED}
         AND ${ratingVisible}
    ),
    score AS (
      SELECT round(avg(value), 2) AS avg_value, count(*)::int AS vote_count FROM scores
    ),
    counter AS (
      SELECT
        (count(*) FILTER (WHERE ${COUNTED}))::int AS total_count,
        (count(*) FILTER (WHERE ${RESOLVED}))::int AS resolved_count,
        (count(*) FILTER (WHERE ${OPEN}))::int AS open_count,
        round(avg(first_response_minutes))::int AS avg_response
      FROM complaints
     WHERE brand_id = ${brandId}
    )
    UPDATE brands SET
      rating = coalesce((SELECT avg_value FROM score), 0),
      rating_count = (SELECT vote_count FROM score),
      total_complaints = (SELECT total_count FROM counter),
      complaints_resolved = (SELECT resolved_count FROM counter),
      complaints_pending = (SELECT open_count FROM counter),
      resolution_rate = CASE
        WHEN (SELECT total_count FROM counter) > 0
        THEN round((SELECT resolved_count FROM counter)::numeric * 100 / (SELECT total_count FROM counter))::int
        ELSE 0
      END,
      avg_response_minutes = coalesce((SELECT avg_response FROM counter), 0),
      avg_first_response_minutes = (SELECT avg_response FROM counter),
      updated_at = now()
    WHERE id = ${brandId}
    RETURNING rating, rating_count, total_complaints, complaints_resolved,
              complaints_pending, resolution_rate, avg_response_minutes
  `)) as unknown as AggregateRow[];

  const row = rows?.[0];
  if (!row) return null;

  return {
    rating: Number(row.rating ?? 0),
    ratingCount: Number(row.rating_count),
    totalComplaints: Number(row.total_complaints),
    complaintsResolved: Number(row.complaints_resolved),
    complaintsPending: Number(row.complaints_pending),
    resolutionRate: Number(row.resolution_rate),
    avgResponseMinutes: Number(row.avg_response_minutes ?? 0),
  };
}

/**
 * Sayaçların bozulmasının kullanıcı akışını kesmemesi için hataları yutar
 * (asıl işlem — oy, yanıt, durum değişikliği — çoktan yazılmış olur).
 */
export async function refreshBrandAggregates(brandId: string): Promise<void> {
  try {
    await recomputeBrandAggregates(brandId);
  } catch (e) {
    console.error("[brand-stats] yeniden hesaplama başarısız:", brandId, e);
  }
}

/** Tüm markaları tek SQL ile tazeler (deploy / bakım). */
export async function recomputeAllBrandAggregatesBulk(): Promise<number> {
  const ratingVisible = ratingSyntheticFilter();

  await db.execute(sql`
    UPDATE brands b SET
      total_complaints = coalesce(x.total_count, 0),
      complaints_resolved = coalesce(x.resolved_count, 0),
      complaints_pending = coalesce(x.open_count, 0),
      resolution_rate = CASE
        WHEN coalesce(x.total_count, 0) > 0
        THEN round(coalesce(x.resolved_count, 0)::numeric * 100 / x.total_count)::int
        ELSE 0
      END,
      avg_response_minutes = coalesce(x.avg_response, 0),
      avg_first_response_minutes = x.avg_response,
      rating = coalesce(x.avg_value, 0),
      rating_count = coalesce(x.vote_count, 0),
      updated_at = now()
    FROM (
      SELECT
        br.id AS brand_id,
        count(c.id) FILTER (WHERE ${COMPLAINT_COUNTED})::int AS total_count,
        count(c.id) FILTER (WHERE ${COMPLAINT_RESOLVED})::int AS resolved_count,
        count(c.id) FILTER (WHERE ${COMPLAINT_OPEN})::int AS open_count,
        round(avg(c.first_response_minutes))::int AS avg_response,
        round(avg(c.rating) FILTER (
          WHERE c.rating IS NOT NULL AND ${COMPLAINT_COUNTED} AND ${ratingVisible}
        ), 2) AS avg_value,
        count(c.id) FILTER (
          WHERE c.rating IS NOT NULL AND ${COMPLAINT_COUNTED} AND ${ratingVisible}
        )::int AS vote_count
      FROM brands br
      LEFT JOIN complaints c ON c.brand_id = br.id
      GROUP BY br.id
    ) x
    WHERE b.id = x.brand_id
  `);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.brands);
  return Number(count);
}

/** Tüm markaları sırayla tazeler (bakım scriptleri ve seed için). */
export async function recomputeAllBrandAggregates(): Promise<number> {
  return recomputeAllBrandAggregatesBulk();
}
