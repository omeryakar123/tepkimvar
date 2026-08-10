import { createFileRoute } from "@tanstack/react-router";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: aktif kategoriler + kategori başına şikayet sayısı.
// data.ts hem ensureCategoryCache hem fetchCategoriesWithCount için kullanır.
export const Route = createFileRoute("/api/categories")({
  server: {
    handlers: {
      GET: async () => {
        const cats = await db
          .select({
            id: schema.categories.id,
            name: schema.categories.name,
            slug: schema.categories.slug,
            icon: schema.categories.icon,
            sort_order: schema.categories.sortOrder,
          })
          .from(schema.categories)
          .where(eq(schema.categories.isActive, true))
          .orderBy(asc(schema.categories.sortOrder));

        // Grouped count — kategori başına sayı (tüm satırları çekmeden).
        const grouped = await db
          .select({
            categoryId: schema.complaints.categoryId,
            count: sql<number>`count(*)`,
          })
          .from(schema.complaints)
          .groupBy(schema.complaints.categoryId);

        const counts: Record<string, number> = {};
        for (const g of grouped) {
          if (g.categoryId) counts[g.categoryId] = Number(g.count);
        }

        return Response.json({ categories: cats, counts });
      },
    },
  },
});
