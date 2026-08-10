import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

// robots.txt — sitemap adresi domain'e göre üretilir (sabit lovable.app yerine).
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          // Panel ve API yolları indekslenmesin.
          "Disallow: /admin",
          "Disallow: /brand",
          "Disallow: /api/",
          "Disallow: /profile",
          "",
          `Sitemap: ${SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
