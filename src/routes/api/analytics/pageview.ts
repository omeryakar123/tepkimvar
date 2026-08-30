import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";
import { errorResponse, requireStaff } from "@/lib/server/guard";

/** Sayfa görüntüleme kaydı + admin istatistikleri. */
export const Route = createFileRoute("/api/analytics/pageview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = process.env.DATABASE_URL;
          if (!url) return Response.json({ ok: false });

          const b = (await request.json()) as { path?: string; referrer?: string };
          const path = (b.path ?? "/").slice(0, 500);
          const referrer = b.referrer?.slice(0, 500) ?? null;
          const ua = (request.headers.get("user-agent") ?? "").slice(0, 300);

          const pg = postgres(url, { max: 1 });
          await pg`INSERT INTO page_views (path, referrer, user_agent) VALUES (${path}, ${referrer}, ${ua})`;
          await pg.end();
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false });
        }
      },

      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const url = process.env.DATABASE_URL;
          if (!url) throw new Error("DATABASE_URL yok");
          const pg = postgres(url, { max: 1 });

          const [totals] = await pg`
            SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS today,
              count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
            FROM page_views
          `.catch(() => [{ total: 0, today: 0, week: 0 }]);

          const daily = await pg`
            SELECT
              to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM-DD') AS day,
              count(*)::int AS views
            FROM page_views
            WHERE created_at >= now() - interval '6 days'
            GROUP BY 1 ORDER BY 1
          `.catch(() => []);

          const topPages = await pg`
            SELECT path, count(*)::int AS views
            FROM page_views
            WHERE created_at >= now() - interval '7 days'
            GROUP BY path ORDER BY views DESC LIMIT 10
          `.catch(() => []);

          await pg.end();
          return Response.json({ totals, daily, top_pages: topPages });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
