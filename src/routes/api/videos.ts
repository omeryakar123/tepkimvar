import { createFileRoute } from "@tanstack/react-router";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { optionalUser } from "@/lib/server/guard";

// Public: yayınlanmış videolar (+ oturum varsa beğendiklerim).
export const Route = createFileRoute("/api/videos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rows = await db
          .select()
          .from(schema.videos)
          .where(eq(schema.videos.status, "published"))
          .orderBy(desc(schema.videos.createdAt));

        // Oturum varsa hangi videoları beğendiğini işaretle.
        let likedIds: string[] = [];
        const user = await optionalUser(request);
        if (user && rows.length) {
          const likes = await db
            .select({ videoId: schema.videoLikes.videoId })
            .from(schema.videoLikes)
            .where(inArray(schema.videoLikes.videoId, rows.map((r) => r.id)));
          likedIds = likes.map((l) => l.videoId);
        }
        const likedSet = new Set(likedIds);

        return Response.json(
          rows.map((v) => ({
            liked: likedSet.has(v.id),
            ...v,
            cover_url: v.coverUrl,
            video_url: v.videoUrl,
            created_at: v.createdAt,
            category_id: v.categoryId,
            author_id: v.authorId,
          })),
        );
      },
    },
  },
});
