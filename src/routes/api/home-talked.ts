import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested, type DbComplaintShape } from "@/lib/db-shapes";
import { TALKED_PRIORITY_BRAND_SLUGS } from "@/lib/featured-brands";
import { errorResponse } from "@/lib/server/guard";
import { generateTalkedPreviewComments } from "@/lib/server/talked-preview-comments";

const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

type TalkedItem = DbComplaintShape & {
  preview_comments: {
    id: string;
    body: string;
    created_at: string;
    profiles: { full_name: string | null; username: string | null } | null;
  }[];
};

function visibleComplaints() {
  return and(
    notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
    or(eq(schema.complaints.isPublic, true), eq(schema.complaints.isSynthetic, true)),
  );
}

async function attachCommentsAndProfiles(rows: { c: typeof schema.complaints.$inferSelect; b: typeof schema.brands.$inferSelect }[]) {
  const complaintIds = rows.map((r) => r.c.id);
  const commentRows =
    complaintIds.length > 0
      ? await db
          .select()
          .from(schema.comments)
          .where(inArray(schema.comments.complaintId, complaintIds))
          .orderBy(desc(schema.comments.createdAt))
      : [];

  const commentUserIds = Array.from(new Set(commentRows.map((c) => c.userId)));
  const commentProfiles =
    commentUserIds.length > 0
      ? await db
          .select({
            id: schema.profiles.id,
            full_name: schema.profiles.fullName,
            username: schema.profiles.username,
          })
          .from(schema.profiles)
          .where(inArray(schema.profiles.id, commentUserIds))
      : [];
  const profileMap = new Map(commentProfiles.map((p) => [p.id, p]));

  const commentsByComplaint = new Map<string, TalkedItem["preview_comments"]>();
  for (const c of commentRows) {
    const list = commentsByComplaint.get(c.complaintId) ?? [];
    if (list.length >= 3) continue;
    const pr = profileMap.get(c.userId);
    list.push({
      id: c.id,
      body: c.body,
      created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
      profiles: pr ? { full_name: pr.full_name, username: pr.username } : null,
    });
    commentsByComplaint.set(c.complaintId, list);
  }

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

  const items: TalkedItem[] = [];
  for (const r of rows) {
    const brand: BrandNested = {
      name: r.b.name,
      slug: r.b.slug,
      logo_url: r.b.logoUrl,
      verified: r.b.verified,
    };
    const dc = toDbComplaint(r.c, brand) as TalkedItem;
    if (dc.is_anonymous) {
      dc.user_id = null;
      dc.profiles = null;
    } else if (r.c.userId) {
      const pr = userMap.get(r.c.userId);
      dc.profiles = pr
        ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
        : null;
    }
    dc.preview_comments = commentsByComplaint.get(r.c.id) ?? [];

    const PREVIEW_TARGET = 3;
    if (dc.preview_comments.length < PREVIEW_TARGET) {
      const need = PREVIEW_TARGET - dc.preview_comments.length;
      const existingBodies = dc.preview_comments.map((c) => c.body);
      const existingNames = dc.preview_comments
        .map((c) => c.profiles?.full_name ?? c.profiles?.username ?? "")
        .filter(Boolean);
      const generated = generateTalkedPreviewComments({
        complaintId: r.c.id,
        brandName: r.b.name,
        title: r.c.title,
        body: r.c.body,
        scenario: r.c.botScenario,
        count: need,
        avoidBodies: existingBodies,
        avoidNames: existingNames,
      });
      dc.preview_comments = [...dc.preview_comments, ...generated];
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

          const items = await attachCommentsAndProfiles(merged.slice(0, limit));
          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
