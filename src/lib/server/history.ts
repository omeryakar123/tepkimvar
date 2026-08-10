/**
 * Şikayet durum geçmişi.
 *
 * Supabase'de bunu bir DB trigger'ı yazıyordu; yeni şema Drizzle'dan sıfır
 * kurulduğu için trigger taşınmadı. Bu yüzden geçmiş kaydı ARTIK uygulama
 * katmanında, durumu değiştiren her yerden bu fonksiyonla yazılıyor.
 */
import { db, schema } from "@/db";
import { publish } from "@/lib/server/events";

export async function recordStatusChange(opts: {
  complaintId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  actorRole: "user" | "brand" | "admin" | "system";
  note?: string | null;
}): Promise<void> {
  if (opts.fromStatus === opts.toStatus) return;
  try {
    await db.insert(schema.complaintHistory).values({
      complaintId: opts.complaintId,
      fromStatus: opts.fromStatus,
      toStatus: opts.toStatus,
      changedBy: opts.changedBy,
      actorRole: opts.actorRole,
      note: opts.note ?? null,
    });
  } catch (e) {
    // Geçmiş kaydı asıl işlemi bozmasın.
    console.error("[history] yazılamadı:", e);
  }
  // Zaman tüneli ve detay sayfası canlı tazelensin.
  await publish({ type: "complaint", complaintId: opts.complaintId });
}
