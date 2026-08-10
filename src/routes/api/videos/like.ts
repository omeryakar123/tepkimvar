import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

/**
 * Video beğeni (toggle). GÜVENLİK: kullanıcı başına tek beğeni (composite PK),
 * likes sayacı istemciden ALINMAZ — video_likes'tan yeniden sayılır.
 */
export const Route = createFileRoute("/api/videos/like")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`vlike:${user.id}`, 120, 60_000);

          const b = (await request.json()) as { videoId?: string };
          if (!b.videoId) throw new HttpError(400, "Video belirtilmeli");

          const [v] = await db
            .select({ id: schema.videos.id })
            .from(schema.videos)
            .where(eq(schema.videos.id, b.videoId))
            .limit(1);
          if (!v) throw new HttpError(404, "Video bulunamadı");

          // Toggle: varsa kaldır, yoksa ekle.
          const [existing] = await db
            .select({ videoId: schema.videoLikes.videoId })
            .from(schema.videoLikes)
            .where(and(eq(schema.videoLikes.videoId, b.videoId), eq(schema.videoLikes.userId, user.id)))
            .limit(1);

          let liked: boolean;
          if (existing) {
            await db
              .delete(schema.videoLikes)
              .where(and(eq(schema.videoLikes.videoId, b.videoId), eq(schema.videoLikes.userId, user.id)));
            liked = false;
          } else {
            await db.insert(schema.videoLikes).values({ videoId: b.videoId, userId: user.id }).onConflictDoNothing();
            liked = true;
          }

          const [agg] = await db
            .select({ n: sql<number>`count(*)` })
            .from(schema.videoLikes)
            .where(eq(schema.videoLikes.videoId, b.videoId));
          const likes = Number(agg.n) || 0;

          await db.update(schema.videos).set({ likes }).where(eq(schema.videos.id, b.videoId));

          return Response.json({ liked, likes });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
