import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { isSyntheticPublic } from "@/lib/server/synthetic";
import { aiProviderLabel, isAiConfigured } from "@/lib/server/ai/client";
import { todayStart } from "@/lib/server/complaint-bot";

/**
 * Complaint Bot panosu sayaçları. Marka seçilirse SADECE o markanın verisi.
 * Sayımlar bot üretimi (is_synthetic) içerik üzerindedir — panonun konusu bot.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/bot/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const brandId = new URL(request.url).searchParams.get("brandId");
          if (brandId && !UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");

          const filters: SQL[] = [eq(schema.complaints.isSynthetic, true)];
          if (brandId) filters.push(eq(schema.complaints.brandId, brandId));
          const where = and(...filters);

          const star = (n: number) => sql<number>`count(*) FILTER (WHERE rating = ${n})`;

          const [row] = await db
            .select({
              total: sql<number>`count(*)`,
              today: sql<number>`count(*) FILTER (WHERE created_at >= ${todayStart()})`,
              avg_rating: sql<string | null>`round(avg(rating), 2)`,
              s1: star(1),
              s2: star(2),
              s3: star(3),
              s4: star(4),
              s5: star(5),
              responded: sql<number>`count(*) FILTER (WHERE brand_response IS NOT NULL)`,
              failed: sql<number>`count(*) FILTER (WHERE bot_error IS NOT NULL)`,
            })
            .from(schema.complaints)
            .where(where);

          const activeFilters: SQL[] = [eq(schema.brandBotConfigs.enabled, true)];
          if (brandId) activeFilters.push(eq(schema.brandBotConfigs.brandId, brandId));
          const [bots] = await db
            .select({ active: sql<number>`count(*)` })
            .from(schema.brandBotConfigs)
            .where(and(...activeFilters));

          const total = Number(row?.total ?? 0);
          const responded = Number(row?.responded ?? 0);

          return Response.json({
            total,
            today: Number(row?.today ?? 0),
            avg_rating: row?.avg_rating ? Number(row.avg_rating) : null,
            stars: {
              1: Number(row?.s1 ?? 0),
              2: Number(row?.s2 ?? 0),
              3: Number(row?.s3 ?? 0),
              4: Number(row?.s4 ?? 0),
              5: Number(row?.s5 ?? 0),
            },
            responded,
            failed: Number(row?.failed ?? 0),
            // Yanıt oranı: yanıtlanan / toplam bot şikayeti.
            response_rate: total > 0 ? Math.round((responded * 100) / total) : 0,
            active_bots: Number(bots?.active ?? 0),
            ai: {
              configured: isAiConfigured(),
              provider: aiProviderLabel(),
              synthetic_public: isSyntheticPublic(),
            },
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
