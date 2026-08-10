import { createFileRoute } from "@tanstack/react-router";
import { audit } from "@/lib/server/audit";
import { errorResponse, optionalUser, rateLimit } from "@/lib/server/guard";

/**
 * İstemci kaynaklı denetim kaydı. GÜVENLİK: aktör (user_id) oturumdan,
 * IP/User-Agent istek başlıklarından alınır — istemciden ASLA kabul edilmez.
 * Bu yüzden kullanıcı başkası adına kayıt atamaz.
 */
const ALLOWED_ACTIONS = new Set([
  "report.create",
  "complaint.escalate",
  "complaint.resolve",
  "brand.verify_request",
  "brand.logo_update",
  "brand.cover_update",
]);

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await optionalUser(request);
          rateLimit(`audit:${user?.id ?? "anon"}`, 60, 60_000);

          const b = (await request.json()) as {
            action?: string;
            entityType?: string;
            entityId?: string;
            metadata?: Record<string, unknown>;
            severity?: "info" | "warn" | "critical";
          };

          // Serbest metin kabul etmiyoruz; log kirletilemesin.
          if (!b.action || !ALLOWED_ACTIONS.has(b.action)) {
            return Response.json({ ok: false }, { status: 400 });
          }

          await audit(request, user?.id ?? null, {
            action: b.action,
            entityType: b.entityType ?? null,
            entityId: b.entityId ?? null,
            metadata: b.metadata,
            severity: b.severity ?? "info",
          });
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
