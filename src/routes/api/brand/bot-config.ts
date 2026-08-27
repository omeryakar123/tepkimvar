import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import {
  HttpError,
  errorResponse,
  isStaff,
  requireBrandAccess,
  requireUser,
} from "@/lib/server/guard";
import {
  getBotConfig,
  saveBotConfig,
  todayStart,
  type BotConfigPatch,
} from "@/lib/server/complaint-bot";
import { COMPLAINT_TONES, LANGUAGES, RESPONSE_TONES, SCENARIOS } from "@/lib/server/ai/prompts";

/**
 * Marka temsilcisinin KENDİ markası için bot ayarları (çok kiracılı izolasyon).
 *
 * `brandId` istemciden gelir ama ASLA doğrudan kullanılmaz: requireBrandAccess
 * üyelik kontrolü yapar, dolayısıyla bir müşteri başka müşterinin ayarını ne
 * okuyabilir ne yazabilir.
 *
 * Botu AÇIP KAPATMA yetkisi bilinçli olarak yalnızca personelde: sentetik
 * içerik üretimi platform kararıdır, kiracı kendi başına açamaz.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/brand/bot-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const brandId = new URL(request.url).searchParams.get("brandId") ?? "";
          if (!UUID_RE.test(brandId)) throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          const config = await getBotConfig(brandId);
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.complaints)
            .where(
              and(
                eq(schema.complaints.brandId, brandId),
                eq(schema.complaints.isSynthetic, true),
                gte(schema.complaints.createdAt, todayStart()),
              ),
            );

          return Response.json({
            config: {
              brand_id: config.brandId,
              enabled: config.enabled,
              daily_target: config.dailyTarget,
              min_rating: config.minRating,
              max_rating: config.maxRating,
              language: config.language,
              complaint_tone: config.complaintTone,
              response_tone: config.responseTone,
              scenarios: config.scenarios,
              custom_instructions: config.customInstructions,
              last_run_at: config.lastRunAt,
            },
            today_count: Number(count),
            options: {
              scenarios: SCENARIOS.map((s) => ({ key: s.key, label: s.tr.label })),
              complaint_tones: COMPLAINT_TONES,
              response_tones: RESPONSE_TONES,
              languages: LANGUAGES,
            },
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = (await request.json()) as { brandId?: string } & BotConfigPatch;
          const brandId = body.brandId ?? "";
          if (!UUID_RE.test(brandId)) throw new HttpError(400, "Firma belirtilmeli");
          await requireBrandAccess(user.id, brandId);

          const staff = await isStaff(user.id);
          const patch: BotConfigPatch = {
            dailyTarget: body.dailyTarget,
            minRating: body.minRating,
            maxRating: body.maxRating,
            language: body.language,
            complaintTone: body.complaintTone,
            responseTone: body.responseTone,
            scenarios: body.scenarios,
            customInstructions: body.customInstructions,
            // enabled ve eşik değeri yalnızca personel tarafından değiştirilir.
            ...(staff
              ? { enabled: body.enabled, similarityThreshold: body.similarityThreshold }
              : {}),
          };

          const saved = await saveBotConfig(brandId, patch);

          await audit(request, user.id, {
            action: "bot.config_save",
            entityType: "brand",
            entityId: brandId,
            metadata: { by: staff ? "staff" : "brand" },
          });

          return Response.json({ ok: true, enabled: saved.enabled });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
