import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";

/** Son bot çalıştırmaları (denetim/hata takibi). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/bot/runs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const p = new URL(request.url).searchParams;
          const brandId = p.get("brandId");
          if (brandId && !UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");
          const limit = Math.min(100, Math.max(1, Number(p.get("limit")) || 20));

          const base = db
            .select({
              id: schema.botRuns.id,
              brand_id: schema.botRuns.brandId,
              brand_name: schema.brands.name,
              trigger: schema.botRuns.trigger,
              status: schema.botRuns.status,
              started_at: schema.botRuns.startedAt,
              completed_at: schema.botRuns.completedAt,
              target_count: schema.botRuns.targetCount,
              complaints_generated: schema.botRuns.complaintsGenerated,
              responses_generated: schema.botRuns.responsesGenerated,
              duplicates_detected: schema.botRuns.duplicatesDetected,
              error_count: schema.botRuns.errorCount,
              errors: schema.botRuns.errors,
              provider: schema.botRuns.provider,
            })
            .from(schema.botRuns)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.botRuns.brandId))
            .$dynamic();

          const rows = await (brandId ? base.where(eq(schema.botRuns.brandId, brandId)) : base)
            .orderBy(desc(schema.botRuns.startedAt))
            .limit(limit);

          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
