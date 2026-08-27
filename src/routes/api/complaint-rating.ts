import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { publish } from "@/lib/server/events";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";
import {
  HttpError,
  errorResponse,
  optionalUser,
  rateLimit,
  requireUser,
} from "@/lib/server/guard";

/**
 * ŞİKAYET BAZLI memnuniyet oyu.
 *
 * Kullanıcı, yazdığı şikayetin sonucundan memnun olup olmadığını 1-5 yıldızla
 * belirtir; bu not `complaints.rating` alanına yazılır ve markanın site
 * genelindeki yıldız ortalamasına DOĞRUDAN girer (bkz. brand-stats.ts).
 *
 * Çözüm tüneli (/api/resolutions) da aynı alanı yazar; ikisi tek kaynağı
 * güncellediği için bir şikayet ortalamaya en fazla BİR kez katılır.
 *
 * Oy hakkı: yalnızca şikayet SAHİBİ ve şikayet sitede yayınlanmış durumdaysa.
 * Markanın yanıt vermesi ŞART DEĞİL — yanıtsız bırakılan bir şikayete de
 * düşük puan verilebilmelidir.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bu durumlarda oy kullanılamaz (yayında değil ya da moderasyon kararı var). */
const BLOCKED = ["pending", "rejected", "spam", "archived"] as const;

type ComplaintRow = {
  id: string;
  userId: string;
  brandId: string;
  status: string;
  rating: number | null;
};

async function loadOwnComplaint(complaintId: string, userId: string): Promise<ComplaintRow> {
  if (!UUID_RE.test(complaintId)) throw new HttpError(400, "Şikayet belirtilmeli");

  const [c] = await db
    .select({
      id: schema.complaints.id,
      userId: schema.complaints.userId,
      brandId: schema.complaints.brandId,
      status: schema.complaints.status,
      rating: schema.complaints.rating,
    })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, complaintId))
    .limit(1);

  if (!c) throw new HttpError(404, "Şikayet bulunamadı");
  if (c.userId !== userId) throw new HttpError(403, "Yalnızca şikayet sahibi oy verebilir");
  if ((BLOCKED as readonly string[]).includes(c.status))
    throw new HttpError(409, "Bu şikayet için oy kullanılamaz");

  return c;
}

export const Route = createFileRoute("/api/complaint-rating")({
  server: {
    handlers: {
      /**
       * Oy hakkı + mevcut oy. Sahiplik SUNUCUDA belirlenir; anonim şikayetlerde
       * user_id istemciye hiç gönderilmediği için tek doğru yol budur.
       */
      GET: async ({ request }) => {
        try {
          const complaintId = new URL(request.url).searchParams.get("complaintId") ?? "";
          const user = await optionalUser(request);
          if (!user || !UUID_RE.test(complaintId)) {
            return Response.json({ can_rate: false, rating: null });
          }

          const [c] = await db
            .select({
              userId: schema.complaints.userId,
              status: schema.complaints.status,
              rating: schema.complaints.rating,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.id, complaintId))
            .limit(1);

          if (!c || c.userId !== user.id) {
            return Response.json({ can_rate: false, rating: null });
          }

          return Response.json({
            can_rate: !(BLOCKED as readonly string[]).includes(c.status),
            rating: c.rating,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /** Oy ver / oyu değiştir. */
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`complaint-rating:${user.id}`, 40, 60 * 60_000);

          const b = (await request.json()) as { complaintId?: string; rating?: number };
          const rating = Math.round(Number(b.rating));
          if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, "Puan 1-5 arasında olmalı");

          const c = await loadOwnComplaint(b.complaintId ?? "", user.id);

          await db
            .update(schema.complaints)
            .set({ rating, updatedAt: new Date() })
            .where(eq(schema.complaints.id, c.id));

          // Çözüm kaydı varsa oradaki not da güncellenir; aksi halde şikayet
          // sayfasındaki "Çözüm Hikayesi · X/5" etiketi eski değeri gösterir.
          await db
            .update(schema.complaintResolutions)
            .set({ resolutionRating: rating })
            .where(eq(schema.complaintResolutions.complaintId, c.id));

          await refreshBrandAggregates(c.brandId);
          await publish({ type: "complaint", complaintId: c.id });

          await audit(request, user.id, {
            action: "complaint.rate",
            entityType: "complaint",
            entityId: c.id,
            metadata: { rating },
          });

          return Response.json({ ok: true, rating });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /** Oyu kaldır. */
      DELETE: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json().catch(() => ({}))) as { complaintId?: string };
          const c = await loadOwnComplaint(b.complaintId ?? "", user.id);

          const [resolution] = await db
            .select({ id: schema.complaintResolutions.id })
            .from(schema.complaintResolutions)
            .where(eq(schema.complaintResolutions.complaintId, c.id))
            .limit(1);
          if (resolution)
            throw new HttpError(409, "Çözüm kaydı bulunan şikayetin puanı kaldırılamaz");

          await db
            .update(schema.complaints)
            .set({ rating: null, updatedAt: new Date() })
            .where(eq(schema.complaints.id, c.id));

          await refreshBrandAggregates(c.brandId);
          await publish({ type: "complaint", complaintId: c.id });

          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
