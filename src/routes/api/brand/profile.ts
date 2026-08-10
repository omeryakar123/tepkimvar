import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  HttpError,
  errorResponse,
  requireBrandAccess,
  requireUser,
} from "@/lib/server/guard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marka temsilcisinin düzenleyebileceği TEK alan kümesi. */
type Patch = {
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  about?: string | null;
  socials?: unknown;
  business_hours?: unknown;
  logo_url?: string | null;
  cover_url?: string | null;
};

function str(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function plainObject(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object" || Array.isArray(v))
    throw new HttpError(400, "Geçersiz veri");
  return v as Record<string, unknown>;
}

/** Yüklenen görsel yolu yalnızca kendi /api/files anahtarımız olabilir. */
function mediaUrl(v: unknown): string | null {
  const s = str(v, 500);
  if (!s) return null;
  if (!/^(https?:\/\/|\/api\/files\/)/i.test(s))
    throw new HttpError(400, "Geçersiz görsel adresi");
  return s;
}

async function loadBrand(brandId: string) {
  const [row] = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
      slug: schema.brands.slug,
      website: schema.brands.website,
      phone: schema.brands.phone,
      email: schema.brands.email,
      address: schema.brands.address,
      city: schema.brands.city,
      about: schema.brands.about,
      logo_url: schema.brands.logoUrl,
      cover_url: schema.brands.coverUrl,
      socials: schema.brands.socials,
      business_hours: schema.brands.businessHours,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, brandId))
    .limit(1);
  return row ?? null;
}

/**
 * Marka profili.
 * GÜVENLİK:
 *  - brandId istemciden gelir, requireBrandAccess ile doğrulanmadan kullanılmaz.
 *  - PATCH'te istek gövdesi ASLA spread edilmez; aşağıdaki beyaz liste dışında
 *    hiçbir kolon yazılmaz. verified / premium / premium_until / tier / rating /
 *    total_complaints / resolution_rate ve tüm sayaçlar marka tarafından
 *    değiştirilemez.
 */
export const Route = createFileRoute("/api/brand/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId =
            new URL(request.url).searchParams.get("brandId") ?? "";
          if (!UUID_RE.test(brandId))
            throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          const brand = await loadBrand(brandId);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");
          return Response.json({ brand });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = (await request.json()) as Patch & { brandId?: string };
          const brandId = body.brandId ?? "";
          if (!UUID_RE.test(brandId))
            throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          // ---- BEYAZ LİSTE (tek tek, spread YOK) ----
          const set: Partial<typeof schema.brands.$inferInsert> = {};
          if ("name" in body) {
            const name = str(body.name, 160);
            if (!name) throw new HttpError(400, "Firma adı boş olamaz");
            set.name = name;
          }
          if ("website" in body) set.website = str(body.website, 300);
          if ("phone" in body) set.phone = str(body.phone, 32);
          if ("email" in body) set.email = str(body.email, 200);
          if ("address" in body) set.address = str(body.address, 500);
          if ("city" in body) set.city = str(body.city, 100);
          if ("about" in body) set.about = str(body.about, 5000);
          if ("socials" in body) set.socials = plainObject(body.socials) ?? {};
          if ("business_hours" in body)
            set.businessHours = plainObject(body.business_hours) ?? {};
          if ("logo_url" in body) set.logoUrl = mediaUrl(body.logo_url);
          if ("cover_url" in body) set.coverUrl = mediaUrl(body.cover_url);

          if (Object.keys(set).length === 0)
            throw new HttpError(400, "Güncellenecek alan yok");
          set.updatedAt = new Date();

          await db
            .update(schema.brands)
            .set(set)
            .where(eq(schema.brands.id, brandId));

          const brand = await loadBrand(brandId);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");
          return Response.json({ brand });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
