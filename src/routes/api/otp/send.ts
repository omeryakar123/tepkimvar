import { createFileRoute } from "@tanstack/react-router";
import { clientIp, errorResponse } from "@/lib/server/guard";
import { sendSignupOtp } from "@/lib/server/otp";

export const Route = createFileRoute("/api/otp/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { email?: string };
          if (!body.email?.trim()) {
            return Response.json({ error: "E-posta adresi gerekli." }, { status: 400 });
          }
          await sendSignupOtp(body.email, clientIp(request));
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
