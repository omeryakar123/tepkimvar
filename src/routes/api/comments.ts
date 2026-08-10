import { createFileRoute } from "@tanstack/react-router";
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { publish } from "@/lib/server/events";
import { notifyComplaintOwner } from "@/lib/server/notify";

// Public: bir şikayetin yorumları (pinli önce, sonra tarih artan).
export const Route = createFileRoute("/api/comments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const complaintId = url.searchParams.get("complaintId");
        if (!complaintId) return Response.json([]);

        const rows = await db
          .select()
          .from(schema.comments)
          .where(eq(schema.comments.complaintId, complaintId))
          .orderBy(desc(schema.comments.pinned), asc(schema.comments.createdAt));

        const items = rows.map((r) => ({
          id: r.id,
          complaint_id: r.complaintId,
          parent_id: r.parentId,
          user_id: r.userId,
          body: r.body,
          pinned: r.pinned,
          upvotes: r.upvotes,
          downvotes: r.downvotes,
          created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
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

      // Yorum ekle. GÜVENLİK: user_id oturumdan; upvotes/downvotes/pinned
      // istemciden alınmaz (eski RLS guard trigger'ının karşılığı).
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          // Spam koruması: dakikada 10 yorum.
          rateLimit(`comment:${user.id}`, 10, 60_000);

          const b = (await request.json()) as {
            complaintId?: string;
            body?: string;
            parentId?: string | null;
          };
          const body = (b.body ?? "").trim();
          if (!b.complaintId) throw new HttpError(400, "Şikayet belirtilmeli");
          if (body.length < 2) throw new HttpError(400, "Yorum çok kısa");

          // Yorum yalnızca herkese açık (moderasyondan geçmiş) şikayete yazılabilir.
          const [c] = await db
            .select({ id: schema.complaints.id })
            .from(schema.complaints)
            .where(
              and(
                eq(schema.complaints.id, b.complaintId),
                eq(schema.complaints.isPublic, true),
                notInArray(schema.complaints.status, ["pending", "rejected", "spam"]),
              ),
            )
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");

          const [created] = await db
            .insert(schema.comments)
            .values({
              complaintId: b.complaintId,
              userId: user.id,
              body: body.slice(0, 2000),
              parentId: b.parentId || null,
              upvotes: 0,
              downvotes: 0,
              pinned: false,
            })
            .returning({ id: schema.comments.id });

          await notifyComplaintOwner(b.complaintId, {
            type: "comment",
            title: "Şikayetinize yeni yorum geldi",
            body: body.slice(0, 160),
            skipIfSameAs: user.id,
          });

          await publish({ type: "comment", complaintId: b.complaintId });
          return Response.json({ id: created.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
