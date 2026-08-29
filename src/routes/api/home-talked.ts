import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbComplaint, type BrandNested, type DbComplaintShape } from "@/lib/db-shapes";
import { errorResponse } from "@/lib/server/guard";

const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

type TalkedItem = DbComplaintShape & {
  preview_comments: {
    id: string;
    body: string;
    created_at: string;
    profiles: { full_name: string | null; username: string | null } | null;
  }[];
};

/** Çok konuşulanlar — rastgele şikayet + son kullanıcı yorumları. */
export const Route = createFileRoute("/api/home-talked")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const limit = Math.min(8, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 4));

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
            .limit(limit * 3);

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
            if (list.length >= 2) continue;
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
            if (items.length >= limit) break;
            const brand: BrandNested = {
              name: r.b.name,
              slug: r.b.slug,
              logo_url: r.b.logoUrl,
              verified: r.b.verified,
            };
            const dc = toDbComplaint(r.c, brand) as TalkedItem;
            if (r.c.userId) {
              const pr = userMap.get(r.c.userId);
              dc.profiles = pr
                ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
                : null;
            }
            dc.preview_comments = commentsByComplaint.get(r.c.id) ?? [];
            items.push(dc);
          }

          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
