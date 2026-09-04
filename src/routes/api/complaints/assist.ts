import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, rateLimit, requireUser, clientIp } from "@/lib/server/guard";
import { assistComplaintDraft, type AssistMessage } from "@/lib/server/complaint-assistant";

export const Route = createFileRoute("/api/complaints/assist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`complaint-assist:${user.id}`, 30, 15 * 60_000);
          rateLimit(`complaint-assist:ip:${clientIp(request)}`, 60, 15 * 60_000);

          const body = (await request.json()) as {
            messages?: AssistMessage[];
            brands?: { id: string; name: string }[];
            currentTitle?: string;
            currentBody?: string;
            mode?: "chat" | "finalize";
          };

          const messages = Array.isArray(body.messages)
            ? body.messages
                .filter((m) => m?.role && m?.content?.trim())
                .slice(-12)
                .map((m) => ({
                  role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
                  content: String(m.content).trim().slice(0, 2000),
                }))
            : [];

          if (messages.length === 0) {
            return Response.json({ error: "Mesaj gerekli" }, { status: 400 });
          }

          const brands = Array.isArray(body.brands)
            ? body.brands
                .filter((b) => b?.id && b?.name)
                .map((b) => ({ id: String(b.id), name: String(b.name).trim() }))
                .slice(0, 300)
            : [];

          const mode = body.mode === "finalize" ? "finalize" : "chat";

          const result = await assistComplaintDraft({
            messages,
            brands,
            currentTitle: body.currentTitle,
            currentBody: body.currentBody,
            mode,
          });

          return Response.json(result);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
