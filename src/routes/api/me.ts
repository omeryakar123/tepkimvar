import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

// Oturumdaki kullanıcının bilgisi + rolleri. RLS gittiği için roller artık
// sunucuda Drizzle ile okunuyor.
export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return Response.json({ user: null, roles: [] });
        }
        const rows = await db
          .select({ role: schema.userRoles.role })
          .from(schema.userRoles)
          .where(eq(schema.userRoles.userId, session.user.id));
        return Response.json({ user: session.user, roles: rows.map((r) => r.role) });
      },
    },
  },
});
