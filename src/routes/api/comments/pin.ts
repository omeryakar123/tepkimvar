import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, isStaff, requireUser } from "@/lib/server/guard";

// Yorum sabitleme. GÜVENLİK: yalnızca şikayet SAHİBİ veya personel pinleyebilir.
// (Yorum yazarı kendi yorumunu pinleyemez — eski RLS guard kuralı.)
export const Route = createFileRoute("/api/comments/pin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json()) as { commentId?: string; pinned?: boolean };
          if (!b.commentId) throw new HttpError(400, "Yorum belirtilmeli");

          const [row] = await db
            .select({
              commentId: schema.comments.id,
              complaintOwner: schema.complaints.userId,
            })
            .from(schema.comments)
            .innerJoin(schema.complaints, eq(schema.comments.complaintId, schema.complaints.id))
            .where(eq(schema.comments.id, b.commentId))
            .limit(1);
          if (!row) throw new HttpError(404, "Yorum bulunamadı");

          const allowed = row.complaintOwner === user.id || (await isStaff(user.id));
          if (!allowed) throw new HttpError(403, "Yetkiniz yok");

          await db
            .update(schema.comments)
            .set({ pinned: !!b.pinned })
            .where(eq(schema.comments.id, b.commentId));

          return Response.json({ ok: true, pinned: !!b.pinned });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
