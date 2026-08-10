import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toDbBrand } from "@/lib/db-shapes";

// Public: slug ile tek firma.
export const Route = createFileRoute("/api/brands/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [row] = await db
          .select()
          .from(schema.brands)
          .where(eq(schema.brands.slug, params.slug))
          .limit(1);
        if (!row) return new Response("Not Found", { status: 404 });
        return Response.json(toDbBrand(row));
      },
    },
  },
});
