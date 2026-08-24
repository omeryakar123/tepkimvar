import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Coolify'da SITE_URL env'i ile kendi domainini ver.
const BASE_URL = process.env.SITE_URL || "https://itirazvarplus.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/markalar", changefreq: "daily", priority: "0.9" },
          { path: "/trendler", changefreq: "hourly", priority: "0.9" },
          { path: "/arama", changefreq: "weekly", priority: "0.5" },
          { path: "/sikayet-yaz", changefreq: "monthly", priority: "0.6" },
          { path: "/reklam-cozumleri", changefreq: "monthly", priority: "0.6" },
          { path: "/hakkimizda", changefreq: "monthly", priority: "0.5" },
          { path: "/seffaflik-raporu", changefreq: "monthly", priority: "0.5" },
          { path: "/yardim", changefreq: "monthly", priority: "0.5" },
          { path: "/iletisim", changefreq: "monthly", priority: "0.4" },
          { path: "/kullanim-kosullari", changefreq: "yearly", priority: "0.3" },
          { path: "/gizlilik", changefreq: "yearly", priority: "0.3" },
          { path: "/kvkk", changefreq: "yearly", priority: "0.3" },
        ];

        // Dinamik marka, kategori ve şikayet sayfaları (Drizzle)
        try {
          const { db, schema } = await import("@/db");
          const { eq, and, notInArray, desc } = await import("drizzle-orm");

          const [brands, cats, complaints] = await Promise.all([
            db.select({ slug: schema.brands.slug }).from(schema.brands)
              .where(eq(schema.brands.isActive, true)).limit(2000),
            db.select({ slug: schema.categories.slug }).from(schema.categories)
              .where(eq(schema.categories.isActive, true)).limit(500),
            // SEO: şikayet detayları da haritaya girsin (uzun kuyruk trafiği).
            db.select({ publicId: schema.complaints.publicId, id: schema.complaints.id })
              .from(schema.complaints)
              .where(and(
                eq(schema.complaints.isPublic, true),
                notInArray(schema.complaints.status, ["pending", "rejected", "spam"]),
              ))
              .orderBy(desc(schema.complaints.createdAt))
              .limit(5000),
          ]);

          for (const b of brands) {
            if (b.slug) entries.push({ path: `/firma/${b.slug}`, changefreq: "weekly", priority: "0.7" });
          }
          for (const c of cats) {
            if (c.slug) entries.push({ path: `/kategori/${c.slug}`, changefreq: "weekly", priority: "0.6" });
          }
          for (const c of complaints) {
            entries.push({ path: `/sikayet/${c.publicId ?? c.id}`, changefreq: "weekly", priority: "0.6" });
          }

          // Blog yazıları (yalnızca yayınlananlar)
          const posts = await db
            .select({ slug: schema.blogs.slug })
            .from(schema.blogs)
            .where(eq(schema.blogs.status, "published"))
            .limit(1000);
          entries.push({ path: "/blog", changefreq: "weekly", priority: "0.6" });
          for (const b of posts) {
            entries.push({ path: `/blog/${b.slug}`, changefreq: "monthly", priority: "0.6" });
          }
        } catch {
          // hata olursa statik girdilerle devam et
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
