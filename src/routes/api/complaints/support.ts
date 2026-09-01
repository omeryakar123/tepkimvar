import { createFileRoute } from "@tanstack/react-router";
import { and, eq, notInArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { refreshComplaintVoteCount } from "@/lib/server/complaint-support";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";
import { HttpError, errorResponse, rateLimit, requireUser } from "@/lib/server/guard";
import { publish } from "@/lib/server/events";

const HIDDEN_STATUSES = ["pending", "rejected", "spam"] as const;

/** Şikayet desteği — kullanıcı başına bir kez (tekrar basınca kaldırılır). */
export const Route = createFileRoute("/api/complaints/support")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          await ensureDbPatches();
          rateLimit(`complaint-support:${user.id}`, 80, 60_000);

          const b = (await request.json()) as { complaintId?: string };
          if (!b.complaintId) throw new HttpError(400, "Şikayet belirtilmeli");

          const [c] = await db
            .select({ id: schema.complaints.id, userId: schema.complaints.userId })
            .from(schema.complaints)
            .where(
              and(
                eq(schema.complaints.id, b.complaintId),
                notInArray(schema.complaints.status, [...HIDDEN_STATUSES]),
                or(
                  eq(schema.complaints.isPublic, true),
                  eq(schema.complaints.isSynthetic, true),
                ),
                eq(schema.complaints.hidden, false),
              ),
            )
            .limit(1);
          if (!c) throw new HttpError(404, "Şikayet bulunamadı");
          if (c.userId === user.id) throw new HttpError(400, "Kendi şikayetinizi destekleyemezsiniz");

          const [existing] = await db
            .select({ complaintId: schema.complaintSupports.complaintId })
            .from(schema.complaintSupports)
            .where(
              and(
                eq(schema.complaintSupports.complaintId, b.complaintId),
                eq(schema.complaintSupports.userId, user.id),
              ),
            )
            .limit(1);

          if (existing) {
            await db
              .delete(schema.complaintSupports)
              .where(
                and(
                  eq(schema.complaintSupports.complaintId, b.complaintId),
                  eq(schema.complaintSupports.userId, user.id),
                ),
              );
          } else {
            await db.insert(schema.complaintSupports).values({
              complaintId: b.complaintId,
              userId: user.id,
            });
          }

          const votes = await refreshComplaintVoteCount(b.complaintId);
          await publish({ type: "complaint-support", complaintId: b.complaintId });

          return Response.json({ votes, supported: !existing });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
