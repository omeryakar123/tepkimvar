import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, isBrandMember, requireUser } from "@/lib/server/guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Özel yazışmalar (kullanıcı ↔ marka).
 *
 * GET (kullanıcı görünümü): kendi başlattığı yazışmalar.
 * GET ?brandId= (marka görünümü): o markaya gelen yazışmalar (üyelik şart).
 * POST: kullanıcı bir markayla (opsiyonel bir şikayet üzerinden) yazışma açar.
 *
 * Yetki: bir yazışmaya yalnızca SAHİBİ (user) ya da MARKA ÜYESİ erişebilir —
 * bkz. mesajlar ucundaki assertParticipant.
 */
export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId = new URL(request.url).searchParams.get("brandId");

          if (brandId) {
            // Marka görünümü — üyelik/personel şart.
            if (!UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");
            const { isStaff } = await import("@/lib/server/guard");
            if (!(await isBrandMember(user.id, brandId)) && !(await isStaff(user.id)))
              throw new HttpError(403, "Bu firmaya erişiminiz yok");

            const rows = await db
              .select({
                id: schema.conversations.id,
                complaint_id: schema.conversations.complaintId,
                created_at: schema.conversations.createdAt,
                counterpart: schema.profiles.fullName,
              })
              .from(schema.conversations)
              .leftJoin(schema.profiles, eq(schema.profiles.id, schema.conversations.userId))
              .where(eq(schema.conversations.brandId, brandId))
              .orderBy(desc(schema.conversations.createdAt))
              .limit(100);
            return Response.json({ items: rows });
          }

          // Kullanıcı görünümü — kendi yazışmaları.
          const rows = await db
            .select({
              id: schema.conversations.id,
              complaint_id: schema.conversations.complaintId,
              created_at: schema.conversations.createdAt,
              counterpart: schema.brands.name,
              brand_slug: schema.brands.slug,
            })
            .from(schema.conversations)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.conversations.brandId))
            .where(eq(schema.conversations.userId, user.id))
            .orderBy(desc(schema.conversations.createdAt))
            .limit(100);
          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json()) as { brandId?: string; complaintId?: string };
          if (!b.brandId || !UUID_RE.test(b.brandId)) throw new HttpError(400, "Firma belirtilmeli");

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, b.brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          // Aynı kullanıcı-marka(-şikayet) için varsa mevcut yazışmayı döndür.
          const complaintId = b.complaintId && UUID_RE.test(b.complaintId) ? b.complaintId : null;
          const [existing] = await db
            .select({ id: schema.conversations.id })
            .from(schema.conversations)
            .where(
              and(
                eq(schema.conversations.userId, user.id),
                eq(schema.conversations.brandId, b.brandId),
                complaintId
                  ? eq(schema.conversations.complaintId, complaintId)
                  : isNull(schema.conversations.complaintId),
              ),
            )
            .limit(1);
          if (existing) return Response.json({ id: existing.id }, { status: 200 });

          const [created] = await db
            .insert(schema.conversations)
            .values({ userId: user.id, brandId: b.brandId, complaintId })
            .returning({ id: schema.conversations.id });

          return Response.json({ id: created.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
