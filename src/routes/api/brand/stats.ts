import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  HttpError,
  errorResponse,
  requireBrandAccess,
  requireUser,
} from "@/lib/server/guard";
import { COMPLAINT_COUNTED, COMPLAINT_RESOLVED } from "@/lib/server/brand-stats";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marka paneli dashboard sayaçları.
 * GÜVENLİK: brandId istemciden gelir ama requireBrandAccess olmadan ASLA
 * sorguya girmez (üye değilse 403). Sadece okuma; yazma yok.
 */
export const Route = createFileRoute("/api/brand/stats")({
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

          const [row] = await db
            .select({
              total: sql<number>`count(*) FILTER (WHERE ${COMPLAINT_COUNTED})`,
              today: sql<number>`count(*) filter (where ${schema.complaints.createdAt} >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')`,
              pending: sql<number>`count(*) filter (where ${schema.complaints.status} = 'pending')`,
              review: sql<number>`count(*) filter (where ${schema.complaints.status} = 'in_review')`,
              answered: sql<number>`count(*) filter (where ${schema.complaints.status} = 'answered')`,
              resolved: sql<number>`count(*) filter (where ${schema.complaints.status} = 'resolved')`,
              resolvedTotal: sql<number>`count(*) FILTER (WHERE ${COMPLAINT_RESOLVED})`,
            })
            .from(schema.complaints)
            .where(eq(schema.complaints.brandId, brandId));

          const total = Number(row?.total ?? 0);
          const answered = Number(row?.answered ?? 0);
          const resolvedOnly = Number(row?.resolved ?? 0);
          const resolved = Number(row?.resolvedTotal ?? 0) || resolvedOnly + answered;

          // Son 7 günün günlük şikayet sayısı (gerçek veri — sahte grafik yerine).
          const weeklyRows = await db
            .select({
              d: sql<string>`to_char(date_trunc('day', ${schema.complaints.createdAt} at time zone 'Europe/Istanbul'), 'YYYY-MM-DD')`,
              n: sql<number>`count(*)`,
            })
            .from(schema.complaints)
            .where(
              sql`${schema.complaints.brandId} = ${brandId} and ${schema.complaints.createdAt} >= now() - interval '6 days'`,
            )
            .groupBy(sql`1`);
          const byDay = new Map(weeklyRows.map((r) => [r.d, Number(r.n)]));
          const weekly: { day: string; count: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const dt = new Date(Date.now() - i * 86400_000);
            const key = dt.toISOString().slice(0, 10);
            weekly.push({
              day: dt.toLocaleDateString("tr-TR", { weekday: "short" }),
              count: byDay.get(key) ?? 0,
            });
          }

          return Response.json({
            total,
            today: Number(row?.today ?? 0),
            pending: Number(row?.pending ?? 0),
            review: Number(row?.review ?? 0),
            answered,
            resolved: resolvedOnly,
            resolved_total: resolved,
            resolutionRate:
              total > 0 ? Math.round((resolved / total) * 100) : 0,
            weekly,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
