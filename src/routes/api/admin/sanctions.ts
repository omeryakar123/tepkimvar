import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, getRoles, requireStaff } from "@/lib/server/guard";
import { applySanction, type SanctionType } from "@/lib/server/sanctions";

const TYPES = ["warning", "ban_temp", "ban_permanent", "unban"] as const;

// Kullanıcı yaptırımları (uyarı / süreli-kalıcı ban / askı kaldırma).
export const Route = createFileRoute("/api/admin/sanctions")({
  server: {
    handlers: {
      // Bir kullanıcının yaptırım geçmişi.
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const userId = new URL(request.url).searchParams.get("userId");
          if (!userId) throw new HttpError(400, "Kullanıcı belirtilmeli");

          const rows = await db
            .select({
              id: schema.userSanctions.id,
              type: schema.userSanctions.type,
              reason: schema.userSanctions.reason,
              active: schema.userSanctions.active,
              expires_at: schema.userSanctions.expiresAt,
              created_at: schema.userSanctions.createdAt,
            })
            .from(schema.userSanctions)
            .where(eq(schema.userSanctions.userId, userId))
            .orderBy(desc(schema.userSanctions.createdAt))
            .limit(50);

          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },

      // Yaptırım uygula.
      POST: async ({ request }) => {
        try {
          const staff = await requireStaff(request);
          const b = (await request.json()) as {
            userId?: string;
            type?: string;
            reason?: string;
            days?: number;
          };
          if (!b.userId) throw new HttpError(400, "Kullanıcı belirtilmeli");
          if (b.userId === staff.id) throw new HttpError(400, "Kendinize yaptırım uygulayamazsınız");
          if (!TYPES.includes(b.type as SanctionType)) throw new HttpError(400, "Geçersiz tür");
          const type = b.type as SanctionType;
          const reason = (b.reason ?? "").trim();
          if (type !== "unban" && reason.length < 3) throw new HttpError(400, "Sebep girmelisiniz");

          // Personele yaptırımı yalnızca super_admin uygulayabilir.
          const targetRoles = await getRoles(b.userId);
          if (targetRoles.includes("admin") || targetRoles.includes("super_admin")) {
            const myRoles = await getRoles(staff.id);
            if (!myRoles.includes("super_admin")) throw new HttpError(403, "Yetkiniz yok");
          }

          let expiresAt: Date | null = null;
          if (type === "ban_temp") {
            const days = Math.max(1, Math.min(365, Math.round(Number(b.days) || 7)));
            expiresAt = new Date(Date.now() + days * 86400_000);
          }

          await applySanction({
            userId: b.userId,
            type,
            reason: reason || "—",
            issuedBy: staff.id,
            expiresAt,
          });

          await audit(request, staff.id, {
            action: `sanction.${type}`,
            entityType: "user",
            entityId: b.userId,
            metadata: { reason, expiresAt },
            severity: type === "warning" ? "info" : "warn",
          });

          return Response.json({ ok: true }, { status: 201 });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
