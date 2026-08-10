import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireUser } from "@/lib/server/guard";

/**
 * Kendi bildirimlerin. GÜVENLİK: her sorgu oturumdaki user.id ile sınırlı;
 * istemciden gelen bir kullanıcı kimliği ASLA kullanılmaz.
 */
export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20));

          const items = await db
            .select({
              id: schema.notifications.id,
              type: schema.notifications.type,
              title: schema.notifications.title,
              body: schema.notifications.body,
              link: schema.notifications.link,
              read_at: schema.notifications.readAt,
              created_at: schema.notifications.createdAt,
            })
            .from(schema.notifications)
            .where(eq(schema.notifications.userId, user.id))
            .orderBy(desc(schema.notifications.createdAt))
            .limit(limit);

          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.notifications)
            .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));

          return Response.json({ items, unread: Number(count) });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Okundu işaretle: {id} veya {all:true}
      PATCH: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const b = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };
          const now = new Date();

          if (b.all) {
            await db
              .update(schema.notifications)
              .set({ readAt: now })
              .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
            return Response.json({ ok: true });
          }

          if (!b.id) return Response.json({ ok: false }, { status: 400 });
          // Sahiplik şartı: başkasının bildirimini işaretleyemezsin.
          await db
            .update(schema.notifications)
            .set({ readAt: now })
            .where(and(eq(schema.notifications.id, b.id), eq(schema.notifications.userId, user.id)));
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
