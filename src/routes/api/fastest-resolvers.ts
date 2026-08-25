import { createFileRoute } from "@tanstack/react-router";
import { and, asc, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbBrand } from "@/lib/db-shapes";

// Public: en hızlı çözen markalar (total_complaints>0, avg_response_minutes artan).
export const Route = createFileRoute("/api/fastest-resolvers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit")) || 5;

        // avg_response_minutes = 0 "ölçüm yok" demek; sıralamada en hızlı gibi
        // görünmemesi için ölçümü olmayan markalar dışarıda bırakılır.
        const rows = await db
          .select()
          .from(schema.brands)
          .where(
            and(
              gt(schema.brands.totalComplaints, 0),
              gt(schema.brands.avgResponseMinutes, 0),
            ),
          )
          .orderBy(asc(schema.brands.avgResponseMinutes))
          .limit(limit);

        return Response.json(rows.map(toDbBrand));
      },
    },
  },
});
