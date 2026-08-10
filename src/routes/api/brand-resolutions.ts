import { createFileRoute } from "@tanstack/react-router";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: bir markanın son çözümleri, nested complaints ve profiles ile.
export const Route = createFileRoute("/api/brand-resolutions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const brandId = url.searchParams.get("brandId");
        const limit = Number(url.searchParams.get("limit")) || 12;
        if (!brandId) return Response.json([]);

        const rows = await db
          .select({ r: schema.complaintResolutions, c: schema.complaints })
          .from(schema.complaintResolutions)
          .leftJoin(
            schema.complaints,
            eq(schema.complaintResolutions.complaintId, schema.complaints.id),
          )
          .where(eq(schema.complaintResolutions.brandId, brandId))
          .orderBy(desc(schema.complaintResolutions.createdAt))
          .limit(limit);

        const items = rows.map((row) => ({
          id: row.r.id,
          complaint_id: row.r.complaintId,
          brand_id: row.r.brandId,
          user_id: row.r.userId,
          thanks_message: row.r.thanksMessage,
          resolution_rating: row.r.resolutionRating,
          created_at:
            row.r.createdAt instanceof Date ? row.r.createdAt.toISOString() : String(row.r.createdAt),
          complaints: row.c
            ? { id: row.c.id, title: row.c.title, public_id: row.c.publicId }
            : null,
          profiles: null as
            | { full_name: string | null; username: string | null; avatar_url: string | null }
            | null,
        }));

        const ids = Array.from(new Set(items.map((i) => i.user_id).filter(Boolean)));
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
            const pr = map.get(it.user_id);
            it.profiles = pr
              ? { full_name: pr.full_name, username: pr.username, avatar_url: pr.avatar_url }
              : null;
          }
        }

        return Response.json(items);
      },
    },
  },
});
