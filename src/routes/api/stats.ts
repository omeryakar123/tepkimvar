import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: platform istatistikleri (count sorguları).
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
          db.select({ count: sql<number>`count(*)` }).from(schema.complaints),
          db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(eq(schema.complaints.status, "resolved")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(schema.brands)
            .where(eq(schema.brands.isActive, true)),
          db.select({ count: sql<number>`count(*)` }).from(schema.profiles),
        ]);

        const totalComplaints = Number(cTotal);
        const resolvedComplaints = Number(cResolved);
        return Response.json({
          totalComplaints,
          resolvedComplaints,
          resolutionRate: totalComplaints ? (resolvedComplaints * 100) / totalComplaints : 0,
          totalCompanies: Number(bTotal),
          totalUsers: Number(uTotal),
        });
      },
    },
  },
});
