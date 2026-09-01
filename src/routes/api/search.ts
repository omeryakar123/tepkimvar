import { createFileRoute } from "@tanstack/react-router";
import { and, eq, ilike, notInArray, or } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: global arama (marka + şikayet + blog).
const HIDDEN = ["pending", "rejected", "spam"] as const;

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
        if (q.length < 2) return Response.json({ brands: [], complaints: [], blogs: [] });
        const like = `%${q}%`;
        const code = q.toUpperCase();

        const [brands, complaints, blogs] = await Promise.all([
          db
            .select({ id: schema.brands.id, slug: schema.brands.slug, name: schema.brands.name, logo_url: schema.brands.logoUrl, website: schema.brands.website })
            .from(schema.brands)
            .where(and(eq(schema.brands.isActive, true), or(ilike(schema.brands.name, like), ilike(schema.brands.slug, like))))
            .limit(6),

          db
            .select({
              id: schema.complaints.id,
              public_id: schema.complaints.publicId,
              title: schema.complaints.title,
              brand_slug: schema.brands.slug,
              brand_name: schema.brands.name,
            })
            .from(schema.complaints)
            .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
            .where(
              and(
                eq(schema.complaints.isPublic, true),
                eq(schema.complaints.hidden, false),
                notInArray(schema.complaints.status, [...HIDDEN]),
                or(
                  ilike(schema.complaints.title, like),
                  eq(schema.complaints.publicId, code),
                  eq(schema.complaints.shortId, code.toLowerCase()),
                ),
              ),
            )
            .limit(8),

          db
            .select({ id: schema.blogs.id, slug: schema.blogs.slug, title: schema.blogs.title })
            .from(schema.blogs)
            .where(and(eq(schema.blogs.status, "published"), ilike(schema.blogs.title, like)))
            .limit(4),
        ]);

        return Response.json({
          brands,
          complaints: complaints.map((c) => ({
            id: c.id,
            public_id: c.public_id,
            title: c.title,
            brands: { slug: c.brand_slug, name: c.brand_name },
          })),
          blogs,
        });
      },
    },
  },
});
