import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

// Türkçe-duyarlı slug: ç/ğ/ı/ö/ş/ü → ascii, boşluk → tire.
const TR: Record<string, string> = {
  "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "I": "i", "İ": "i",
  "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u",
};
function slugify(s: string): string {
  return s
    .trim()
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug boş/dolu olsun, benzersizliğini uygula (excludeId hariç). */
async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<void> {
  const clash = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(
      excludeId
        ? and(eq(schema.categories.slug, slug), ne(schema.categories.id, excludeId))
        : eq(schema.categories.slug, slug),
    )
    .limit(1);
  if (clash.length) throw new HttpError(409, `"${slug}" slug'ı zaten kullanımda`);
}

// Kategori yönetimi. Tüm uçlar requireStaff (admin/super_admin) ile korunur.
export const Route = createFileRoute("/api/admin/categories")({
  server: {
    handlers: {
      // Pasifler dahil TÜM kategoriler + kategori başına firma sayısı.
      GET: async ({ request }) => {
        try {
          await requireStaff(request);

          const cats = await db
            .select({
              id: schema.categories.id,
              name: schema.categories.name,
              slug: schema.categories.slug,
              icon: schema.categories.icon,
              sort_order: schema.categories.sortOrder,
              is_active: schema.categories.isActive,
            })
            .from(schema.categories)
            .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));

          const grouped = await db
            .select({
              categoryId: schema.brands.categoryId,
              count: sql<number>`count(*)`,
            })
            .from(schema.brands)
            .groupBy(schema.brands.categoryId);

          const brandCounts: Record<string, number> = {};
          for (const g of grouped) if (g.categoryId) brandCounts[g.categoryId] = Number(g.count);

          return Response.json({ items: cats, brandCounts });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Oluştur.
      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            name?: string;
            slug?: string;
            icon?: string | null;
            sortOrder?: number;
          };
          const name = (b.name ?? "").trim();
          if (name.length < 2) throw new HttpError(400, "Kategori adı en az 2 karakter");

          const slug = slugify(b.slug?.trim() || name);
          if (!slug) throw new HttpError(400, "Geçerli bir slug üretilemedi");
          await ensureUniqueSlug(slug);

          const [row] = await db
            .insert(schema.categories)
            .values({
              name,
              slug,
              icon: b.icon?.trim() || null,
              sortOrder: Number.isFinite(b.sortOrder) ? Number(b.sortOrder) : 0,
            })
            .returning({ id: schema.categories.id });

          await audit(request, user.id, {
            action: "category.create",
            entityType: "category",
            entityId: row.id,
            metadata: { name, slug },
          });
          return Response.json({ ok: true, id: row.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Güncelle (name/slug/icon/sortOrder/isActive — verilen alanlar).
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            name?: string;
            slug?: string;
            icon?: string | null;
            sortOrder?: number;
            isActive?: boolean;
          };
          if (!b.id) throw new HttpError(400, "Kategori belirtilmeli");

          const patch: Partial<typeof schema.categories.$inferInsert> = {};
          if (typeof b.name === "string") {
            const name = b.name.trim();
            if (name.length < 2) throw new HttpError(400, "Kategori adı en az 2 karakter");
            patch.name = name;
          }
          if (typeof b.slug === "string") {
            const slug = slugify(b.slug);
            if (!slug) throw new HttpError(400, "Geçerli bir slug üretilemedi");
            await ensureUniqueSlug(slug, b.id);
            patch.slug = slug;
          }
          if ("icon" in b) patch.icon = b.icon?.trim() || null;
          if (typeof b.sortOrder === "number") patch.sortOrder = b.sortOrder;
          if (typeof b.isActive === "boolean") patch.isActive = b.isActive;

          if (Object.keys(patch).length === 0) throw new HttpError(400, "Güncellenecek alan yok");

          const [row] = await db
            .update(schema.categories)
            .set(patch)
            .where(eq(schema.categories.id, b.id))
            .returning({ id: schema.categories.id });
          if (!row) throw new HttpError(404, "Kategori bulunamadı");

          await audit(request, user.id, {
            action: "category.update",
            entityType: "category",
            entityId: b.id,
            metadata: patch as Record<string, unknown>,
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Sil. FK'ler ON DELETE SET NULL: bağlı firmalar/şikayetler kategorisiz kalır.
      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json().catch(() => ({}))) as { id?: string };
          if (!b.id) throw new HttpError(400, "Kategori belirtilmeli");

          const [row] = await db
            .delete(schema.categories)
            .where(eq(schema.categories.id, b.id))
            .returning({ id: schema.categories.id });
          if (!row) throw new HttpError(404, "Kategori bulunamadı");

          await audit(request, user.id, {
            action: "category.delete",
            entityType: "category",
            entityId: b.id,
            severity: "warn",
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
