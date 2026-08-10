import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, ne, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, isBrandMember, isStaff, rateLimit, requireUser } from "@/lib/server/guard";
import { notify } from "@/lib/server/notify";
import { publish } from "@/lib/server/events";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Participant = {
  conversationId: string;
  userId: string;
  brandId: string;
  /** İstek sahibi bu yazışmada "user" tarafı mı yoksa "brand" tarafı mı? */
  side: "user" | "brand";
};

/**
 * Katılımcı doğrulaması — TEK güvenlik sınırı. Yazışmaya yalnızca onu açan
 * kullanıcı veya markanın üyesi (ya da personel) erişebilir.
 */
async function assertParticipant(userId: string, conversationId: string): Promise<Participant> {
  if (!UUID_RE.test(conversationId)) throw new HttpError(400, "Geçersiz yazışma");
  const [conv] = await db
    .select({ userId: schema.conversations.userId, brandId: schema.conversations.brandId })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);
  if (!conv) throw new HttpError(404, "Yazışma bulunamadı");

  if (conv.userId === userId) return { conversationId, userId: conv.userId, brandId: conv.brandId, side: "user" };
  if ((await isBrandMember(userId, conv.brandId)) || (await isStaff(userId)))
    return { conversationId, userId: conv.userId, brandId: conv.brandId, side: "brand" };
  throw new HttpError(403, "Bu yazışmaya erişiminiz yok");
}

export const Route = createFileRoute("/api/messages")({
  server: {
    handlers: {
      // Bir yazışmanın mesajları. Okuyunca karşı tarafın mesajları okundu sayılır.
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
          const p = await assertParticipant(user.id, conversationId);

          const rows = await db
            .select({
              id: schema.messages.id,
              sender_id: schema.messages.senderId,
              body: schema.messages.body,
              read_at: schema.messages.readAt,
              created_at: schema.messages.createdAt,
            })
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, conversationId))
            .orderBy(asc(schema.messages.createdAt));

          // Karşı tarafın gönderdiklerini okundu işaretle (kendi tarafın değil).
          await db
            .update(schema.messages)
            .set({ readAt: new Date() })
            .where(
              and(
                eq(schema.messages.conversationId, conversationId),
                ne(schema.messages.senderId, user.id),
                isNull(schema.messages.readAt),
              ),
            );

          // İstemci "ben" tarafını mesajın gönderenine göre çözer (sender_id === user.id).
          return Response.json({ items: rows, me: user.id, side: p.side });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`msg:${user.id}`, 60, 60_000);
          const b = (await request.json()) as { conversationId?: string; body?: string };
          if (!b.conversationId) throw new HttpError(400, "Yazışma belirtilmeli");
          const body = (b.body ?? "").trim();
          if (body.length < 1) throw new HttpError(400, "Mesaj boş olamaz");

          const p = await assertParticipant(user.id, b.conversationId);

          await db.insert(schema.messages).values({
            conversationId: b.conversationId,
            senderId: user.id,
            body: body.slice(0, 4000),
          });

          // Karşı tarafa bildir: marka yazdıysa kullanıcıya, kullanıcı yazdıysa
          // markanın yazışmayı açan üyesine (basit: conversation.userId hedefi
          // yalnızca user tarafına anlamlı; marka tarafına bildirim atlanır).
          if (p.side === "brand") {
            await notify({
              userId: p.userId,
              type: "system",
              title: "Firma size mesaj gönderdi",
              body: body.slice(0, 120),
              link: "/profile?sekme=mesajlar",
              skipIfSameAs: user.id,
            });
          }

          await publish({ type: "complaint", complaintId: b.conversationId });
          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
