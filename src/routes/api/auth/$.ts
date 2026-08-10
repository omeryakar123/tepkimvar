import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

// BetterAuth'un tüm uçları (/api/auth/*) bu handler'a düşer.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
