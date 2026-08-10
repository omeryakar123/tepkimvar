import { createFileRoute } from "@tanstack/react-router";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

const TARGETS = ["complaint", "comment", "attachment", "video", "user", "brand"] as const;
const REASONS = ["spam", "insult", "adult", "misinformation", "fraud", "other"] as const;

// İçerik raporlama. GÜVENLİK: reporter_id oturumdan; status daima 'open'
// (kullanıcı kendi raporunu "incelendi" yapamaz).
export const Route = createFileRoute("/api/reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          // Spam koruması: saatte 20 rapor.
          rateLimit(`report:${user.id}`, 20, 60 * 60_000);

          const b = (await request.json()) as {
            targetType?: string;
            targetId?: string;
            reason?: string;
            note?: string | null;
          };
          if (!b.targetId) throw new HttpError(400, "Hedef belirtilmeli");
          if (!TARGETS.includes(b.targetType as (typeof TARGETS)[number]))
            throw new HttpError(400, "Geçersiz hedef türü");
          if (!REASONS.includes(b.reason as (typeof REASONS)[number]))
            throw new HttpError(400, "Geçersiz sebep");

          await db.insert(schema.contentReports).values({
            reporterId: user.id,
            targetType: b.targetType as (typeof TARGETS)[number],
            targetId: b.targetId,
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
