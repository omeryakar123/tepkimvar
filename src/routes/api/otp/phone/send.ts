import { createFileRoute } from "@tanstack/react-router";
import { clientIp, errorResponse, requireUser } from "@/lib/server/guard";
import { sendComplaintPhoneOtp } from "@/lib/server/phone-otp";

export const Route = createFileRoute("/api/otp/phone/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = (await request.json()) as { phone?: string };
          if (!body.phone?.trim()) {
            return Response.json({ error: "Telefon numarası gerekli." }, { status: 400 });
          }
          const result = await sendComplaintPhoneOtp(user.id, body.phone, clientIp(request));
          return Response.json({ ok: true, phone: result.phone });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
