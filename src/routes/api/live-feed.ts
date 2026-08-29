import { createFileRoute } from "@tanstack/react-router";
import { and, inArray, notInArray, or, sql, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested, type DbComplaintShape } from "@/lib/db-shapes";
import { errorResponse } from "@/lib/server/guard";

const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

/** Anasayfa canlı akış — bot/sentetik şikayetler dahil, rastgele sıra. */
export const Route = createFileRoute("/api/live-feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const limit = Math.min(12, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 6));

          const rows = await db
            .select({ c: schema.complaints, b: schema.brands })
            .from(schema.complaints)
            .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
            .where(
              and(
                notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
                or(
                  eq(schema.complaints.isPublic, true),
                  eq(schema.complaints.isSynthetic, true),
                ),
              ),
            )
            .orderBy(sql`RANDOM()`)
            .limit(limit);

          const items: DbComplaintShape[] = rows.map((r) => {
            const brand: BrandNested = {
              name: r.b.name,
              slug: r.b.slug,
              logo_url: r.b.logoUrl,
              verified: r.b.verified,
            };
            const dc = toDbComplaint(r.c, brand);
            if (dc.is_anonymous) dc.user_id = null;
            return dc;
          });

          const ids = Array.from(
            new Set(items.filter((i) => !i.is_anonymous && i.user_id).map((i) => i.user_id as string)),
          );
          if (ids.length > 0) {
            const profs = await db
              .select({
                id: schema.profiles.id,
                full_name: schema.profiles.fullName,
                username: schema.profiles.username,
                avatar_url: schema.profiles.avatarUrl,
              })
              .from(schema.profiles)
              .where(inArray(schema.profiles.id, ids));
            const map = new Map(profs.map((pr) => [pr.id, pr]));
            for (const it of items) {
              if (!it.is_anonymous && it.user_id) {
                const pr = map.get(it.user_id);
                it.profiles = pr
                  ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
                  : null;
              }
            }
          }

          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
