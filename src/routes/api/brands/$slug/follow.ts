import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  errorResponse,
  HttpError,
  optionalUser,
  rateLimit,
  requireUser,
} from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";

export const Route = createFileRoute("/api/brands/$slug/follow")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          await ensureDbPatches();
          const user = await optionalUser(request);
          if (!user) return Response.json({ following: false, count: 0 });

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.slug, params.slug))
            .limit(1);
          if (!brand) throw new HttpError(404, "Marka bulunamadı");

          const [row] = await db
            .select({ id: sql<number>`1` })
            .from(schema.brandFollows)
            .where(
              and(
                eq(schema.brandFollows.userId, user.id),
                eq(schema.brandFollows.brandId, brand.id),
              ),
            )
            .limit(1);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.brandFollows)
            .where(eq(schema.brandFollows.userId, user.id));

          return Response.json({ following: !!row, count: Number(count ?? 0) });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ params, request }) => {
        try {
          const user = await requireUser(request);
          await ensureDbPatches();
          rateLimit(`brand-follow:${user.id}`, 60, 60 * 60_000);

          const [brand] = await db
            .select({ id: schema.brands.id, name: schema.brands.name })
            .from(schema.brands)
            .where(eq(schema.brands.slug, params.slug))
            .limit(1);
          if (!brand) throw new HttpError(404, "Marka bulunamadı");

          const [existing] = await db
            .select({ userId: schema.brandFollows.userId })
            .from(schema.brandFollows)
            .where(
              and(
                eq(schema.brandFollows.userId, user.id),
                eq(schema.brandFollows.brandId, brand.id),
              ),
            )
            .limit(1);

          if (existing) {
            await db
              .delete(schema.brandFollows)
              .where(
                and(
                  eq(schema.brandFollows.userId, user.id),
                  eq(schema.brandFollows.brandId, brand.id),
                ),
              );
            return Response.json({ following: false });
          }

          await db.insert(schema.brandFollows).values({
            userId: user.id,
            brandId: brand.id,
          });

          return Response.json({ following: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
