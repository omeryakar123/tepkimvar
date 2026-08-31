import { createFileRoute } from "@tanstack/react-router";
import { eq, gte, sql } from "drizzle-orm";
import postgres from "postgres"; 
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";
import { sqlTs, sqlTodayStart } from "@/lib/server/complaint-bot";

type SourceStats = {
  total: number;
  today: number;
  pending: number;
  approved: number;
  resolved: number;
  spam: number;
};

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

          async function sourceStats(isSynthetic: boolean): Promise<SourceStats> {
            const base = eq(schema.complaints.isSynthetic, isSynthetic);
            const [row] = await db
              .select({
                total: c,
                today: sql<number>`count(*) FILTER (WHERE ${schema.complaints.createdAt} >= ${sqlTodayStart()})`,
                pending: sql<number>`count(*) FILTER (WHERE ${schema.complaints.status} = 'pending')`,
                approved: sql<number>`count(*) FILTER (WHERE ${schema.complaints.status} = 'approved')`,
                resolved: sql<number>`count(*) FILTER (WHERE ${schema.complaints.status} = 'resolved')`,
                spam: sql<number>`count(*) FILTER (WHERE ${schema.complaints.status} = 'spam')`,
              })
              .from(schema.complaints)
              .where(base);
            return {
              total: Number(row?.total ?? 0),
              today: Number(row?.today ?? 0),
              pending: Number(row?.pending ?? 0),
              approved: Number(row?.approved ?? 0),
              resolved: Number(row?.resolved ?? 0),
              spam: Number(row?.spam ?? 0),
            };
          }

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
            organic,
            bot,
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
            sourceStats(false),
            sourceStats(true),
          ]);

          const url = process.env.DATABASE_URL;
          let complaint_flow: { day: string; pending: number; approved: number; answered: number; resolved: number; total: number }[] = [];
          let complaint_flow_organic: typeof complaint_flow = [];
          let complaint_flow_bot: typeof complaint_flow = [];
          let page_views: {
            total: number;
            today: number;
            week: number;
            daily: { day: string; views: number }[];
          } = { total: 0, today: 0, week: 0, daily: [] };
          let user_signups: {
            total: number;
            today: number;
            week: number;
            daily: { day: string; signups: number }[];
          } = { total: 0, today: 0, week: 0, daily: [] };

          if (url) {
            const pg = postgres(url, { max: 1 });
            const flowQuery = (synthetic: boolean | null) => pg`
              SELECT
                to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE status = 'pending')::int AS pending,
                count(*) FILTER (WHERE status = 'approved')::int AS approved,
                count(*) FILTER (WHERE status = 'answered')::int AS answered,
                count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
                count(*)::int AS total
              FROM complaints
              WHERE created_at >= now() - interval '6 days'
                ${synthetic === null ? pg`` : synthetic ? pg`AND is_synthetic = true` : pg`AND is_synthetic = false`}
              GROUP BY 1
              ORDER BY 1
            `;
            [complaint_flow, complaint_flow_organic, complaint_flow_bot] = await Promise.all([
              flowQuery(null),
              flowQuery(false),
              flowQuery(true),
            ]);
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
            const [us] = await pg`
              SELECT
                count(*)::int AS total,
                count(*) FILTER (
                  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul')
                )::int AS today,
                count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
              FROM "user"
            `.catch(() => [{ total: 0, today: 0, week: 0 }]);
            const usDaily = await pg`
              SELECT
                to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM-DD') AS day,
                count(*)::int AS signups
              FROM "user"
              WHERE created_at >= now() - interval '6 days'
              GROUP BY 1 ORDER BY 1
            `.catch(() => []);
            await pg.end();
            page_views = { ...pv, daily: pvDaily };
            user_signups = { ...us, daily: usDaily };
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
            complaints_by_source: { organic, bot },
            complaint_flow,
            complaint_flow_organic,
            complaint_flow_bot,
            page_views,
            user_signups,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
