import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";
import { recordStatusChange } from "@/lib/server/history";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";

const KINDS = [
  "escalation",
  "report",
  "sensitive",
  "verification",
  "adult",
  "duplicate",
  "other",
] as const;
type Kind = (typeof KINDS)[number];

const STATES = ["open", "reviewing", "resolved", "dismissed"] as const;
type State = (typeof STATES)[number];

/** Moderasyon kuyruğu. Personel dışına kapalı. */
export const Route = createFileRoute("/api/admin/moderation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          await ensureDbPatches();
          const p = new URL(request.url).searchParams;
          const kind = p.get("kind") ?? "all";
          const state = p.get("state") ?? "open";

          const conditions: SQL[] = [];
          if (kind !== "all") {
            if (!KINDS.includes(kind as Kind)) throw new HttpError(400, "Geçersiz tür");
            conditions.push(eq(schema.moderationQueue.kind, kind as Kind));
          }
          if (state === "open") {
            conditions.push(inArray(schema.moderationQueue.state, ["open", "reviewing"]));
          } else if (state !== "all") {
            if (!STATES.includes(state as State)) throw new HttpError(400, "Geçersiz durum");
            conditions.push(eq(schema.moderationQueue.state, state as State));
          }

          const rows = await db
            .select({
              id: schema.moderationQueue.id,
              kind: schema.moderationQueue.kind,
              state: schema.moderationQueue.state,
              priority: schema.moderationQueue.priority,
              target_type: schema.moderationQueue.targetType,
              target_id: schema.moderationQueue.targetId,
              related_table: schema.moderationQueue.relatedTable,
              related_id: schema.moderationQueue.relatedId,
              summary: schema.moderationQueue.summary,
              payload: schema.moderationQueue.payload,
              created_at: schema.moderationQueue.createdAt,
            })
            .from(schema.moderationQueue)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(schema.moderationQueue.priority), desc(schema.moderationQueue.createdAt));

          return Response.json({ items: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const b = (await request.json()) as {
            id?: string;
            state?: string;
            /** Şikayet onayı: resolved=onayla, dismissed=reddet */
            complaintAction?: "approve" | "reject";
          };
          if (!b.id) throw new HttpError(400, "Kayıt belirtilmeli");

          const [item] = await db
            .select()
            .from(schema.moderationQueue)
            .where(eq(schema.moderationQueue.id, b.id))
            .limit(1);
          if (!item) throw new HttpError(404, "Kayıt bulunamadı");

          let state = b.state as State | undefined;
          if (b.complaintAction && item.targetType === "complaint" && item.targetId) {
            state = b.complaintAction === "approve" ? "resolved" : "dismissed";
          }
          if (!state || !STATES.includes(state)) throw new HttpError(400, "Geçersiz durum");

          const done = state === "resolved" || state === "dismissed";

          if (item.targetType === "complaint" && item.targetId && done) {
            const [c] = await db
              .select({
                id: schema.complaints.id,
                brandId: schema.complaints.brandId,
                status: schema.complaints.status,
              })
              .from(schema.complaints)
              .where(eq(schema.complaints.id, item.targetId))
              .limit(1);

            if (c) {
              const nextStatus = state === "resolved" ? "approved" : "rejected";
              await db
                .update(schema.complaints)
                .set({
                  status: nextStatus,
                  isPublic: state === "resolved",
                  updatedAt: new Date(),
                })
                .where(eq(schema.complaints.id, c.id));

              await recordStatusChange({
                complaintId: c.id,
                fromStatus: c.status,
                toStatus: nextStatus,
                changedBy: user.id,
                actorRole: "staff",
                note:
                  state === "resolved"
                    ? "Moderasyon onayı — yayına alındı"
                    : "Moderasyon reddi",
              });
              await refreshBrandAggregates(c.brandId);
            }
          }

          const [updated] = await db
            .update(schema.moderationQueue)
            .set({
              state,
              resolvedBy: done ? user.id : null,
              resolvedAt: done ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(schema.moderationQueue.id, b.id))
            .returning({ id: schema.moderationQueue.id });
          if (!updated) throw new HttpError(404, "Kayıt bulunamadı");

          await audit(request, user.id, {
            action: `moderation.${state}`,
            entityType: "moderation_queue",
            entityId: updated.id,
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
