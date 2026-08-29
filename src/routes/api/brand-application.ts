import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/** Marka başvuru formu — kayıt sonrası gönderilir. */
export const Route = createFileRoute("/api/brand-application")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`brand-app:${user.id}`, 3, 24 * 60 * 60_000);

          const b = (await request.json()) as {
            brandName?: string;
            contactName?: string;
            email?: string;
            phone?: string;
            telegram?: string;
            address?: string;
            photoUrl?: string | null;
            website?: string | null;
          };

          const brandName = b.brandName?.trim();
          const contactName = b.contactName?.trim();
          const email = (b.email ?? user.email).trim().toLowerCase();
          const phone = b.phone?.trim();
          const telegram = b.telegram?.trim();
          const address = b.address?.trim();

          if (!brandName || brandName.length < 2) throw new HttpError(400, "Marka adı zorunludur");
          if (!contactName) throw new HttpError(400, "Yetkili adı zorunludur");
          if (!phone) throw new HttpError(400, "Telefon zorunludur");
          if (!telegram) throw new HttpError(400, "Telegram kullanıcı adı zorunludur");
          if (!address || address.length < 10) throw new HttpError(400, "Güncel adres zorunludur");
          if (!b.photoUrl?.trim()) throw new HttpError(400, "Telefon / kimlik fotoğrafı zorunludur");

          const baseSlug = slugify(brandName);
          let slug = baseSlug || `firma-${Date.now()}`;
          for (let i = 0; i < 5; i++) {
            const [dupe] = await db
              .select({ id: schema.brands.id })
              .from(schema.brands)
              .where(eq(schema.brands.slug, slug))
              .limit(1);
            if (!dupe) break;
            slug = `${baseSlug}-${i + 2}`;
          }

          const [created] = await db
            .insert(schema.brands)
            .values({
              name: brandName.slice(0, 200),
              slug,
              website: b.website?.trim() || null,
              phone,
              email,
              isActive: false,
              about: "Marka başvurusu — admin onayı bekliyor.",
            })
            .returning({ id: schema.brands.id });

          await db.insert(schema.brandVerificationRequests).values({
            brandId: created.id,
            submittedBy: user.id,
            companyName: brandName,
            contactName,
            email,
            phone,
            website: b.website?.trim() || null,
            telegram,
            address,
            photoUrl: b.photoUrl.trim(),
            requestType: "brand_application",
            message: "Marka yönetim paneli başvurusu.",
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
