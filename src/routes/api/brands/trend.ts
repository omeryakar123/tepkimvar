import { createFileRoute } from "@tanstack/react-router";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbBrand } from "@/lib/db-shapes";
import { fetchBrandTrendFallback, fetchBrandTrendScores } from "@/lib/server/brand-trend";

export const Route = createFileRoute("/api/brands/trend")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit")) || 10;
        const categorySlug = url.searchParams.get("categorySlug") ?? undefined;

        let scores = await fetchBrandTrendScores({ limit, categorySlug });

        if (scores.length < limit) {
          const fallbackIds = await fetchBrandTrendFallback(limit - scores.length);
          const existing = new Set(scores.map((s) => s.brandId));
          for (const id of fallbackIds) {
            if (existing.has(id)) continue;
            scores.push({
              brandId: id,
              recentComplaints: 0,
              priorComplaints: 0,
              recentViews: 0,
              recentSupports: 0,
              trendScore: 0,
            });
            if (scores.length >= limit) break;
          }
        }

        const brandIds = scores.map((s) => s.brandId);
        if (brandIds.length === 0) return Response.json({ items: [] });

        const brandRows = await db.select().from(schema.brands).where(inArray(schema.brands.id, brandIds));
        const catIds = [...new Set(brandRows.map((b) => b.categoryId).filter(Boolean) as string[])];
        const cats =
          catIds.length > 0
            ? await db.select().from(schema.categories).where(inArray(schema.categories.id, catIds))
            : [];
        const catById = Object.fromEntries(cats.map((c) => [c.id, c]));

        const brandById = Object.fromEntries(brandRows.map((b) => [b.id, b]));
        const items = scores
          .map((s) => {
            const b = brandById[s.brandId];
            if (!b) return null;
            const cat = b.categoryId ? catById[b.categoryId] : null;
            return {
              ...toDbBrand(b),
              category_name: cat?.name ?? "Genel",
              category_slug: cat?.slug ?? "diger",
              recent_complaints: s.recentComplaints,
              prior_complaints: s.priorComplaints,
              recent_views: s.recentViews,
              recent_supports: s.recentSupports,
              trend_score: s.trendScore,
            };
          })
          .filter(Boolean);

        return Response.json({ items });
      },
    },
  },
});
