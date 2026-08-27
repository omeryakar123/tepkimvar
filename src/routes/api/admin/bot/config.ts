import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, requireStaff } from "@/lib/server/guard";
import { isSyntheticPublic } from "@/lib/server/synthetic";
import { aiProviderLabel, isAiConfigured } from "@/lib/server/ai/client";
import {
  COMPLAINT_TONES,
  LANGUAGES,
  RESPONSE_TONES,
  SCENARIOS,
} from "@/lib/server/ai/prompts";
import {
  getBotConfig,
  saveBotConfig,
  todayStart,
  type BotConfigPatch,
} from "@/lib/server/complaint-bot";

/**
 * Marka bazlı Complaint Bot ayarları.
 *
 * GÜVENLİK: tüm uçlar requireStaff. Marka temsilcileri kendi markalarının
 * ayarına /api/brand/bot-config üzerinden erişir (o uç requireBrandAccess ile
 * korunur), böylece bir müşteri başka müşterinin ayarını göremez.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serializeConfig(c: Awaited<ReturnType<typeof getBotConfig>>) {
  return {
    brand_id: c.brandId,
    enabled: c.enabled,
    daily_target: c.dailyTarget,
    min_rating: c.minRating,
    max_rating: c.maxRating,
    rating_weights: c.ratingWeights,
    language: c.language,
    complaint_tone: c.complaintTone,
    response_tone: c.responseTone,
    scenarios: c.scenarios,
    custom_instructions: c.customInstructions,
    similarity_threshold: c.similarityThreshold,
    last_run_at: c.lastRunAt,
  };
}

export const Route = createFileRoute("/api/admin/bot/config")({
  server: {
    handlers: {
      /**
       * GET            -> yapılandırılmış botların listesi + seçenek sözlükleri
       * GET ?brandId=  -> tek markanın ayarı (kayıt yoksa varsayılanlar)
       */
      GET: async ({ request }) => {
        try {
          await requireStaff(request);
          const brandId = new URL(request.url).searchParams.get("brandId");

          if (brandId) {
            if (!UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");
            const [brand] = await db
              .select({ id: schema.brands.id, name: schema.brands.name })
              .from(schema.brands)
              .where(eq(schema.brands.id, brandId))
              .limit(1);
            if (!brand) throw new HttpError(404, "Firma bulunamadı");

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
              brand: { id: brand.id, name: brand.name },
              config: serializeConfig(config),
              today_count: Number(count),
            });
          }

          // Bot ayarı olan markalar + bugünkü üretim sayısı.
          const rows = await db
            .select({
              brand_id: schema.brandBotConfigs.brandId,
              brand_name: schema.brands.name,
              brand_slug: schema.brands.slug,
              brand_active: schema.brands.isActive,
              enabled: schema.brandBotConfigs.enabled,
              daily_target: schema.brandBotConfigs.dailyTarget,
              language: schema.brandBotConfigs.language,
              response_tone: schema.brandBotConfigs.responseTone,
              last_run_at: schema.brandBotConfigs.lastRunAt,
              today_count: sql<number>`(
                SELECT count(*) FROM complaints c
                 WHERE c.brand_id = ${schema.brandBotConfigs.brandId}
                   AND c.is_synthetic = true
                   AND c.created_at >= ${todayStart()}
              )`,
            })
            .from(schema.brandBotConfigs)
            .innerJoin(schema.brands, eq(schema.brands.id, schema.brandBotConfigs.brandId))
            .orderBy(asc(schema.brands.name));

          return Response.json({
            items: rows.map((r) => ({ ...r, today_count: Number(r.today_count) })),
            options: {
              scenarios: SCENARIOS.map((s) => ({ key: s.key, label: s.tr.label })),
              complaint_tones: COMPLAINT_TONES,
              response_tones: RESPONSE_TONES,
              languages: LANGUAGES,
            },
            ai: {
              configured: isAiConfigured(),
              provider: aiProviderLabel(),
              synthetic_public: isSyntheticPublic(),
            },
          });
        } catch (e) {
          return errorResponse(e);
        }
      },

      /** Ayar kaydet. Tüm alanlar serviste whitelist/clamp'ten geçer. */
      PUT: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          const body = (await request.json()) as { brandId?: string } & BotConfigPatch;
          const brandId = body.brandId ?? "";
          if (!UUID_RE.test(brandId)) throw new HttpError(400, "Firma belirtilmeli");

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          const saved = await saveBotConfig(brandId, body);

          await audit(request, user.id, {
            action: "bot.config_save",
            entityType: "brand",
            entityId: brandId,
            metadata: { enabled: saved.enabled, dailyTarget: saved.dailyTarget },
          });

          return Response.json({ config: serializeConfig(saved) });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
