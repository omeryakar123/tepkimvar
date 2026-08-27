import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isSyntheticPublic } from "@/lib/server/synthetic";

/**
 * Marka puanı ve şikayet sayaçları TEK YERDEN, her zaman kaynak satırların
 * gerçek ortalaması/sayımı olarak hesaplanır.
 *
 * Puan iki kaynaktan beslenir; ikisi de kullanıcının verdiği 1-5 arası nottur:
 *   - `brand_ratings`    → marka sayfasındaki genel oy (kullanıcı başına tek)
 *   - `complaints.rating` → ŞİKAYET BAZLI memnuniyet oyu; kullanıcı kendi
 *     şikayetinin sonucunu yıldızlayınca yazılır (çözüm tüneli ya da
 *     /api/complaint-rating). Her şikayet için en fazla bir oy olduğundan
 *     `complaint_resolutions.resolution_rating` ARTIK ortalamaya katılmaz —
 *     aynı not iki kez sayılırdı.
 *
 * Artımlı ("kayan ortalama") güncelleme bilinçli olarak kullanılmaz: oy
 * değiştiğinde, oy silindiğinde veya kullanıcı hesabı kapandığında (cascade)
 * ortalama kayar ve bir daha kendini toparlamazdı.
 */

/** Reddedilen/spam kayıtlar gerçek şikayet sayılmaz. */
const COUNTED = sql`status NOT IN ('rejected', 'spam')`;

/** Bot/sentetik şikayetler marka sayacına girer; puan ortalamasına yalnızca SYNTHETIC_CONTENT_PUBLIC ile. */
function ratingSyntheticFilter() {
  return isSyntheticPublic() ? sql`TRUE` : sql`is_synthetic = false`;
}

/** Süreci hâlâ devam eden, çözülmemiş durumlar. */
const OPEN = sql`status IN ('pending', 'approved', 'in_review', 'answered', 'user_replied', 'super_admin_review', 'escalated')`;

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
        FROM brand_ratings
       WHERE brand_id = ${brandId}
      UNION ALL
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
        (count(*) FILTER (WHERE status = 'resolved'))::int AS resolved_count,
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

/** Tüm markaları sırayla tazeler (bakım scriptleri ve seed için). */
export async function recomputeAllBrandAggregates(): Promise<number> {
  const brands = await db.select({ id: schema.brands.id }).from(schema.brands);
  for (const b of brands) await recomputeBrandAggregates(b.id);
  return brands.length;
}
