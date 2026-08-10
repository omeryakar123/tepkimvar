/**
 * Canlı güncelleme altyapısı — Postgres LISTEN/NOTIFY.
 *
 * Neden WebSocket değil:
 *  - Akış tek yönlü (sunucu -> istemci). Yorum/oy zaten normal POST ile gidiyor.
 *  - SSE düz HTTP'dir; Coolify/Traefik arkasında ekstra "upgrade" ayarı istemez.
 *  - Tarayıcıda otomatik yeniden bağlanma yerleşik gelir.
 *
 * Neden in-memory bir emitter değil:
 *  - LISTEN/NOTIFY sayesinde birden fazla replica çalıştırsan da tüm sunucular
 *    aynı olayı alır. Tek süreçlik emitter çoklu replica'da sessizce bozulurdu.
 */
import { sql } from "@/db";

export type ComplaintEvent = {
  type: "comment" | "vote" | "complaint";
  complaintId: string;
};

const CHANNEL = "complaint_events";

type Listener = (e: ComplaintEvent) => void;
const listeners = new Set<Listener>();
let listening: Promise<unknown> | null = null;

/** İlk abone geldiğinde tek bir LISTEN bağlantısı aç. */
function ensureListening() {
  if (listening) return;
  listening = sql
    .listen(CHANNEL, (payload: string) => {
      let e: ComplaintEvent;
      try {
        e = JSON.parse(payload) as ComplaintEvent;
      } catch {
        return;
      }
      for (const l of listeners) {
        try {
          l(e);
        } catch {
          /* tek bir abonenin hatası diğerlerini etkilemesin */
        }
      }
    })
    .catch((err: unknown) => {
      console.error("[events] LISTEN başarısız:", err);
      listening = null; // sonraki abonede tekrar denensin
    });
}

export function subscribe(fn: Listener): () => void {
  ensureListening();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Yazma uçlarından çağrılır; tüm sunuculara yayınlar. */
export async function publish(e: ComplaintEvent): Promise<void> {
  try {
    await sql.notify(CHANNEL, JSON.stringify(e));
  } catch (err) {
    console.error("[events] NOTIFY başarısız:", err);
  }
}
