import { createFileRoute } from "@tanstack/react-router";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/server/audit";
import { HttpError, errorResponse, rateLimit, requireStaff } from "@/lib/server/guard";
import { LANGUAGES, SCENARIO_KEYS, type LanguageCode, type ScenarioKey } from "@/lib/server/ai/prompts";
import { runBotForBrand, runBotForBrands, summarizeBotResults } from "@/lib/server/complaint-bot";

/**
 * Panelden manuel şikayet üretimi.
 * Tek marka: brandId | Çoklu marka: brandIds[] (aynı anda, sınırlı paralellik).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BRANDS_PER_REQUEST = 25;

function parseBrandIds(b: { brandId?: string; brandIds?: string[] }): string[] {
  const fromArray = (b.brandIds ?? []).filter((id) => UUID_RE.test(id));
  if (fromArray.length) return [...new Set(fromArray)].slice(0, MAX_BRANDS_PER_REQUEST);
  if (b.brandId && UUID_RE.test(b.brandId)) return [b.brandId];
  return [];
}

export const Route = createFileRoute("/api/admin/bot/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireStaff(request);
          rateLimit(`bot-generate:${user.id}`, 60, 60 * 60_000);

          const b = (await request.json()) as {
            brandId?: string;
            brandIds?: string[];
            scenario?: string;
            rating?: number;
            language?: string;
            count?: number;
          };

          const brandIds = parseBrandIds(b);
          if (!brandIds.length) throw new HttpError(400, "En az bir firma seçilmeli");

          const found = await db
            .select({ id: schema.brands.id })
            .from(schema.brands)
            .where(inArray(schema.brands.id, brandIds));
          if (found.length !== brandIds.length) {
            throw new HttpError(404, "Seçilen firmalardan biri bulunamadı");
          }

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

          const runOpts = {
            trigger: "manual" as const,
            triggeredBy: user.id,
            count: b.count,
            scenario,
            rating,
            language,
            ignoreEnabled: true,
          };

          const results =
            brandIds.length === 1
              ? [await runBotForBrand({ ...runOpts, brandId: brandIds[0] })]
              : await runBotForBrands(brandIds, runOpts);

          const summary = summarizeBotResults(results);

          await audit(request, user.id, {
            action: "bot.manual_generate",
            entityType: "brand",
            entityId: brandIds[0],
            metadata: {
              brand_ids: brandIds,
              brand_count: brandIds.length,
              scenario: scenario ?? null,
              rating: rating ?? null,
              generated: summary.complaints,
              status: summary.status,
            },
          });

          const status = summary.status === "failed" ? 502 : 200;
          return Response.json(
            {
              status: summary.status,
              brands: brandIds.length,
              run_id: results.length === 1 ? results[0].runId : null,
              complaints: summary.complaints,
              responses: summary.responses,
              duplicates: summary.duplicates,
              errors: summary.errors,
              results: results.map((r) => ({
                brand_id: r.brandId,
                brand_name: r.brandName,
                status: r.status,
                complaints: r.complaintsGenerated,
                responses: r.responsesGenerated,
                duplicates: r.duplicatesDetected,
                reason: r.reason ?? null,
                errors: r.errors,
              })),
              reason:
                summary.complaints === 0
                  ? (results.find((r) => r.reason)?.reason ?? "Şikayet üretilemedi")
                  : null,
              error: summary.status === "failed" ? (summary.errors[0] ?? "Üretim başarısız") : undefined,
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
