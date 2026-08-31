import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireStaff } from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";

/** Admin: bekleyen şikayet + moderasyon kuyruğu özeti. */
export const Route = createFileRoute("/api/admin/moderation-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          await ensureDbPatches();

          const [{ pending }] = await db
            .select({ pending: sql<number>`count(*)::int` })
            .from(schema.complaints)
            .where(eq(schema.complaints.status, "pending"));

          const [{ open }] = await db
            .select({ open: sql<number>`count(*)::int` })
            .from(schema.moderationQueue)
            .where(inArray(schema.moderationQueue.state, ["open", "reviewing"]));

          return Response.json({
            pending: Number(pending ?? 0),
            open: Number(open ?? 0),
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
