import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested, type DbComplaintShape } from "@/lib/db-shapes";
import { TALKED_PRIORITY_BRAND_SLUGS } from "@/lib/featured-brands";
import { errorResponse } from "@/lib/server/guard";

const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

function visibleComplaints() {
  return and(
    notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
    eq(schema.complaints.hidden, false),
    or(eq(schema.complaints.isPublic, true), eq(schema.complaints.isSynthetic, true)),
  );
}

async function attachProfiles(rows: { c: typeof schema.complaints.$inferSelect; b: typeof schema.brands.$inferSelect }[]) {
  const userIds = Array.from(new Set(rows.map((r) => r.c.userId).filter(Boolean) as string[]));
  const profs =
    userIds.length > 0
      ? await db
          .select({
            id: schema.profiles.id,
            full_name: schema.profiles.fullName,
            username: schema.profiles.username,
            avatar_url: schema.profiles.avatarUrl,
          })
          .from(schema.profiles)
          .where(inArray(schema.profiles.id, userIds))
      : [];
  const userMap = new Map(profs.map((p) => [p.id, p]));

  const items: DbComplaintShape[] = [];
  for (const r of rows) {
    const brand: BrandNested = {
      name: r.b.name,
      slug: r.b.slug,
      logo_url: r.b.logoUrl,
      verified: r.b.verified,
    };
    const dc = toDbComplaint(r.c, brand);
    if (dc.is_anonymous) {
      dc.user_id = null;
      dc.profiles = null;
    } else if (r.c.userId) {
      const pr = userMap.get(r.c.userId);
      dc.profiles = pr
        ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
        : null;
    }
    items.push(dc);
  }
  return items;
}

/** Çok konuşulanlar — önce sabit markalar (Jojobet, Holiganbet, …), sonra rastgele doldurma. */
export const Route = createFileRoute("/api/home-talked")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const limit = Math.min(8, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 4));
          const pickedIds: string[] = [];
          const priorityRows: { c: typeof schema.complaints.$inferSelect; b: typeof schema.brands.$inferSelect }[] = [];

          for (const slug of TALKED_PRIORITY_BRAND_SLUGS) {
            const [row] = await db
              .select({ c: schema.complaints, b: schema.brands })
              .from(schema.complaints)
              .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
              .where(and(visibleComplaints(), eq(schema.brands.slug, slug), eq(schema.brands.isActive, true)))
              .orderBy(desc(schema.complaints.votes), desc(schema.complaints.views), desc(schema.complaints.createdAt))
              .limit(1);
            if (row && !pickedIds.includes(row.c.id)) {
              priorityRows.push(row);
              pickedIds.push(row.c.id);
            }
          }

          const remaining = Math.max(0, limit - priorityRows.length);
          const fillerRows =
            remaining > 0
              ? await db
                  .select({ c: schema.complaints, b: schema.brands })
                  .from(schema.complaints)
                  .innerJoin(schema.brands, eq(schema.complaints.brandId, schema.brands.id))
                  .where(
                    and(
                      visibleComplaints(),
                      pickedIds.length > 0 ? notInArray(schema.complaints.id, pickedIds) : undefined,
                    ),
                  )
                  .orderBy(sql`RANDOM()`)
                  .limit(remaining * 3)
              : [];

          const merged = [...priorityRows];
          for (const row of fillerRows) {
            if (merged.length >= limit) break;
            if (pickedIds.includes(row.c.id)) continue;
            merged.push(row);
            pickedIds.push(row.c.id);
          }

          const items = await attachProfiles(merged.slice(0, limit));
          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
