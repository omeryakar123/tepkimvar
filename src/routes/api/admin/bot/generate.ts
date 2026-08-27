import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, rateLimit, requireStaff } from "@/lib/server/guard";
import { LANGUAGES, SCENARIO_KEYS, type LanguageCode, type ScenarioKey } from "@/lib/server/ai/prompts";
import { runBotForBrand } from "@/lib/server/complaint-bot";

/**
 * Panelden manuel şikayet üretimi ("Generate Complaint").
 *
 * Bot kapalı olsa da çalışır (ignoreEnabled) — admin tek seferlik örnek
 * üretmek isteyebilir. Günlük hedefi TÜKETMEZ, ancak aynı gün üretilen
 * sentetik sayısına dahil olduğu için cron o gün daha az üretir.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/bot/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          // AI maliyeti/rate limit koruması: personel başına saatte 60 üretim.
          rateLimit(`bot-generate:${user.id}`, 60, 60 * 60_000);

          const b = (await request.json()) as {
            brandId?: string;
            scenario?: string;
            rating?: number;
            language?: string;
            count?: number;
          };

          const brandId = b.brandId ?? "";
          if (!UUID_RE.test(brandId)) throw new HttpError(400, "Firma seçilmeli");

          const [brand] = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(eq(schema.brands.id, brandId))
            .limit(1);
          if (!brand) throw new HttpError(404, "Firma bulunamadı");

          const scenario =
            b.scenario && (SCENARIO_KEYS as readonly string[]).includes(b.scenario)
              ? (b.scenario as ScenarioKey)
              : undefined;
          const language =
            b.language && (LANGUAGES as readonly string[]).includes(b.language)
              ? (b.language as LanguageCode)
              : undefined;
          const rating =
            Number(b.rating) >= 1 && Number(b.rating) <= 5 ? Math.round(Number(b.rating)) : undefined;

          const result = await runBotForBrand({
            brandId,
            trigger: "manual",
            triggeredBy: user.id,
            count: b.count,
            scenario,
            rating,
            language,
            ignoreEnabled: true,
          });

          await audit(request, user.id, {
            action: "bot.manual_generate",
            entityType: "brand",
            entityId: brandId,
            metadata: {
              scenario: scenario ?? null,
              rating: rating ?? null,
              generated: result.complaintsGenerated,
              status: result.status,
            },
          });

          // Üretim tamamen başarısızsa 502: panelde hata olarak görünsün.
          const status = result.status === "failed" ? 502 : 200;
          return Response.json(
            {
              status: result.status,
              run_id: result.runId,
              complaints: result.complaintsGenerated,
              responses: result.responsesGenerated,
              duplicates: result.duplicatesDetected,
              errors: result.errors,
              reason: result.reason ?? null,
              error: result.status === "failed" ? (result.errors[0] ?? "Üretim başarısız") : undefined,
            },
            { status },
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
