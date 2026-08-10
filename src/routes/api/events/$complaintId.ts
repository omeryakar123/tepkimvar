import { createFileRoute } from "@tanstack/react-router";
import { subscribe } from "@/lib/server/events";

/**
 * Bir şikayetin canlı olay akışı (SSE).
 * İstemci: new EventSource(`/api/events/${complaintId}`)
 * Yayınlanan olaylar sadece "şu şikayette değişiklik oldu" bilgisidir;
 * istemci veriyi normal API'den yeniden çeker (böylece yetki kuralları
 * tek yerde kalır, akıştan veri sızmaz).
 */
export const Route = createFileRoute("/api/events/$complaintId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const complaintId = (params as { complaintId: string }).complaintId;

        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            const send = (data: string) => {
              try {
                controller.enqueue(enc.encode(data));
              } catch {
                /* akış kapanmış */
              }
            };

            send(`retry: 5000\n\n`);
            send(`: connected\n\n`);

            const unsubscribe = subscribe((e) => {
              if (e.complaintId !== complaintId) return;
              send(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
            });

            // Proxy'lerin bağlantıyı düşürmemesi için düzenli yorum satırı.
            const keepAlive = setInterval(() => send(`: ping\n\n`), 25_000);

            const close = () => {
              clearInterval(keepAlive);
              unsubscribe();
              try {
                controller.close();
              } catch {
                /* zaten kapalı */
              }
            };

            request.signal.addEventListener("abort", close);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // nginx/proxy buffering kapalı
          },
        });
      },
    },
  },
});
