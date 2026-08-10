import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

const REASONS = [
  "wrong_brand", "duplicate", "spam", "insult", "profanity", "wrong_category",
  "legal", "fake_document", "fake_screenshot", "adult", "spam_ad", "other",
] as const;

// Şikayeti Super Admin'e ilet. GÜVENLİK: raised_by oturumdan, brand_id
// şikayetin gerçek markasından; status daima 'open' (kullanıcı karar veremez).
export const Route = createFileRoute("/api/escalations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`escalation:${user.id}`, 20, 60 * 60_000);

          const b = (await request.json()) as {
            complaintId?: string;
            reason?: string;
            note?: string | null;
          };
          if (!b.complaintId) throw new HttpError(400, "Şikayet belirtilmeli");
          if (!REASONS.includes(b.reason as (typeof REASONS)[number]))
            throw new HttpError(400, "Geçersiz sebep");

          const [c] = await db
            .select({ id: schema.complaints.id, brandId: schema.complaints.brandId })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.complaintId))
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");

          await db.insert(schema.complaintEscalations).values({
            complaintId: c.id,
            brandId: c.brandId, // istemciden DEĞİL
            raisedBy: user.id,
            reason: b.reason as (typeof REASONS)[number],
            note: b.note?.trim() || null,
            status: "open",
          });

          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
