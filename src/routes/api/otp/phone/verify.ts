import { createFileRoute } from "@tanstack/react-router";
import { clientIp, errorResponse, requireUser } from "@/lib/server/guard";
import { verifyComplaintPhoneOtp } from "@/lib/server/phone-otp";

export const Route = createFileRoute("/api/otp/phone/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = (await request.json()) as { phone?: string; otp?: string };
          if (!body.phone?.trim() || !body.otp?.trim()) {
            return Response.json({ error: "Telefon ve kod gerekli." }, { status: 400 });
          }
          const result = await verifyComplaintPhoneOtp(
            user.id,
            body.phone,
            body.otp,
            clientIp(request),
          );
          return Response.json({
            ok: true,
            verificationId: result.verificationId,
            phone: result.phone,
            expiresAt: result.expiresAt,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
