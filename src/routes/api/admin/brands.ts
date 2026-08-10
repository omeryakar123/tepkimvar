import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/**
 * Admin firma listesi + oluşturma/hızlı güncelleme/silme.
 * GÜVENLİK: her uç requireStaff ile başlar (RLS gitti).
 */
export const Route = createFileRoute("/api/admin/brands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const rows = await db
            .select({
              id: schema.brands.id,
              name: schema.brands.name,
              slug: schema.brands.slug,
              logo_url: schema.brands.logoUrl,
              verified: schema.brands.verified,
              premium: schema.brands.premium,
              created_at: schema.brands.createdAt,
            })
            .from(schema.brands)
            .orderBy(desc(schema.brands.createdAt));

          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            name?: string;
            slug?: string;
            website?: string | null;
            categoryId?: string | null;
          };

          const name = (b.name ?? "").trim();
          if (name.length < 2) throw new HttpError(400, "Firma adı zorunlu");

          const slug =
            (b.slug ?? "").trim() ||
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
          if (!slug) throw new HttpError(400, "Geçersiz slug");

          const [dupe] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.slug, slug))
            .limit(1);
          if (dupe) throw new HttpError(400, "Bu slug zaten kullanılıyor");

          // Kategori istemciden gelir ama VAR OLDUĞU doğrulanır.
          let categoryId: string | null = null;
          if (b.categoryId) {
            const [cat] = await db
              .select({ id: schema.categories.id })
              .from(schema.categories)
              .where(eq(schema.categories.id, b.categoryId))
              .limit(1);
            if (!cat) throw new HttpError(400, "Geçersiz kategori");
            categoryId = cat.id;
          }

          const [created] = await db
            .insert(schema.brands)
            .values({
              name: name.slice(0, 200),
              slug: slug.slice(0, 120),
              website: b.website?.trim() || null,
              categoryId,
            })
            .returning({ id: schema.brands.id });

          await audit(request, user.id, {
            action: "brand.create",
            entityType: "brand",
            entityId: created.id,
          });
          return Response.json({ id: created.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Listeden hızlı doğrulama/premium değişimi.
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            verified?: boolean;
            premium?: boolean;
          };
          if (!b.id) throw new HttpError(400, "Firma belirtilmeli");

          const patch: Partial<typeof schema.brands.$inferInsert> = { updatedAt: new Date() };
          if (typeof b.verified === "boolean") patch.verified = b.verified;
          if (typeof b.premium === "boolean") {
            patch.premium = b.premium;
            if (!b.premium) patch.premiumUntil = null;
          }
          if (Object.keys(patch).length === 1) throw new HttpError(400, "Güncellenecek alan yok");

          const [updated] = await db
            .update(schema.brands)
            .set(patch)
            .where(eq(schema.brands.id, b.id))
            .returning({ id: schema.brands.id });
          if (!updated) throw new HttpError(404, "Firma bulunamadı");

          await audit(request, user.id, {
            action: "brand.update",
            entityType: "brand",
            entityId: updated.id,
            metadata: { verified: b.verified, premium: b.premium },
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json().catch(() => ({}))) as { id?: string };
          if (!b.id) throw new HttpError(400, "Firma belirtilmeli");

          const [deleted] = await db
            .delete(schema.brands)
            .where(eq(schema.brands.id, b.id))
            .returning({ id: schema.brands.id });
          if (!deleted) throw new HttpError(404, "Firma bulunamadı");

          await audit(request, user.id, {
            action: "brand.delete",
            entityType: "brand",
            entityId: deleted.id,
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
