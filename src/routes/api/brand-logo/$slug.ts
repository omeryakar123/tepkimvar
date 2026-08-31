import { createFileRoute } from "@tanstack/react-router";
import { resolveBrandLogo } from "@/lib/server/brand-logo-resolve";

/** Marka logosu — eksik/bozuk logoları sunucuda çözümler ve kalıcı kaydeder. */
export const Route = createFileRoute("/api/brand-logo/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const hit = await resolveBrandLogo(params.slug);
        if (!hit) return new Response("Not found", { status: 404 });
        return new Response(hit.buf, {
          headers: {
            "Content-Type": hit.type,
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
            "X-Brand-Logo-Url": hit.logoUrl,
          },
        });
      },
    },
  },
});
