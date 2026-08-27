import { createFileRoute } from "@tanstack/react-router";
import { eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { sqlTs } from "@/lib/server/complaint-bot";

/** Yönetim paneli özet sayaçları. Personel dışına kapalı. */
export const Route = createFileRoute("/api/admin/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);

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
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
