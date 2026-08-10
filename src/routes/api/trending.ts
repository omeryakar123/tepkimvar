import { createFileRoute } from "@tanstack/react-router";

// Public: trend şikayetler.
// TODO: v_trending_complaints_7d VIEW'ı Drizzle'a taşınmadı; taşınınca burada
// son 7 günün trend sorgusu implement edilecek. Şimdilik boş dönüyor.
export const Route = createFileRoute("/api/trending")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json([]);
      },
    },
  },
});
