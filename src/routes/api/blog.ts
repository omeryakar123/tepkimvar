import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: yayınlanmış blog yazıları. Taslaklar ASLA dışarı verilmez.
export const Route = createFileRoute("/api/blog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const p = new URL(request.url).searchParams;
        const slug = p.get("slug");
        const page = Math.max(1, Number(p.get("page")) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(p.get("pageSize")) || 12));

        const published = eq(schema.blogs.status, "published");

        // Tek yazı
        if (slug) {
          const [row] = await db
            .select()
            .from(schema.blogs)
            .where(and(published, eq(schema.blogs.slug, slug)))
            .limit(1);
          if (!row) return Response.json(null, { status: 404 });
          return Response.json({
            id: row.id,
            slug: row.slug,
            title: row.title,
            body: row.body,
            excerpt: row.excerpt,
            category: row.category,
            cover_url: row.coverUrl,
            seo_title: row.seoTitle,
            seo_description: row.seoDescription,
            published_at: row.publishedAt ?? row.createdAt,
          });
        }

        // Liste (gövde hariç — sayfa hafif kalsın)
        const rows = await db
          .select({
            id: schema.blogs.id,
            slug: schema.blogs.slug,
            title: schema.blogs.title,
            excerpt: schema.blogs.excerpt,
            category: schema.blogs.category,
            cover_url: schema.blogs.coverUrl,
            published_at: schema.blogs.publishedAt,
            created_at: schema.blogs.createdAt,
          })
          .from(schema.blogs)
          .where(published)
          .orderBy(desc(sql`coalesce(${schema.blogs.publishedAt}, ${schema.blogs.createdAt})`))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.blogs)
          .where(published);

        return Response.json({
          items: rows.map((r) => ({ ...r, published_at: r.published_at ?? r.created_at })),
          total: Number(count),
        });
      },
    },
  },
});
