import { createFileRoute } from "@tanstack/react-router";
import {
  runBotForBrand,
  runComplaintBotForAllBrands,
  type BotRunResult,
} from "@/lib/server/complaint-bot";
import { HttpError, errorResponse, isStaff, optionalUser } from "@/lib/server/guard";

/**
 * Complaint Bot'un GÜNLÜK tetiklenme ucu.
 *
 * Projede bir scheduler yok (Nitro fetch handler'ı; setInterval tabanlı
 * süreç-içi zamanlayıcı birden fazla replica'da AYNI GÜN İÇİN MÜKERRER üretim
 * yapardı). Bu yüzden tetikleme dışarıdan HTTP ile yapılır:
 *
 *   Coolify → Scheduled Task (ya da sistem crontab'ı):
 *     0 9 * * *  curl -fsS -X POST https://<domain>/api/cron/complaint-bot \
 *                  -H "Authorization: Bearer $CRON_SECRET"
 *
 * Idempotans uçta DEĞİL, serviste: o gün marka için hedef kadar sentetik
 * şikayet üretilmişse yeni üretim yapılmaz. Dolayısıyla cron'un gün içinde
 * birkaç kez çalışması (ya da elle tekrar tetiklenmesi) sorun değildir.
 *
 * Yetki: `Authorization: Bearer $CRON_SECRET` **veya** personel oturumu
 * (panelden "Şimdi çalıştır").
 */

/** Sabit süreli karşılaştırma — secret uzunluğu/prefix'i sızmasın. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorize(request: Request): Promise<string | null> {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  // Boş CRON_SECRET ile token yolu KAPALI kalır (aksi halde herkes tetikler).
  if (secret && token && safeEqual(token, secret)) return null;

  const user = await optionalUser(request);
  if (user && (await isStaff(user.id))) return user.id;

  throw new HttpError(401, "Yetkisiz");
}

function summarize(results: BotRunResult[]) {
  return {
    brands: results.length,
    complaintsGenerated: results.reduce((s, r) => s + r.complaintsGenerated, 0),
    responsesGenerated: results.reduce((s, r) => s + r.responsesGenerated, 0),
    duplicatesDetected: results.reduce((s, r) => s + r.duplicatesDetected, 0),
    errors: results.reduce((s, r) => s + r.errors.length, 0),
    results: results.map((r) => ({
      brand_id: r.brandId,
      brand_name: r.brandName,
      status: r.status,
      target: r.targetCount,
      complaints: r.complaintsGenerated,
      responses: r.responsesGenerated,
      duplicates: r.duplicatesDetected,
      retried: r.retriedResponses,
      reason: r.reason ?? null,
      errors: r.errors,
    })),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(request: Request): Promise<Response> {
  try {
    const triggeredBy = await authorize(request);

    // Tek marka için tetikleme (panel butonu / test): ?brandId=...
    const brandId = new URL(request.url).searchParams.get("brandId");
    if (brandId) {
      if (!UUID_RE.test(brandId)) throw new HttpError(400, "Geçersiz firma");
      const result = await runBotForBrand({ brandId, trigger: "cron", triggeredBy });
      return Response.json(summarize([result]));
    }

    const { results } = await runComplaintBotForAllBrands({ trigger: "cron", triggeredBy });
    return Response.json(summarize(results));
  } catch (e) {
    return errorResponse(e);
  }
}

export const Route = createFileRoute("/api/cron/complaint-bot")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      // Yalnızca GET destekleyen cron servisleri için (davranış aynı).
      GET: async ({ request }) => handle(request),
    },
  },
});
