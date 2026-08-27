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

/** Kurumsal kayıt sonrası marka sahipliği / yönetim talebi. */
export const Route = createFileRoute("/api/corporate-register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`corp-reg:${user.id}`, 3, 24 * 60 * 60_000);

          const b = (await request.json()) as {
            companyName?: string;
            contactName?: string;
            email?: string;
            phone?: string;
            website?: string | null;
            message?: string | null;
            brandSlug?: string | null;
          };

          const companyName = b.companyName?.trim();
          const contactName = b.contactName?.trim();
          const email = (b.email ?? user.email).trim().toLowerCase();
          const phone = b.phone?.trim();

          if (!companyName || companyName.length < 2) throw new HttpError(400, "Firma adı zorunludur");
          if (!contactName) throw new HttpError(400, "Yetkili adı zorunludur");
          if (!phone) throw new HttpError(400, "Telefon zorunludur");

          let brandId: string | null = null;

          if (b.brandSlug?.trim()) {
            const [existing] = await db
              .select({ id: schema.brands.id })
              .from(schema.brands)
              .where(eq(schema.brands.slug, b.brandSlug.trim().toLowerCase()))
              .limit(1);
            brandId = existing?.id ?? null;
          }

          if (!brandId) {
            const baseSlug = slugify(b.brandSlug?.trim() || companyName);
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
                name: companyName.slice(0, 200),
                slug,
                website: b.website?.trim() || null,
                phone,
                email,
                isActive: false,
                about: "Kurumsal kayıt talebi — admin onayı bekliyor.",
              })
              .returning({ id: schema.brands.id });
            brandId = created.id;
          }

          await db.insert(schema.brandVerificationRequests).values({
            brandId,
            submittedBy: user.id,
            companyName,
            contactName,
            email,
            phone,
            website: b.website?.trim() || null,
            message: [b.message?.trim(), "Talep: Marka yönetimi / sahiplik (kurumsal kayıt)"]
              .filter(Boolean)
              .join("\n\n"),
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
