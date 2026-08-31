import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

// Kendi profilini oku / güncelle. RLS gittiği için sahiplik burada zorlanıyor:
// her işlem oturumdaki user.id ile sınırlı. is_banned / email_verified /
// phone_verified ALANLARI bilerek dışarı açılmıyor (self-unban/self-verify engeli).
export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const [row] = await db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.id, session.user.id))
          .limit(1);
        return Response.json({
          profile: row ?? null,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        });
      },

      PATCH: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json()) as {
          fullName?: string | null;
          username?: string | null;
          phone?: string | null;
          city?: string | null;
          bio?: string | null;
          avatarUrl?: string | null;
        };

        const avatarUrl =
          body.avatarUrl === undefined
            ? undefined
            : body.avatarUrl && /^(\/api\/files\/avatars\/|https?:\/\/)/i.test(body.avatarUrl)
              ? body.avatarUrl
              : null;

        const patch = {
          fullName: body.fullName ?? null,
          username: body.username ?? null,
          phone: body.phone ?? null,
          city: body.city ?? null,
          bio: body.bio ?? null,
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          updatedAt: new Date(),
        };

        const [updated] = await db
          .insert(schema.profiles)
          .values({ id: session.user.id, ...patch })
          .onConflictDoUpdate({
            target: schema.profiles.id,
            set: patch,
          })
          .returning();

        return Response.json({ profile: updated });
      },
    },
  },
});
