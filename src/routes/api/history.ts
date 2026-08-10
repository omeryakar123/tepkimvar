import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Public: bir şikayetin durum geçmişi (zaman tüneli).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const complaintId = new URL(request.url).searchParams.get("complaintId");
        // Geçersiz id'de Postgres uuid cast hatası (500) yerine boş liste dön.
        if (!complaintId || !UUID_RE.test(complaintId)) return Response.json([]);

        const rows = await db
          .select({
            id: schema.complaintHistory.id,
            complaint_id: schema.complaintHistory.complaintId,
            from_status: schema.complaintHistory.fromStatus,
            to_status: schema.complaintHistory.toStatus,
            actor_role: schema.complaintHistory.actorRole,
            note: schema.complaintHistory.note,
            created_at: schema.complaintHistory.createdAt,
          })
          .from(schema.complaintHistory)
          .where(eq(schema.complaintHistory.complaintId, complaintId))
          .orderBy(asc(schema.complaintHistory.createdAt));

        // changed_by (kullanıcı kimliği) bilerek dışarı verilmiyor.
        return Response.json(rows);
      },
    },
  },
});
