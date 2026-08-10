/**
 * Sunucu tarafı audit log.
 *
 * Eski istemci tarafı `logAudit` (src/lib/audit.ts) user_id'yi tarayıcıdan
 * gönderiyordu; yani herkes başkası adına kayıt atabiliyordu. Artık aktör
 * DAİMA oturumdan alınır ve kayıt sunucuda yazılır.
 */
import { db, schema } from "@/db";

export type AuditSeverity = "info" | "warn" | "critical";

export async function audit(
  request: Request,
  userId: string | null,
  input: {
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    severity?: AuditSeverity;
  },
): Promise<void> {
  try {
    const h = request.headers;
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;

    await db.insert(schema.auditLogs).values({
      userId,
      action: input.action,
      severity: input.severity ?? "info",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ip,
      userAgent: h.get("user-agent"),
      metadata: input.metadata ?? {},
    });
  } catch {
    // best-effort: audit yazılamazsa asıl işlem bozulmaz
  }
}
