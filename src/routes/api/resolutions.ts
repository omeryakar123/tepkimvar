import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { publish } from "@/lib/server/events";
import { recordStatusChange } from "@/lib/server/history";

// Public: bir şikayetin çözüm kaydı (varsa) — tekil ResolutionRow ya da null.
export const Route = createFileRoute("/api/resolutions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const complaintId = url.searchParams.get("complaintId");
        if (!complaintId) return Response.json(null);

        const [r] = await db
          .select()
          .from(schema.complaintResolutions)
          .where(eq(schema.complaintResolutions.complaintId, complaintId))
          .limit(1);
        if (!r) return Response.json(null);

        return Response.json({
          id: r.id,
          complaint_id: r.complaintId,
          brand_id: r.brandId,
          user_id: r.userId,
          thanks_message: r.thanksMessage,
          resolution_rating: r.resolutionRating,
          created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        });
      },

      // Çözüm kaydı. GÜVENLİK: yalnızca şikayetin SAHİBİ, ve brand_id şikayetin
      // gerçek markası olmak zorunda (eski RLS'te bu açıktı: başkasının
      // şikayetine sahte çözüm eklenebiliyordu). Şikayet durumu da burada
      // 'resolved' yapılır — istemci status set edemez.
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`resolution:${user.id}`, 20, 60 * 60_000);

          const b = (await request.json()) as {
            complaintId?: string;
            resolutionRating?: number;
            thanksMessage?: string | null;
          };
          if (!b.complaintId) throw new HttpError(400, "Şikayet belirtilmeli");
          const rating = Math.max(1, Math.min(5, Math.round(Number(b.resolutionRating) || 5)));

          const [c] = await db
            .select({ id: schema.complaints.id, userId: schema.complaints.userId, brandId: schema.complaints.brandId, status: schema.complaints.status })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, b.complaintId))
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");
          if (c.userId !== user.id) throw new HttpError(403, "Yalnızca şikayet sahibi kapatabilir");

          const [existing] = await db
            .select({ id: schema.complaintResolutions.id })
            .from(schema.complaintResolutions)
            .where(eq(schema.complaintResolutions.complaintId, c.id))
            .limit(1);
          if (existing) throw new HttpError(409, "Bu şikayet zaten kapatılmış");

          await db.insert(schema.complaintResolutions).values({
            complaintId: c.id,
            brandId: c.brandId, // istemciden DEĞİL, şikayetin gerçek markasından
            userId: user.id,
            resolutionRating: rating,
            thanksMessage: b.thanksMessage?.trim() || null,
          });

          await db
            .update(schema.complaints)
            .set({ status: "resolved", updatedAt: new Date() })
            .where(eq(schema.complaints.id, c.id));

          await recordStatusChange({
            complaintId: c.id,
            fromStatus: c.status,
            toStatus: "resolved",
            changedBy: user.id,
            actorRole: "user",
            note: "Kullanıcı şikayeti çözüldü olarak kapattı",
          });

          await publish({ type: "complaint", complaintId: c.id });
          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
