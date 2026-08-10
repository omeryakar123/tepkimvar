import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

const STATUSES = ["published", "draft", "archived"] as const;
type Status = (typeof STATUSES)[number];

/** Kendi dosya ucumuz ya da http(s). `javascript:` vb. reddedilir. */
function safeUrl(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new HttpError(400, `Geçersiz ${field}`);
  const s = v.trim();
  if (s.length > 1000) throw new HttpError(400, `Geçersiz ${field}`);
  if (s.startsWith("/api/files/") || /^https?:\/\//i.test(s)) return s;
  throw new HttpError(400, `Geçersiz ${field}`);
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `v-${Date.now()}`
  );
}

export const Route = createFileRoute("/api/admin/videos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const p = new URL(request.url).searchParams;
          const page = Math.max(1, Number(p.get("page")) || 1);
          const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize")) || 12));

          const rows = await db
            .select({
              id: schema.videos.id,
              slug: schema.videos.slug,
              title: schema.videos.title,
              description: schema.videos.description,
              cover_url: schema.videos.coverUrl,
              video_url: schema.videos.videoUrl,
              status: schema.videos.status,
              views: schema.videos.views,
              likes: schema.videos.likes,
              created_at: schema.videos.createdAt,
            })
            .from(schema.videos)
            .orderBy(desc(schema.videos.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.videos);

          return Response.json({ items: rows, total: Number(count) });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as Record<string, unknown>;

          const title = String(b.title ?? "").trim();
          if (!title) throw new HttpError(400, "Başlık zorunlu");
          const videoUrl = safeUrl(b.video_url, "video adresi");
          if (!videoUrl) throw new HttpError(400, "Video URL zorunlu");
          const status = String(b.status ?? "published");
          if (!STATUSES.includes(status as Status)) throw new HttpError(400, "Geçersiz durum");

          const slug = slugify(String(b.slug ?? "").trim() || title);
          const [dupe] = await db
            .select({ id: schema.videos.id })
            .from(schema.videos)
            .where(eq(schema.videos.slug, slug))
            .limit(1);
          if (dupe) throw new HttpError(400, "Bu slug zaten kullanılıyor");

          const [created] = await db
            .insert(schema.videos)
            .values({
              title: title.slice(0, 300),
              slug,
              description: String(b.description ?? "").trim().slice(0, 5000) || null,
              coverUrl: safeUrl(b.cover_url, "kapak"),
              videoUrl,
              status: status as Status,
              // author_id istemciden ALINMAZ — oturumdan.
              authorId: user.id,
            })
            .returning({ id: schema.videos.id });

          await audit(request, user.id, {
            action: "video.create",
            entityType: "video",
            entityId: created.id,
          });
          return Response.json({ id: created.id }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as Record<string, unknown>;
          const id = typeof b.id === "string" ? b.id : "";
          if (!id) throw new HttpError(400, "Video belirtilmeli");

          const patch: Partial<typeof schema.videos.$inferInsert> = { updatedAt: new Date() };

          if ("title" in b) {
            const title = String(b.title ?? "").trim();
            if (!title) throw new HttpError(400, "Başlık zorunlu");
            patch.title = title.slice(0, 300);
          }
          if ("slug" in b) {
            const slug = slugify(String(b.slug ?? "").trim() || String(b.title ?? "").trim());
            const [dupe] = await db
              .select({ id: schema.videos.id })
              .from(schema.videos)
              .where(and(eq(schema.videos.slug, slug), ne(schema.videos.id, id)))
              .limit(1);
            if (dupe) throw new HttpError(400, "Bu slug zaten kullanılıyor");
            patch.slug = slug;
          }
          if ("description" in b)
            patch.description = String(b.description ?? "").trim().slice(0, 5000) || null;
          if ("cover_url" in b) patch.coverUrl = safeUrl(b.cover_url, "kapak");
          if ("video_url" in b) {
            const videoUrl = safeUrl(b.video_url, "video adresi");
            if (!videoUrl) throw new HttpError(400, "Video URL zorunlu");
            patch.videoUrl = videoUrl;
          }
          if ("status" in b) {
            const status = String(b.status ?? "");
            if (!STATUSES.includes(status as Status)) throw new HttpError(400, "Geçersiz durum");
            patch.status = status as Status;
          }

          if (Object.keys(patch).length === 1) throw new HttpError(400, "Güncellenecek alan yok");

          const [updated] = await db
            .update(schema.videos)
            .set(patch)
            .where(eq(schema.videos.id, id))
            .returning({ id: schema.videos.id });
          if (!updated) throw new HttpError(404, "Video bulunamadı");

          await audit(request, user.id, {
            action: "video.update",
            entityType: "video",
            entityId: updated.id,
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
          if (!b.id) throw new HttpError(400, "Video belirtilmeli");

          const [deleted] = await db
            .delete(schema.videos)
            .where(eq(schema.videos.id, b.id))
            .returning({ id: schema.videos.id });
          if (!deleted) throw new HttpError(404, "Video bulunamadı");

          await audit(request, user.id, {
            action: "video.delete",
            entityType: "video",
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
