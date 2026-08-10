import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

const STATUSES = ["draft", "published", "archived"] as const;
type Status = (typeof STATUSES)[number];

export const Route = createFileRoute("/api/admin/blogs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const items = await db
            .select({
              id: schema.blogs.id,
              title: schema.blogs.title,
              slug: schema.blogs.slug,
              status: schema.blogs.status,
              published_at: schema.blogs.publishedAt,
              created_at: schema.blogs.createdAt,
            })
            .from(schema.blogs)
            .orderBy(desc(schema.blogs.createdAt));
          return Response.json({ items });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            title?: string;
            slug?: string;
            excerpt?: string;
            body?: string;
          };

          const title = (b.title ?? "").trim();
          const body = (b.body ?? "").trim();
          if (!title) throw new HttpError(400, "Başlık zorunlu");
          if (!body) throw new HttpError(400, "İçerik zorunlu");

          const slug =
            (b.slug ?? "").trim() ||
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
          if (!slug) throw new HttpError(400, "Geçersiz slug");

          const [created] = await db
            .insert(schema.blogs)
            .values({
              title: title.slice(0, 300),
              slug: slug.slice(0, 200),
              excerpt: (b.excerpt ?? "").trim().slice(0, 1000) || null,
              body,
              // author_id istemciden ALINMAZ — oturumdan.
              authorId: user.id,
              status: "draft",
            })
            .returning({ id: schema.blogs.id });

          await audit(request, user.id, {
            action: "blog.create",
            entityType: "blog",
            entityId: created.id,
          });
          return Response.json({ id: created.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Yayınla / taslağa al. published_at SUNUCUDA belirlenir.
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { id?: string; status?: string };
          if (!b.id) throw new HttpError(400, "Yazı belirtilmeli");
          if (!STATUSES.includes(b.status as Status)) throw new HttpError(400, "Geçersiz durum");

          const [updated] = await db
            .update(schema.blogs)
            .set({
              status: b.status as Status,
              publishedAt: b.status === "published" ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(schema.blogs.id, b.id))
            .returning({ id: schema.blogs.id });
          if (!updated) throw new HttpError(404, "Yazı bulunamadı");

          await audit(request, user.id, {
            action: "blog.status",
            entityType: "blog",
            entityId: updated.id,
            metadata: { status: b.status },
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
          if (!b.id) throw new HttpError(400, "Yazı belirtilmeli");

          const [deleted] = await db
            .delete(schema.blogs)
            .where(eq(schema.blogs.id, b.id))
            .returning({ id: schema.blogs.id });
          if (!deleted) throw new HttpError(404, "Yazı bulunamadı");

          await audit(request, user.id, {
            action: "blog.delete",
            entityType: "blog",
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
