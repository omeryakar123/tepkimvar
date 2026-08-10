import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/**
 * CMS blokları. Anahtar listesi panelde sabit; sunucu da beyaz listeyle
 * doğrular ki rastgele blok yaratılamasın.
 */
const KEYS = [
  "hero",
  "slider",
  "banner",
  "stats",
  "categories",
  "footer",
  "header",
  "about",
  "contact",
  "faq",
] as const;
type Key = (typeof KEYS)[number];

export const Route = createFileRoute("/api/admin/cms")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const key = new URL(request.url).searchParams.get("key") ?? "";
          if (!KEYS.includes(key as Key)) throw new HttpError(400, "Geçersiz blok");

          const [row] = await db
            .select({ data: schema.cmsBlocks.data })
            .from(schema.cmsBlocks)
            .where(eq(schema.cmsBlocks.key, key))
            .limit(1);

          return Response.json({ data: row?.data ?? {} });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Upsert (cms_blocks.key üzerinde unique index yok, elle yapılıyor).
      PUT: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { key?: string; data?: unknown };
          if (!KEYS.includes(b.key as Key)) throw new HttpError(400, "Geçersiz blok");
          if (b.data === null || typeof b.data !== "object")
            throw new HttpError(400, "Geçersiz içerik");

          const key = b.key as Key;
          const [existing] = await db
            .select({ id: schema.cmsBlocks.id })
            .from(schema.cmsBlocks)
            .where(eq(schema.cmsBlocks.key, key))
            .limit(1);

          if (existing) {
            await db
              .update(schema.cmsBlocks)
              .set({ data: b.data, type: key, updatedAt: new Date() })
              .where(eq(schema.cmsBlocks.id, existing.id));
          } else {
            await db.insert(schema.cmsBlocks).values({ key, type: key, data: b.data });
          }

          await audit(request, user.id, {
            action: "cms.update",
            entityType: "cms_block",
            entityId: key,
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
