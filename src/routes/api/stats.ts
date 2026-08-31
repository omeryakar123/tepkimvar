import { createFileRoute } from "@tanstack/react-router";
import { eq, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { publicPlatformStats } from "@/lib/public-stats";
import { COMPLAINT_COUNTED, COMPLAINT_RESOLVED } from "@/lib/server/brand-stats";

// Public: platform istatistikleri (count sorguları).
// Reddedilen/spam kayıtlar toplamdan düşülür — marka sayaçlarıyla aynı kural.
const IGNORED_STATUSES = ["rejected", "spam"] as const;
export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        const [
          [{ count: cTotal }],
          [{ count: cResolved }],
          [{ count: bTotal }],
          [{ count: uTotal }],
        ] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(notInArray(schema.complaints.status, IGNORED_STATUSES)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(sql`${COMPLAINT_COUNTED} AND ${COMPLAINT_RESOLVED}`),
          db
            .select({ count: sql<number>`count(*)` })
            .from(schema.brands)
            .where(eq(schema.brands.isActive, true)),
          db.select({ count: sql<number>`count(*)` }).from(schema.profiles),
        ]);

        const totalComplaints = Number(cTotal);
        const resolvedComplaints = Number(cResolved);
        return Response.json(
          publicPlatformStats({
            totalComplaints,
            resolvedComplaints,
            resolutionRate: totalComplaints ? (resolvedComplaints * 100) / totalComplaints : 0,
            totalCompanies: Number(bTotal),
            totalUsers: Number(uTotal),
          }),
        );
      },
    },
  },
});
