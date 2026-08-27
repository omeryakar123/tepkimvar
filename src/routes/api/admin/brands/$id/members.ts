import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, getRoles, requireStaff } from "@/lib/server/guard";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  fullName: string | null;
  email: string | null;
};

async function syncBrandRole(userId: string, grant: boolean): Promise<void> {
  if (grant) {
    await db.insert(schema.userRoles).values({ userId, role: "brand" }).onConflictDoNothing();
    return;
  }
  const [other] = await db
    .select({ id: schema.brandMembers.id })
    .from(schema.brandMembers)
    .where(eq(schema.brandMembers.userId, userId))
    .limit(1);
  if (!other) {
    await db
      .delete(schema.userRoles)
      .where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.role, "brand")));
  }
}

export const Route = createFileRoute("/api/admin/brands/$id/members")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          await requireStaff(request);
          const brandId = params.id;
          const rows = await db
            .select({
              id: schema.brandMembers.id,
              userId: schema.brandMembers.userId,
              role: schema.brandMembers.role,
              createdAt: schema.brandMembers.createdAt,
              fullName: schema.profiles.fullName,
              email: schema.user.email,
            })
            .from(schema.brandMembers)
            .innerJoin(schema.user, eq(schema.user.id, schema.brandMembers.userId))
            .leftJoin(schema.profiles, eq(schema.profiles.id, schema.brandMembers.userId))
            .where(eq(schema.brandMembers.brandId, brandId))
            .orderBy(desc(schema.brandMembers.createdAt));

          return Response.json({
            items: rows.map((r: MemberRow) => ({
              id: r.id,
              user_id: r.userId,
              role: r.role,
              full_name: r.fullName,
              email: r.email,
              created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
            })),
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request, params }) => {
        try {
          const staff = await requireStaff(request);
          const roles = await getRoles(staff.id);
          if (!roles.includes("super_admin") && !roles.includes("admin")) {
            throw new HttpError(403, "Yetkiniz yok");
          }

          const brandId = params.id;
          const b = (await request.json()) as { email?: string; role?: string };
          const email = b.email?.trim().toLowerCase();
          if (!email) throw new HttpError(400, "E-posta gerekli");

          const [found] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.email, email))
            .limit(1);
          if (!found) throw new HttpError(404, "Kullanıcı bulunamadı");

          const [brand] = await db
            .select({ id: schema.brands.id, name: schema.brands.name })
            .from(schema.brands)
            .where(eq(schema.brands.id, brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          const memberRole = (b.role?.trim() || "agent").slice(0, 40);

          await db
            .insert(schema.brandMembers)
            .values({ brandId, userId: found.id, role: memberRole })
            .onConflictDoNothing();

          await syncBrandRole(found.id, true);

          await audit(request, staff.id, {
            action: "brand.member.add",
            entityType: "brand",
            entityId: brandId,
            metadata: { userId: found.id, email, role: memberRole },
          });

          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const staff = await requireStaff(request);
          const roles = await getRoles(staff.id);
          if (!roles.includes("super_admin") && !roles.includes("admin")) {
            throw new HttpError(403, "Yetkiniz yok");
          }

          const brandId = params.id;
          const b = (await request.json()) as { userId?: string };
          if (!b.userId) throw new HttpError(400, "Kullanıcı belirtilmeli");

          await db
            .delete(schema.brandMembers)
            .where(and(eq(schema.brandMembers.brandId, brandId), eq(schema.brandMembers.userId, b.userId)));

          await syncBrandRole(b.userId, false);

          await audit(request, staff.id, {
            action: "brand.member.remove",
            entityType: "brand",
            entityId: brandId,
            metadata: { userId: b.userId },
          });

          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
