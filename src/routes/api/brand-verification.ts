import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

/**
 * Marka doğrulama TALEBİ. GÜVENLİK: submitted_by oturumdan, status daima
 * 'pending'. Kullanıcı kendi kendini doğrulayamaz; onay yalnızca
 * /api/admin/verification üzerinden personel tarafından verilir.
 */
export const Route = createFileRoute("/api/brand-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`verify-req:${user.id}`, 5, 24 * 60 * 60_000);

          const b = (await request.json()) as {
            brandId?: string;
            companyName?: string;
            contactName?: string;
            email?: string;
            phone?: string;
            website?: string | null;
            message?: string | null;
          };

          if (!b.brandId) throw new HttpError(400, "Firma belirtilmeli");
          for (const [key, label] of [
            ["companyName", "Firma adı"],
            ["contactName", "Yetkili adı"],
            ["email", "E-posta"],
            ["phone", "Telefon"],
          ] as const) {
            if (!String(b[key] ?? "").trim()) throw new HttpError(400, `${label} zorunludur`);
          }

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, b.brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          await db.insert(schema.brandVerificationRequests).values({
            brandId: b.brandId,
            submittedBy: user.id,
            companyName: b.companyName!.trim(),
            contactName: b.contactName!.trim(),
            email: b.email!.trim(),
            phone: b.phone!.trim(),
            website: b.website?.trim() || null,
            message: b.message?.trim() || null,
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
