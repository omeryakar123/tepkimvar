/**
 * İstemci tarafı denetim kaydı.
 *
 * ESKİDEN tarayıcıdan doğrudan audit_logs'a yazıyordu; bu yüzden kullanıcı
 * kendi kaydını sahteleyebiliyor veya engelleyebiliyordu (IP de client'tan
 * geliyordu). Artık sunucuya bildirim gönderiyoruz: aktör kimliği oturumdan,
 * IP/User-Agent ise istek başlıklarından alınıyor.
 */
export type AuditSeverity = "info" | "warn" | "critical";

export async function logAudit(input: {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}) {
  try {
    await fetch("/api/audit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}
