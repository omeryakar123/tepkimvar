import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/** Tek firma: admin düzenleme ekranı. Personel dışına kapalı. */

/** Sadece kendi dosya ucumuz veya http(s). `javascript:` gibi şemalar reddedilir. */
function safeUrl(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new HttpError(400, `Geçersiz ${field}`);
  const s = v.trim();
  if (s.length > 1000) throw new HttpError(400, `Geçersiz ${field}`);
  if (s.startsWith("/api/files/") || /^https?:\/\//i.test(s)) return s;
  throw new HttpError(400, `Geçersiz ${field}`);
}

function text(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new HttpError(400, "Geçersiz değer");
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function toShape(r: typeof schema.brands.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    about: r.about,
    website: r.website,
    phone: r.phone,
    email: r.email,
    address: r.address,
    city: r.city,
    logo_url: r.logoUrl,
    cover_url: r.coverUrl,
    cover_video: r.coverVideo,
    gallery: Array.isArray(r.gallery) ? (r.gallery as string[]) : [],
    seo_title: r.seoTitle,
    seo_description: r.seoDescription,
    verified: r.verified,
    premium: r.premium,
    is_active: r.isActive,
    premium_until: r.premiumUntil ? r.premiumUntil.toISOString() : null,
  };
}

export const Route = createFileRoute("/api/admin/brands/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          await requireStaff(request);
          const [row] = await db
            .select()
            .from(schema.brands)
            .where(eq(schema.brands.id, params.id))
            .limit(1);
          if (!row) throw new HttpError(404, "Firma bulunamadı");
          return Response.json(toShape(row));
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as Record<string, unknown>;

          const patch: Partial<typeof schema.brands.$inferInsert> = { updatedAt: new Date() };

          if ("name" in b) {
            const name = text(b.name, 200);
            if (!name) throw new HttpError(400, "Firma adı zorunlu");
            patch.name = name;
          }
          if ("about" in b) patch.about = text(b.about, 5000);
          if ("website" in b) patch.website = text(b.website, 300);
          if ("phone" in b) patch.phone = text(b.phone, 50);
          if ("email" in b) patch.email = text(b.email, 200);
          if ("address" in b) patch.address = text(b.address, 500);
          if ("city" in b) patch.city = text(b.city, 100);
          if ("seo_title" in b) patch.seoTitle = text(b.seo_title, 200);
          if ("seo_description" in b) patch.seoDescription = text(b.seo_description, 500);

          if ("logo_url" in b) patch.logoUrl = safeUrl(b.logo_url, "logo");
          if ("cover_url" in b) patch.coverUrl = safeUrl(b.cover_url, "kapak");
          if ("cover_video" in b) patch.coverVideo = safeUrl(b.cover_video, "video");

          if ("gallery" in b) {
            const g = b.gallery;
            if (!Array.isArray(g)) throw new HttpError(400, "Geçersiz galeri");
            if (g.length > 50) throw new HttpError(400, "Galeri en fazla 50 görsel olabilir");
            patch.gallery = g.map((u) => safeUrl(u, "galeri")).filter((u): u is string => !!u);
          }

          if ("verified" in b) {
            if (typeof b.verified !== "boolean") throw new HttpError(400, "Geçersiz değer");
            patch.verified = b.verified;
          }
          if ("is_active" in b) {
            if (typeof b.is_active !== "boolean") throw new HttpError(400, "Geçersiz değer");
            patch.isActive = b.is_active;
          }
          if ("premium" in b) {
            if (typeof b.premium !== "boolean") throw new HttpError(400, "Geçersiz değer");
            patch.premium = b.premium;
          }
          if ("premium_until" in b) {
            if (b.premium_until === null || b.premium_until === "") {
              patch.premiumUntil = null;
            } else if (typeof b.premium_until === "string") {
              const d = new Date(b.premium_until);
              if (Number.isNaN(d.getTime())) throw new HttpError(400, "Geçersiz tarih");
              patch.premiumUntil = d;
            } else {
              throw new HttpError(400, "Geçersiz tarih");
            }
          }

          if (Object.keys(patch).length === 1) throw new HttpError(400, "Güncellenecek alan yok");

          const [updated] = await db
            .update(schema.brands)
            .set(patch)
            .where(eq(schema.brands.id, params.id))
            .returning();
          if (!updated) throw new HttpError(404, "Firma bulunamadı");

          await audit(request, user.id, {
            action: "brand.update",
            entityType: "brand",
            entityId: updated.id,
            metadata: { fields: Object.keys(b) },
          });
          return Response.json(toShape(updated));
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
