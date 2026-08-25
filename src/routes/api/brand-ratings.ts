import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { recomputeBrandAggregates } from "@/lib/server/brand-stats";

/**
 * Marka puanlama. GÜVENLİK: user_id oturumdan; kullanıcı başına tek puan
 * (unique brand_id+user_id). Markanın ortalaması istemciden ALINMAZ —
 * her değişiklikten sonra puan satırlarından yeniden hesaplanır.
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

          await db
            .insert(schema.brandRatings)
            .values({ brandId: b.brandId, userId: user.id, rating })
            .onConflictDoUpdate({
              target: [schema.brandRatings.brandId, schema.brandRatings.userId],
              set: { rating, updatedAt: new Date() },
            });

          const agg = await recomputeBrandAggregates(b.brandId);

          return Response.json({
            rating,
            average: agg?.rating ?? 0,
            count: agg?.ratingCount ?? 0,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Oyunu geri çekme. Ortalama satırlardan yeniden hesaplandığı için
      // silme de puanı doğru şekilde geri alır.
      DELETE: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId = new URL(request.url).searchParams.get("brandId") ?? "";
          if (!brandId) throw new HttpError(400, "Firma belirtilmeli");

          const [removed] = await db
            .delete(schema.brandRatings)
            .where(and(eq(schema.brandRatings.brandId, brandId), eq(schema.brandRatings.userId, user.id)))
            .returning({ id: schema.brandRatings.id });
          if (!removed) throw new HttpError(404, "Kayıtlı oyunuz yok");

          const agg = await recomputeBrandAggregates(brandId);

          return Response.json({
            rating: null,
            average: agg?.rating ?? 0,
            count: agg?.ratingCount ?? 0,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
