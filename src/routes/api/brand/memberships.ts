import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorResponse, requireUser } from "@/lib/server/guard";

/**
 * Oturumdaki kullanıcının temsilcisi olduğu firmalar.
 * GÜVENLİK: filtre yalnızca oturumdaki user.id ile kurulur; istemciden
 * hiçbir kimlik/parametre alınmaz. Panel tüm brandId'lerini buradan alır.
 */
export const Route = createFileRoute("/api/brand/memberships")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);

          const memberships = await db
            .select({
              brand_id: schema.brands.id,
              name: schema.brands.name,
              slug: schema.brands.slug,
            })
            .from(schema.brandMembers)
            .innerJoin(
              schema.brands,
              eq(schema.brandMembers.brandId, schema.brands.id),
            )
            .where(eq(schema.brandMembers.userId, user.id))
            .orderBy(asc(schema.brands.name));

          return Response.json({ memberships });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
