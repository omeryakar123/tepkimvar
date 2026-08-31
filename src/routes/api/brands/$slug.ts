import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbBrand } from "@/lib/db-shapes";
import {
  applyLiveMetricsToBrand,
  fetchLiveBrandMetrics,
  refreshBrandAggregates,
} from "@/lib/server/brand-stats";

// Public: slug ile tek firma — metrikler şikayet tablosundan anlık hesaplanır.
export const Route = createFileRoute("/api/brands/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [row] = await db
          .select()
          .from(schema.brands)
          .where(eq(schema.brands.slug, params.slug))
          .limit(1);
        if (!row) return new Response("Not Found", { status: 404 });

        const live = await fetchLiveBrandMetrics([row.id]);
        const fresh = applyLiveMetricsToBrand(row, live.get(row.id));

        // DB önbelleğini arka planda güncelle (liste sıralamaları için).
        void refreshBrandAggregates(row.id);

        return Response.json(toDbBrand(fresh));
      },
    },
  },
});
