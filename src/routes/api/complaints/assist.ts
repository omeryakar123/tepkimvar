import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, rateLimit, requireUser, clientIp } from "@/lib/server/guard";
import {
  assistComplaintDraft,
  getComplaintAssistantGreeting,
  type AssistMessage,
} from "@/lib/server/complaint-assistant";
import { normalizeComplaintState } from "@/lib/complaint-intake-state";
import { aiProviderLabel, isAiConfigured } from "@/lib/server/ai/client";

export const Route = createFileRoute("/api/complaints/assist")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const greeting = await getComplaintAssistantGreeting();
          return Response.json({
            greeting,
            aiConfigured: isAiConfigured(),
            aiProvider: aiProviderLabel(),
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          rateLimit(`complaint-assist:${user.id}`, 30, 15 * 60_000);
          rateLimit(`complaint-assist:ip:${clientIp(request)}`, 60, 15 * 60_000);

          const body = (await request.json()) as {
            messages?: AssistMessage[];
            brands?: { id: string; name: string }[];
            complaintState?: Record<string, unknown>;
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
            complaintState: normalizeComplaintState(body.complaintState),
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
