import { createFileRoute } from "@tanstack/react-router";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbBrand } from "@/lib/db-shapes";
import { PRIORITY_BRAND_SLUGS } from "@/lib/featured-brands";

function brandPriorityOrder() {
  const whens = PRIORITY_BRAND_SLUGS.map(
    (slug, i) => sql`WHEN ${slug} THEN ${i}`,
  );
  return sql`CASE ${schema.brands.slug} ${sql.join(whens, sql` `)} ELSE ${PRIORITY_BRAND_SLUGS.length} END`;
}

// Public: firma listesi.
export const Route = createFileRoute("/api/brands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const p = url.searchParams;
        const categorySlug = p.get("categorySlug") ?? undefined;
        const categoryIdParam = p.get("categoryId") ?? undefined;
        const search = p.get("search") ?? undefined;
        const sortBy = p.get("sortBy") ?? undefined;
        const limitParam = p.get("limit");
        const pageParam = p.get("page");
        const pageSize = Number(p.get("pageSize")) || 12;

        const conditions: SQL[] = [eq(schema.brands.isActive, true)];

        let categoryId = categoryIdParam;
        if (!categoryId && categorySlug) {
          const [cat] = await db
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(eq(schema.categories.slug, categorySlug))
            .limit(1);
          categoryId = cat?.id;
          if (!categoryId) return Response.json({ items: [], total: 0 });
        }
        if (categoryId) conditions.push(eq(schema.brands.categoryId, categoryId));
        if (search) conditions.push(ilike(schema.brands.name, `%${search}%`));
        // Footer/filtre linkleri için: yalnızca doğrulanmış ya da premium markalar.
        if (p.get("verified") === "1") conditions.push(eq(schema.brands.verified, true));
        if (p.get("premium") === "1") conditions.push(eq(schema.brands.premium, true));

        const where = and(...conditions);
        const secondaryOrder =
          sortBy === "rating"
            ? desc(schema.brands.rating)
            : sortBy === "resolution"
              ? desc(schema.brands.resolutionRate)
              : sortBy === "complaints"
                ? desc(schema.brands.totalComplaints)
                : desc(schema.brands.createdAt);

        const base = db
          .select()
          .from(schema.brands)
          .where(where)
          .orderBy(...(search ? [secondaryOrder] : [asc(brandPriorityOrder()), secondaryOrder]))
          .$dynamic();

        let rows: (typeof schema.brands.$inferSelect)[];
        let total = 0;

        if (limitParam) {
          rows = await base.limit(Number(limitParam));
          total = rows.length;
        } else if (pageParam) {
          const page = Math.max(1, Number(pageParam));
          rows = await base.limit(pageSize).offset((page - 1) * pageSize);
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.brands)
            .where(where);
          total = Number(count);
        } else {
          rows = await base;
          total = rows.length;
        }

        return Response.json({ items: rows.map(toDbBrand), total });
      },
    },
  },
});
