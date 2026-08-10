import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, requireBrandAccess, requireUser } from "@/lib/server/guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLANS = ["standard", "pro", "kurumsal"] as const;

/**
 * Marka premium başvurusu. GÜVENLİK: her işlem markaya erişim doğrulamasından
 * geçer (brandId istemciden gelse de üyelik/personel şartı aranır). Başvuru
 * status'u daima 'pending' — marka kendini premium yapamaz, onay admin'de.
 */
export const Route = createFileRoute("/api/brand/premium")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId = new URL(request.url).searchParams.get("brandId") ?? "";
          if (!UUID_RE.test(brandId)) throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          const [brand] = await db
            .select({ premium: schema.brands.premium, tier: schema.brands.tier })
            .from(schema.brands)
            .where(eq(schema.brands.id, brandId))
            .limit(1);

          const requests = await db
            .select({
              id: schema.premiumRequests.id,
              plan: schema.premiumRequests.plan,
              status: schema.premiumRequests.status,
              note: schema.premiumRequests.note,
              created_at: schema.premiumRequests.createdAt,
              decided_at: schema.premiumRequests.decidedAt,
            })
            .from(schema.premiumRequests)
            .where(eq(schema.premiumRequests.brandId, brandId))
            .orderBy(desc(schema.premiumRequests.createdAt))
            .limit(20);

          return Response.json({ premium: brand?.premium ?? false, tier: brand?.tier ?? "standard", requests });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json()) as { brandId?: string; plan?: string; note?: string };
          if (!b.brandId || !UUID_RE.test(b.brandId)) throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, b.brandId);
          const plan = PLANS.includes(b.plan as (typeof PLANS)[number]) ? (b.plan as string) : "pro";

          // Bekleyen başvuru varsa yenisini engelle.
          const [pending] = await db
            .select({ id: schema.premiumRequests.id })
            .from(schema.premiumRequests)
            .where(and(eq(schema.premiumRequests.brandId, b.brandId), eq(schema.premiumRequests.status, "pending")))
            .limit(1);
          if (pending) throw new HttpError(409, "Zaten bekleyen bir başvurunuz var");

          await db.insert(schema.premiumRequests).values({
            brandId: b.brandId,
            requestedBy: user.id,
            plan,
            note: b.note?.trim()?.slice(0, 500) || null,
            status: "pending",
          });

          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
