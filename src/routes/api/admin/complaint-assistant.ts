import { createFileRoute } from "@tanstack/react-router";
import { audit } from "@/lib/server/audit";
import {
  DEFAULT_COMPLAINT_ASSISTANT_CONFIG,
  loadComplaintAssistantConfig,
  saveComplaintAssistantConfig,
} from "@/lib/server/complaint-assistant-config";
import { aiProviderLabel, isAiConfigured } from "@/lib/server/ai/client";
import { errorResponse, requireStaff } from "@/lib/server/guard";

export const Route = createFileRoute("/api/admin/complaint-assistant")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const config = await loadComplaintAssistantConfig();
          return Response.json({
            config,
            defaults: DEFAULT_COMPLAINT_ASSISTANT_CONFIG,
            ai: {
              configured: isAiConfigured(),
              provider: aiProviderLabel(),
            },
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const body = (await request.json()) as Record<string, unknown>;

          const config = await saveComplaintAssistantConfig({
            greeting: typeof body.greeting === "string" ? body.greeting : undefined,
            systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
            finalizePrompt: typeof body.finalizePrompt === "string" ? body.finalizePrompt : undefined,
            customInstructions:
              typeof body.customInstructions === "string" ? body.customInstructions : undefined,
            temperature: typeof body.temperature === "number" ? body.temperature : undefined,
            maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          });

          await audit(request, user.id, {
            action: "complaint_assistant.config_save",
            entityType: "app_meta",
            entityId: "complaint_assistant_config_v1",
          });

          return Response.json({ ok: true, config });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
