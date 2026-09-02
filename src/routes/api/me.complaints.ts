import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

// Oturumdaki kullanıcının kendi şikayetleri.
export const Route = createFileRoute("/api/me/complaints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const rows = await db
          .select({
            id: schema.complaints.id,
            publicId: schema.complaints.publicId,
            title: schema.complaints.title,
            status: schema.complaints.status,
            views: schema.complaints.views,
            createdAt: schema.complaints.createdAt,
          })
          .from(schema.complaints)
          .where(eq(schema.complaints.userId, session.user.id))
          .orderBy(desc(schema.complaints.createdAt));
        return Response.json({ complaints: rows });
      },
    },
  },
});
