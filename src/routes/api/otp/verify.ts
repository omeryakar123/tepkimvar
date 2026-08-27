import { createFileRoute } from "@tanstack/react-router";
import { clientIp, errorResponse } from "@/lib/server/guard";
import { verifySignupOtp } from "@/lib/server/otp";

export const Route = createFileRoute("/api/otp/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { email?: string; otp?: string };
          if (!body.email?.trim() || !body.otp?.trim()) {
            return Response.json({ error: "E-posta ve kod gerekli." }, { status: 400 });
          }
          await verifySignupOtp(body.email, body.otp, clientIp(request));
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
