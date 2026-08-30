import { createFileRoute } from "@tanstack/react-router";
import { eq, gte, sql } from "drizzle-orm";
import postgres from "postgres"; 
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";
import { sqlTs } from "@/lib/server/complaint-bot";

/** Yönetim paneli özet sayaçları + grafik verileri. */
export const Route = createFileRoute("/api/admin/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          await ensureDbPatches();

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
          const c = sql<number>`count(*)`;

          const [
            brands,
            users,
            complaints,
            todayCount,
            pending,
            spam,
            resolved,
            premium,
            verified,
          ] = await Promise.all([
            db.select({ n: c }).from(schema.brands).then(n),
            db.select({ n: c }).from(schema.profiles).then(n),
            db.select({ n: c }).from(schema.complaints).then(n),
            db
              .select({ n: c })
              .from(schema.complaints)
              .where(gte(schema.complaints.createdAt, sqlTs(today)))
              .then(n),
            db
              .select({ n: c })
              .from(schema.complaints)
              .where(eq(schema.complaints.status, "pending"))
              .then(n),
            db
              .select({ n: c })
              .from(schema.complaints)
              .where(eq(schema.complaints.status, "spam"))
              .then(n),
            db
              .select({ n: c })
              .from(schema.complaints)
              .where(eq(schema.complaints.status, "resolved"))
              .then(n),
            db.select({ n: c }).from(schema.brands).where(eq(schema.brands.premium, true)).then(n),
            db.select({ n: c }).from(schema.brands).where(eq(schema.brands.verified, true)).then(n),
          ]);

          const url = process.env.DATABASE_URL;
          let complaint_flow: { day: string; pending: number; approved: number; answered: number; resolved: number; total: number }[] = [];
          let page_views: {
            total: number;
            today: number;
            week: number;
            daily: { day: string; views: number }[];
          } = { total: 0, today: 0, week: 0, daily: [] };

          if (url) {
            const pg = postgres(url, { max: 1 });
            complaint_flow = await pg`
              SELECT
                to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE status = 'pending')::int AS pending,
                count(*) FILTER (WHERE status = 'approved')::int AS approved,
                count(*) FILTER (WHERE status = 'answered')::int AS answered,
                count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
                count(*)::int AS total
              FROM complaints
              WHERE created_at >= now() - interval '6 days'
              GROUP BY 1
              ORDER BY 1
            `;
            const [pv] = await pg`
              SELECT
                count(*)::int AS total,
                count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS today,
                count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
              FROM page_views
            `.catch(() => [{ total: 0, today: 0, week: 0 }]);
            const pvDaily = await pg`
              SELECT
                to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM-DD') AS day,
                count(*)::int AS views
              FROM page_views
              WHERE created_at >= now() - interval '6 days'
              GROUP BY 1 ORDER BY 1
            `.catch(() => []);
            await pg.end();
            page_views = { ...pv, daily: pvDaily };
          }

          return Response.json({
            brands,
            users,
            complaints,
            today: todayCount,
            pending,
            spam,
            resolved,
            premium,
            verified,
            complaint_flow,
            page_views,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
