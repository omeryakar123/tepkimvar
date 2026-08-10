import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { publish } from "@/lib/server/events";

// Yorum oylama. GÜVENLİK: kullanıcı başına tek oy (composite PK upsert) ve
// upvotes/downvotes istemciden ASLA alınmaz — comment_votes'tan yeniden sayılır.
export const Route = createFileRoute("/api/comments/vote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`vote:${user.id}`, 60, 60_000);

          const b = (await request.json()) as { commentId?: string; vote?: number };
          if (!b.commentId) throw new HttpError(400, "Yorum belirtilmeli");
          const vote = b.vote === 1 ? 1 : b.vote === -1 ? -1 : 0;
          if (vote === 0) throw new HttpError(400, "Geçersiz oy");

          const [c] = await db
            .select({ id: schema.comments.id, complaintId: schema.comments.complaintId })
            .from(schema.comments)
            .where(eq(schema.comments.id, b.commentId))
            .limit(1);
          if (!c) throw new HttpError(404, "Yorum bulunamadı");

          await db
            .insert(schema.commentVotes)
            .values({ commentId: b.commentId, userId: user.id, vote })
            .onConflictDoUpdate({
              target: [schema.commentVotes.commentId, schema.commentVotes.userId],
              set: { vote },
            });

          // Sayaçları oylardan yeniden hesapla (istemci manipülasyonu imkânsız).
          const [agg] = await db
            .select({
              up: sql<number>`count(*) filter (where ${schema.commentVotes.vote} = 1)`,
              down: sql<number>`count(*) filter (where ${schema.commentVotes.vote} = -1)`,
            })
            .from(schema.commentVotes)
            .where(eq(schema.commentVotes.commentId, b.commentId));

          await db
            .update(schema.comments)
            .set({ upvotes: Number(agg.up) || 0, downvotes: Number(agg.down) || 0 })
            .where(eq(schema.comments.id, b.commentId));

          await publish({ type: "vote", complaintId: c.complaintId });
          return Response.json({ upvotes: Number(agg.up) || 0, downvotes: Number(agg.down) || 0 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
