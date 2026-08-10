import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { notifyComplaintOwner } from "@/lib/server/notify";
import { publish } from "@/lib/server/events";
import { recordStatusChange } from "@/lib/server/history";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Şikayet yanıt thread'i (marka ↔ şikayet sahibi yazışması).
 * İç notlar (is_internal) DIŞARI VERİLMEZ. Marka yanıtları /api/brand/complaints
 * üzerinden gelir; burası şikayet SAHİBİNİN takip cevabı için.
 */
export const Route = createFileRoute("/api/complaint-replies")({
  server: {
    handlers: {
      // Public: bir şikayetin (iç not olmayan) yanıtları, yazar bilgisiyle.
      GET: async ({ request }) => {
        const complaintId = new URL(request.url).searchParams.get("complaintId");
        if (!complaintId || !UUID_RE.test(complaintId)) return Response.json([]);

        const [c] = await db
          .select({
            brandName: schema.brands.name,
            ownerId: schema.complaints.userId,
            isAnonymous: schema.complaints.isAnonymous,
            anonName: schema.complaints.anonName,
          })
          .from(schema.complaints)
          .innerJoin(schema.brands, eq(schema.brands.id, schema.complaints.brandId))
          .where(eq(schema.complaints.id, complaintId))
          .limit(1);
        if (!c) return Response.json([]);

        const rows = await db
          .select({
            id: schema.complaintReplies.id,
            body: schema.complaintReplies.body,
            is_brand: schema.complaintReplies.isBrand,
            created_at: schema.complaintReplies.createdAt,
          })
          .from(schema.complaintReplies)
          .where(
            and(
              eq(schema.complaintReplies.complaintId, complaintId),
              eq(schema.complaintReplies.isInternal, false),
            ),
          )
          .orderBy(asc(schema.complaintReplies.createdAt));

        const ownerName = c.isAnonymous ? c.anonName ?? "Anonim" : "Şikayet sahibi";
        return Response.json(
          rows.map((r) => ({
            id: r.id,
            body: r.body,
            is_brand: r.is_brand,
            author: r.is_brand ? c.brandName : ownerName,
            created_at: r.created_at,
          })),
        );
      },

      // Şikayet SAHİBİ takip cevabı yazar. GÜVENLİK: yalnızca sahip; is_brand
      // sunucuda false; durum 'user_replied' olur (marka yeniden ilgilensin).
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`creply:${user.id}`, 30, 60 * 60_000);

          const b = (await request.json()) as { complaintId?: string; body?: string };
          if (!b.complaintId || !UUID_RE.test(b.complaintId)) throw new HttpError(400, "Şikayet belirtilmeli");
          const body = (b.body ?? "").trim();
          if (body.length < 2) throw new HttpError(400, "Yanıt çok kısa");

          const [c] = await db
            .select({ id: schema.complaints.id, userId: schema.complaints.userId, status: schema.complaints.status })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.complaintId))
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");
          if (c.userId !== user.id) throw new HttpError(403, "Yalnızca şikayet sahibi cevap yazabilir");

          await db.insert(schema.complaintReplies).values({
            complaintId: c.id,
            userId: user.id,
            body: body.slice(0, 5000),
            isBrand: false,
            isInternal: false,
          });

          // Durumu 'user_replied' yap (çözülmüş/reddedilmiş değilse).
          if (c.status !== "resolved" && c.status !== "rejected" && c.status !== "spam") {
            await db
              .update(schema.complaints)
              .set({ status: "user_replied", updatedAt: new Date() })
              .where(eq(schema.complaints.id, c.id));
            await recordStatusChange({
              complaintId: c.id,
              fromStatus: c.status,
              toStatus: "user_replied",
              changedBy: user.id,
              actorRole: "user",
              note: "Kullanıcı cevap yazdı",
            });
          }

          await publish({ type: "complaint", complaintId: c.id });
          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
