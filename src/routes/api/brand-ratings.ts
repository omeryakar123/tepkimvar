import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

/**
 * Marka puanlama. GÜVENLİK: user_id oturumdan; kullanıcı başına tek puan
 * (unique brand_id+user_id). Markanın ortalaması istemciden ALINMAZ —
 * puanlardan yeniden hesaplanır.
 */
export const Route = createFileRoute("/api/brand-ratings")({
  server: {
    handlers: {
      // Kendi verdiğim puan
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId = new URL(request.url).searchParams.get("brandId") ?? "";
          if (!brandId) throw new HttpError(400, "Firma belirtilmeli");
          const [row] = await db
            .select({ rating: schema.brandRatings.rating })
            .from(schema.brandRatings)
            .where(and(eq(schema.brandRatings.brandId, brandId), eq(schema.brandRatings.userId, user.id)))
            .limit(1);
          return Response.json({ rating: row?.rating ?? null });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`rating:${user.id}`, 30, 60 * 60_000);

          const b = (await request.json()) as { brandId?: string; rating?: number };
          if (!b.brandId) throw new HttpError(400, "Firma belirtilmeli");
          const rating = Math.round(Number(b.rating));
          if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, "Puan 1-5 arası olmalı");

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, b.brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          // Daha önce oy vermiş mi? (yeni oy mu, oy değişikliği mi)
          const [prev] = await db
            .select({ rating: schema.brandRatings.rating })
            .from(schema.brandRatings)
            .where(and(eq(schema.brandRatings.brandId, b.brandId), eq(schema.brandRatings.userId, user.id)))
            .limit(1);

          await db
            .insert(schema.brandRatings)
            .values({ brandId: b.brandId, userId: user.id, rating })
            .onConflictDoUpdate({
              target: [schema.brandRatings.brandId, schema.brandRatings.userId],
              set: { rating, updatedAt: new Date() },
            });

          // Marka ortalaması KAYAN ORTALAMA ile güncellenir (resolutions.ts ile
          // aynı model). Sıfırdan avg(brand_ratings) HESAPLANMAZ: markanın
          // mevcut taban puanı (çözüm puanları dahil) korunur.
          const [updated] = prev
            ? // Oy değişikliği: sayaç sabit, fark kadar kaydır.
              await db
                .update(schema.brands)
                .set({
                  rating: sql`round(greatest(1, least(5, ${schema.brands.rating} + (${rating - prev.rating})::numeric / greatest(${schema.brands.ratingCount}, 1))), 2)`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.brands.id, b.brandId))
                .returning({ rating: schema.brands.rating, cnt: schema.brands.ratingCount })
            : // Yeni oy: harmanla + sayaç artır.
              await db
                .update(schema.brands)
                .set({
                  rating: sql`round(((${schema.brands.rating} * ${schema.brands.ratingCount}) + ${rating})::numeric / (${schema.brands.ratingCount} + 1), 2)`,
                  ratingCount: sql`${schema.brands.ratingCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.brands.id, b.brandId))
                .returning({ rating: schema.brands.rating, cnt: schema.brands.ratingCount });

          return Response.json({ rating, average: Number(updated.rating), count: updated.cnt });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
