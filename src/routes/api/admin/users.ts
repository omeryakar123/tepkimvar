import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, getRoles, requireStaff } from "@/lib/server/guard";

// schema.appRole enum ile birebir.
const ROLES = ["super_admin", "admin", "brand", "user", "moderator"] as const;
type Role = (typeof ROLES)[number];

/** Rol yönetimi YALNIZCA super_admin'e ait — admin kendini yükseltemesin. */
async function requireSuperAdmin(request: Request) {
  const user = await requireStaff(request);
  const roles = await getRoles(user.id);
  if (!roles.includes("super_admin")) throw new HttpError(403, "Yetkiniz yok");
  return user;
}

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);

          // NOT: parola hash'i (account.password) ve oturum token'ları ASLA dönmez.
          const rows = await db
            .select({
              id: schema.profiles.id,
              full_name: schema.profiles.fullName,
              username: schema.profiles.username,
              is_banned: schema.profiles.isBanned,
              created_at: schema.profiles.createdAt,
              email: schema.user.email,
            })
            .from(schema.profiles)
            .leftJoin(schema.user, eq(schema.user.id, schema.profiles.id))
            .orderBy(desc(schema.profiles.createdAt));

          const roleRows = await db
            .select({ userId: schema.userRoles.userId, role: schema.userRoles.role })
            .from(schema.userRoles);

          const roles: Record<string, string[]> = {};
          for (const r of roleRows) (roles[r.userId] ||= []).push(r.role);

          return Response.json({ items: rows, roles });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Ban / ban kaldırma.
      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as { id?: string; is_banned?: boolean };
          if (!b.id) throw new HttpError(400, "Kullanıcı belirtilmeli");
          if (typeof b.is_banned !== "boolean") throw new HttpError(400, "Geçersiz değer");
          if (b.id === user.id) throw new HttpError(400, "Kendinizi banlayamazsınız");

          // Personeli yalnızca super_admin banlayabilir.
          const targetRoles = await getRoles(b.id);
          if (targetRoles.includes("admin") || targetRoles.includes("super_admin")) {
            const myRoles = await getRoles(user.id);
            if (!myRoles.includes("super_admin")) throw new HttpError(403, "Yetkiniz yok");
          }

          const [updated] = await db
            .update(schema.profiles)
            .set({ isBanned: b.is_banned, updatedAt: new Date() })
            .where(eq(schema.profiles.id, b.id))
            .returning({ id: schema.profiles.id });
          if (!updated) throw new HttpError(404, "Kullanıcı bulunamadı");

          await audit(request, user.id, {
            action: b.is_banned ? "user.ban" : "user.unban",
            entityType: "user",
            entityId: b.id,
            severity: "warn",
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Rol ekle — super_admin.
      POST: async ({ request }) => {
        try {
          const user = await requireSuperAdmin(request);
          const b = (await request.json()) as { userId?: string; role?: string };
          if (!b.userId) throw new HttpError(400, "Kullanıcı belirtilmeli");
          if (!ROLES.includes(b.role as Role)) throw new HttpError(400, "Geçersiz rol");

          const [target] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.id, b.userId))
            .limit(1);
          if (!target) throw new HttpError(404, "Kullanıcı bulunamadı");

          await db
            .insert(schema.userRoles)
            .values({ userId: b.userId, role: b.role as Role })
            .onConflictDoNothing();

          await audit(request, user.id, {
            action: "role.grant",
            entityType: "user",
            entityId: b.userId,
            metadata: { role: b.role },
            severity: "critical",
          });
          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Rol kaldır — super_admin.
      DELETE: async ({ request }) => {
        try {
          const user = await requireSuperAdmin(request);
          const b = (await request.json().catch(() => ({}))) as {
            userId?: string;
            role?: string;
          };
          if (!b.userId) throw new HttpError(400, "Kullanıcı belirtilmeli");
          if (!ROLES.includes(b.role as Role)) throw new HttpError(400, "Geçersiz rol");
          // Kendi super_admin rolünü düşürüp paneli kilitlemeyi engelle.
          if (b.userId === user.id && b.role === "super_admin")
            throw new HttpError(400, "Kendi süper admin rolünüzü kaldıramazsınız");

          await db
            .delete(schema.userRoles)
            .where(
              and(
                eq(schema.userRoles.userId, b.userId),
                eq(schema.userRoles.role, b.role as Role),
              ),
            );

          await audit(request, user.id, {
            action: "role.revoke",
            entityType: "user",
            entityId: b.userId,
            metadata: { role: b.role },
            severity: "critical",
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
