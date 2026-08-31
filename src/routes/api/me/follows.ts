import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireUser } from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";

/** Oturum açmış kullanıcının takip ettiği markalar. */
export const Route = createFileRoute("/api/me/follows")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          await ensureDbPatches();

          const rows = await db
            .select({
              brand_id: schema.brandFollows.brandId,
              slug: schema.brands.slug,
              name: schema.brands.name,
              logo_url: schema.brands.logoUrl,
              created_at: schema.brandFollows.createdAt,
            })
            .from(schema.brandFollows)
            .innerJoin(schema.brands, eq(schema.brandFollows.brandId, schema.brands.id))
            .where(eq(schema.brandFollows.userId, user.id))
            .orderBy(schema.brandFollows.createdAt);

          return Response.json({ count: rows.length, items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
