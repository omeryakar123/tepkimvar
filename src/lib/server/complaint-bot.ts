/**
 * AI Complaint & Review Bot — iş mantığı (SUNUCU TARAFI).
 *
 * Katman ayrımı:
 *   ai/client.ts   -> taşıma (HTTP, retry, timeout)
 *   ai/prompts.ts  -> prompt/senaryo metinleri + şablon yedeği
 *   BU DOSYA       -> üretim akışı, benzerlik kontrolü, DB yazımı, log
 *
 * Mevcut tablolar KORUNDU: şikayet `complaints`, yanıt `complaint_replies`
 * içine yazılır (yeni bir paralel şikayet tablosu açılmadı), böylece panel,
 * bildirim, sayaç ve moderasyon akışları olduğu gibi çalışır. Bot üretimi
 * satırlar `is_synthetic = true` + `generated_by` ile işaretlenir.
 */
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { refreshBrandAggregates } from "@/lib/server/brand-stats";
import { ensureDbPatches } from "@/lib/server/ensure-db-patches";
import { moderateAndScore } from "@/lib/server/moderation";
import { AiError, aiProviderLabel, chatCompleteJson, isAiConfigured } from "@/lib/server/ai/client";
import {
  COMPLAINT_TONES,
  LANGUAGES,
  RESPONSE_TONES,
  SCENARIO_KEYS,
  buildComplaintMessages,
  buildResponseMessages,
  fallbackComplaint,
  fallbackResponse,
  normalizeBotDisplayName,
  pickTurkishDisplayName,
  pickVariationAngle,
  scenarioLabel,
  type ComplaintTone,
  type LanguageCode,
  type ResponseTone,
  type ScenarioKey,
} from "@/lib/server/ai/prompts";

/* -------------------------------------------------------------------------- */
/*                                  Ayarlar                                   */
/* -------------------------------------------------------------------------- */

export type BotConfig = {
  brandId: string;
  enabled: boolean;
  generateResponses: boolean;
  dailyTarget: number;
  minRating: number;
  maxRating: number;
  ratingWeights: Record<string, number>;
  language: LanguageCode;
  complaintTone: ComplaintTone;
  responseTone: ResponseTone;
  scenarios: ScenarioKey[];
  customInstructions: string | null;
  similarityThreshold: number;
  lastRunAt: Date | null;
};

/** Kayıt yoksa bot KAPALI kabul edilir — mevcut markalar etkilenmez. */
export const DEFAULT_BOT_CONFIG: Omit<BotConfig, "brandId" | "lastRunAt"> = {
  enabled: false,
  generateResponses: false,
  dailyTarget: 3,
  minRating: 1,
  maxRating: 5,
  ratingWeights: {},
  language: "tr",
  complaintTone: "natural",
  responseTone: "professional",
  scenarios: [],
  customInstructions: null,
  similarityThreshold: 0.82,
};

/** Tek çalıştırmada üretilebilecek üst sınır — kaçak AI maliyetine karşı. */
export const MAX_PER_RUN = 25;
/** Yanıtı üretilemeyip `bot_error` ile kalan şikayetlerden kaç tanesi yeniden denenir. */
const MAX_RETRY_PER_RUN = 5;

export function getBotConfigDefaults(brandId: string): BotConfig {
  return { ...DEFAULT_BOT_CONFIG, brandId, lastRunAt: null };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

function rowToConfig(row: typeof schema.brandBotConfigs.$inferSelect): BotConfig {
  const scenarios = (row.scenarios ?? []).filter((s): s is ScenarioKey =>
    (SCENARIO_KEYS as readonly string[]).includes(s),
  );
  return {
    brandId: row.brandId,
    enabled: row.enabled,
    generateResponses: row.generateResponses ?? false,
    dailyTarget: clamp(row.dailyTarget, 0, MAX_PER_RUN),
    minRating: clamp(row.minRating, 1, 5),
    maxRating: clamp(row.maxRating, 1, 5),
    ratingWeights: asRecord(row.ratingWeights),
    language: (LANGUAGES as readonly string[]).includes(row.language)
      ? (row.language as LanguageCode)
      : "tr",
    complaintTone: (COMPLAINT_TONES as readonly string[]).includes(row.complaintTone)
      ? (row.complaintTone as ComplaintTone)
      : "natural",
    responseTone: (RESPONSE_TONES as readonly string[]).includes(row.responseTone)
      ? (row.responseTone as ResponseTone)
      : "professional",
    scenarios,
    customInstructions: row.customInstructions,
    similarityThreshold: clamp(Number(row.similarityThreshold) || 0.82, 0.5, 0.99),
    lastRunAt: row.lastRunAt,
  };
}

export async function getBotConfig(brandId: string): Promise<BotConfig> {
  await ensureDbPatches();
  const [row] = await db
    .select()
    .from(schema.brandBotConfigs)
    .where(eq(schema.brandBotConfigs.brandId, brandId))
    .limit(1);
  return row ? rowToConfig(row) : getBotConfigDefaults(brandId);
}

export type BotConfigPatch = Partial<{
  enabled: boolean;
  generateResponses: boolean;
  dailyTarget: number;
  minRating: number;
  maxRating: number;
  ratingWeights: Record<string, number>;
  language: string;
  complaintTone: string;
  responseTone: string;
  scenarios: string[];
  customInstructions: string | null;
  similarityThreshold: number;
}>;

/**
 * Ayarları doğrulayıp upsert eder. İstemciden gelen hiçbir alan doğrudan
 * yazılmaz; her biri whitelist/clamp'ten geçer.
 */
export async function saveBotConfig(brandId: string, patch: BotConfigPatch): Promise<BotConfig> {
  await ensureDbPatches();
  const current = await getBotConfig(brandId);

  const minRating = clamp(Math.round(patch.minRating ?? current.minRating), 1, 5);
  const maxRatingRaw = clamp(Math.round(patch.maxRating ?? current.maxRating), 1, 5);
  const next: BotConfig = {
    brandId,
    enabled: patch.enabled ?? current.enabled,
    generateResponses: patch.generateResponses ?? current.generateResponses,
    dailyTarget: clamp(Math.round(patch.dailyTarget ?? current.dailyTarget), 0, MAX_PER_RUN),
    minRating,
    // min > max girilirse sessizce düzelt (UI'da da engelli).
    maxRating: Math.max(minRating, maxRatingRaw),
    ratingWeights: patch.ratingWeights ? asRecord(patch.ratingWeights) : current.ratingWeights,
    language: (LANGUAGES as readonly string[]).includes(patch.language ?? "")
      ? (patch.language as LanguageCode)
      : current.language,
    complaintTone: (COMPLAINT_TONES as readonly string[]).includes(patch.complaintTone ?? "")
      ? (patch.complaintTone as ComplaintTone)
      : current.complaintTone,
    responseTone: (RESPONSE_TONES as readonly string[]).includes(patch.responseTone ?? "")
      ? (patch.responseTone as ResponseTone)
      : current.responseTone,
    scenarios: patch.scenarios
      ? patch.scenarios.filter((s): s is ScenarioKey =>
          (SCENARIO_KEYS as readonly string[]).includes(s),
        )
      : current.scenarios,
    customInstructions:
      patch.customInstructions === undefined
        ? current.customInstructions
        : patch.customInstructions === null
          ? null
          : patch.customInstructions.trim().slice(0, 1200) || null,
    similarityThreshold: clamp(
      Number(patch.similarityThreshold ?? current.similarityThreshold) || 0.82,
      0.5,
      0.99,
    ),
    lastRunAt: current.lastRunAt,
  };

  const values = {
    brandId,
    enabled: next.enabled,
    generateResponses: next.generateResponses,
    dailyTarget: next.dailyTarget,
    minRating: next.minRating,
    maxRating: next.maxRating,
    ratingWeights: next.ratingWeights,
    language: next.language,
    complaintTone: next.complaintTone,
    responseTone: next.responseTone,
    scenarios: next.scenarios,
    customInstructions: next.customInstructions,
    similarityThreshold: next.similarityThreshold.toFixed(2),
    updatedAt: new Date(),
  };

  await db
    .insert(schema.brandBotConfigs)
    .values(values)
    .onConflictDoUpdate({ target: schema.brandBotConfigs.brandId, set: values });

  return next;
}

/* -------------------------------------------------------------------------- */
/*                                  Puanlama                                  */
/* -------------------------------------------------------------------------- */

/**
 * Ağırlıklı yıldız üretimi. Varsayılan dağılım BİLEREK 5 yıldız ağırlıklı
 * değildir; şikayet platformunda gerçekçi olan düşük-orta yoğunluktur.
 */
const DEFAULT_WEIGHTS: Record<string, number> = { "1": 18, "2": 22, "3": 24, "4": 22, "5": 14 };

export function generateRating(config: Pick<BotConfig, "minRating" | "maxRating" | "ratingWeights">): number {
  const weights = Object.keys(config.ratingWeights).length ? config.ratingWeights : DEFAULT_WEIGHTS;

  const candidates: { value: number; weight: number }[] = [];
  for (let star = config.minRating; star <= config.maxRating; star++) {
    const w = Number(weights[String(star)] ?? 0);
    candidates.push({ value: star, weight: w > 0 ? w : 0 });
  }

  const total = candidates.reduce((s, c) => s + c.weight, 0);
  // Aralıktaki tüm ağırlıklar sıfırsa düzgün dağılıma düş.
  if (total <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)]?.value ?? config.minRating;
  }

  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.value;
  }
  return candidates[candidates.length - 1].value;
}

/* -------------------------------------------------------------------------- */
/*                            Benzerlik / kopya kontrolü                      */
/* -------------------------------------------------------------------------- */

const TR_MAP: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", î: "i", û: "u",
};

/** Karşılaştırma için metni sadeleştir: harf/rakam dışı her şey gider. */
export function normalizeForCompare(text: string): string {
  return text
    .replace(/[ıİşŞğĞüÜöÖçÇâîû]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    // Sayılar senaryo şablonlarında rastgele; benzerliği yapay düşürmesin.
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(text: string, k: number): Set<string> {
  const words = normalizeForCompare(text).split(" ").filter(Boolean);
  if (words.length <= k) return new Set(words.length ? [words.join(" ")] : []);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - k; i++) out.add(words.slice(i, i + k).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export type DuplicateVerdict = {
  duplicate: boolean;
  similarity: number;
  reason: "exact" | "body_similarity" | "title_similarity" | null;
  matchedId: string | null;
};

/**
 * Aynı markada birebir ya da ANLAMSAL olarak çok yakın şikayet var mı?
 *
 * Yaklaşım: kelime 3-gram (shingle) kümeleri üzerinde Jaccard benzerliği.
 * Gömme (embedding) tabanlı bir kontrol kasıtlı olarak seçilmedi: vektör
 * kolonu/uzantısı ve her satır için ek AI çağrısı gerektirirdi. Shingle
 * benzerliği aynı senaryonun yeniden yazımını yakalamak için yeterlidir ve
 * eşik marka bazında ayarlanabilir.
 */
export async function detectDuplicateComplaint(input: {
  brandId: string;
  title: string;
  body: string;
  threshold: number;
  /** Karşılaştırılacak son şikayet sayısı. */
  sampleSize?: number;
}): Promise<DuplicateVerdict> {
  const rows = await db
    .select({
      id: schema.complaints.id,
      title: schema.complaints.title,
      body: schema.complaints.body,
    })
    .from(schema.complaints)
    .where(eq(schema.complaints.brandId, input.brandId))
    .orderBy(desc(schema.complaints.createdAt))
    .limit(clamp(input.sampleSize ?? 200, 20, 500));

  const normTitle = normalizeForCompare(input.title);
  const normBody = normalizeForCompare(input.body);
  const bodyShingles = shingles(input.body, 3);
  const titleShingles = shingles(input.title, 2);

  // En yakın eşleşme yalnızca raporlama için tutulur; KOPYA bulunduğu anda
  // erken dönülür (daha benzer ama eşiğin altındaki bir satır, önceden
  // bulunmuş kopyayı gölgelemesin).
  let best: DuplicateVerdict = { duplicate: false, similarity: 0, reason: null, matchedId: null };

  for (const row of rows) {
    if (normalizeForCompare(row.body) === normBody || normalizeForCompare(row.title) === normTitle) {
      return { duplicate: true, similarity: 1, reason: "exact", matchedId: row.id };
    }

    const bodySim = jaccard(bodyShingles, shingles(row.body, 3));
    if (bodySim >= input.threshold) {
      return { duplicate: true, similarity: bodySim, reason: "body_similarity", matchedId: row.id };
    }

    // Başlıklar kısa olduğu için ayrı ve sabit, daha yüksek bir eşikle bakılır.
    const titleSim = jaccard(titleShingles, shingles(row.title, 2));
    if (titleSim >= 0.75) {
      return { duplicate: true, similarity: titleSim, reason: "title_similarity", matchedId: row.id };
    }

    const sim = Math.max(bodySim, titleSim);
    if (sim > best.similarity) {
      best = {
        duplicate: false,
        similarity: sim,
        reason: bodySim >= titleSim ? "body_similarity" : "title_similarity",
        matchedId: row.id,
      };
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/*                                   Üretim                                   */
/* -------------------------------------------------------------------------- */

export type GeneratedComplaint = {
  title: string;
  body: string;
  /** Herkese görünen yazar adı (Türk ismi). */
  displayName: string;
  source: "ai" | "template";
};

function cleanLine(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, max);
}

/**
 * Tek bir sentetik şikayet metni üretir.
 *
 * AI anahtarı varsa model kullanılır; YOKSA şablon yedeğine düşülür. Anahtar
 * tanımlı ama sağlayıcı hata veriyorsa hata YUKARI fırlatılır (sessizce
 * şablona düşmek, operatörün model çıktısı beklediği bir kurulumda yanıltıcı
 * olurdu) — çağıran hatayı bot_runs kaydına yazar.
 */
export async function generateComplaint(input: {
  brandName: string;
  config: BotConfig;
  scenario: ScenarioKey;
  rating: number;
  avoidTitles: string[];
  avoidBodies?: string[];
  avoidDisplayNames?: string[];
  variationAngle?: string;
}): Promise<GeneratedComplaint> {
  if (!isAiConfigured()) {
    const t = fallbackComplaint({ scenario: input.scenario, language: input.config.language });
    return {
      title: t.title,
      body: t.body,
      displayName: pickTurkishDisplayName(input.avoidDisplayNames),
      source: "template",
    };
  }

  const raw = await chatCompleteJson<{ title?: string; body?: string; nickname?: string }>({
    messages: buildComplaintMessages({
      brandName: input.brandName,
      scenario: input.scenario,
      language: input.config.language,
      tone: input.config.complaintTone,
      rating: input.rating,
      customInstructions: input.config.customInstructions,
      avoidTitles: input.avoidTitles,
      avoidBodies: input.avoidBodies,
      variationAngle: input.variationAngle ?? pickVariationAngle(),
    }),
    temperature: 0.95,
    maxTokens: 560,
  });

  const title = cleanLine(raw.title, 200);
  const body = cleanLine(raw.body, 5000);
  if (title.length < 6 || body.length < 40) {
    throw new AiError("Model geçersiz şikayet üretti (metin çok kısa)", { retryable: true });
  }

  return {
    title,
    body,
    displayName: normalizeBotDisplayName(raw.nickname, input.avoidDisplayNames),
    source: "ai",
  };
}

/** Şikayete marka yanıtı üretir. AI yoksa tona uygun şablon yanıt döner. */
export async function generateComplaintResponse(input: {
  brandName: string;
  title: string;
  body: string;
  scenario: string;
  config: BotConfig;
  rating: number;
}): Promise<{ text: string; source: "ai" | "template" }> {
  if (!isAiConfigured()) {
    return {
      text: fallbackResponse({
        scenario: input.scenario,
        language: input.config.language,
        tone: input.config.responseTone,
      }),
      source: "template",
    };
  }

  const raw = await chatCompleteJson<{ response?: string }>({
    messages: buildResponseMessages({
      brandName: input.brandName,
      complaintTitle: input.title,
      complaintBody: input.body,
      scenario: scenarioLabel(input.scenario, input.config.language),
      language: input.config.language,
      tone: input.config.responseTone,
      rating: input.rating,
      customInstructions: input.config.customInstructions,
    }),
    temperature: 0.65,
    maxTokens: 400,
  });

  const text = cleanLine(raw.response, 2000);
  if (text.length < 40) {
    throw new AiError("Model geçersiz yanıt üretti (metin çok kısa)", { retryable: true });
  }
  return { text, source: "ai" };
}

/* -------------------------------------------------------------------------- */
/*                              Bot kullanıcısı                               */
/* -------------------------------------------------------------------------- */

const BOT_EMAIL = "complaint-bot@system.local";
let cachedBotUserId: string | null = null;

/**
 * Şikayet satırları `user_id` ister. Bot için TEK bir sistem kullanıcısı
 * kullanılır (giriş yapamaz). Dışarıda görünen ad `anon_name` + is_anonymous
 * ile rastgele Türk ismi olarak yazılır — bot kimliği ASLA gösterilmez.
 */
async function ensureBotUser(): Promise<string> {
  if (cachedBotUserId) return cachedBotUserId;

  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, BOT_EMAIL))
    .limit(1);

  if (existing) {
    cachedBotUserId = existing.id;
    return existing.id;
  }

  const [created] = await db
    .insert(schema.user)
    .values({ name: "Şikayet Botu", email: BOT_EMAIL, emailVerified: false })
    .onConflictDoNothing({ target: schema.user.email })
    .returning({ id: schema.user.id });

  // Yarış durumu: başka bir istek aynı anda oluşturmuş olabilir.
  const id =
    created?.id ??
    (
      await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, BOT_EMAIL))
        .limit(1)
    )[0]?.id;

  if (!id) throw new Error("Bot kullanıcısı oluşturulamadı");

  await db
    .insert(schema.profiles)
    .values({ id, fullName: "Şikayet Botu", username: "sikayet-botu" })
    .onConflictDoNothing();

  cachedBotUserId = id;
  return id;
}

/* -------------------------------------------------------------------------- */
/*                                 Çalıştırma                                 */
/* -------------------------------------------------------------------------- */

export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * postgres.js, drizzle `sql` şablonuna Date bağlayınca
 * `Buffer.byteLength(date)` ile düşer. ISO + timestamptz cast güvenli yoldur.
 */
export function sqlTs(d: Date) {
  return sql`${d.toISOString()}::timestamptz`;
}

export function sqlTodayStart() {
  return sqlTs(todayStart());
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

export type BotRunResult = {
  runId: string | null;
  brandId: string;
  brandName: string;
  status: "success" | "partial" | "failed" | "skipped";
  targetCount: number;
  complaintsGenerated: number;
  responsesGenerated: number;
  duplicatesDetected: number;
  retriedResponses: number;
  errors: string[];
  reason?: string;
};

/** Aynı markanın iki kez paralel çalışmasını engelleyen süreç-içi kilit. */
const running = new Set<string>();

/**
 * Senaryo seçimi: izinli senaryolar arasından SON KULLANILANLARI eleyerek
 * çeşitliliği zorlar (aynı gün üst üste 3 "withdrawal" gelmesin).
 */
function pickScenario(allowed: ScenarioKey[], recent: string[]): ScenarioKey {
  const pool = allowed.length ? allowed : [...SCENARIO_KEYS];
  const fresh = pool.filter((s) => !recent.includes(s));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

type BrandRow = { id: string; name: string; categoryId: string | null };

async function writeComplaint(input: {
  brand: BrandRow;
  config: BotConfig;
  scenario: ScenarioKey;
  rating: number;
  generated: GeneratedComplaint;
  runId: string;
  generatedBy: "ai_bot" | "ai_manual";
  botUserId: string;
}): Promise<string> {
  const code = `SK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  // Şikayet "az önce" değil, gün içinde makul bir saatte açılmış görünsün;
  // yanıt süresi ortalaması da bu sayede gerçekçi çıkar.
  const createdAt = new Date(Math.max(todayStart().getTime(), Date.now() - randInt(45, 480) * 60_000));

  const [row] = await db
    .insert(schema.complaints)
    .values({
      userId: input.botUserId,
      brandId: input.brand.id,
      categoryId: input.brand.categoryId,
      title: input.generated.title,
      body: input.generated.body,
      status: "approved",
      rating: null,
      // Firma profilinde görünsün; yazar adı anon_name'de (Türk ismi).
      isPublic: true,
      isAnonymous: true,
      anonName: input.generated.displayName,
      isSynthetic: true,
      generatedBy: input.generatedBy,
      language: input.config.language,
      botScenario: input.scenario,
      botRunId: input.runId,
      publicId: code,
      shortId: code.toLowerCase(),
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: schema.complaints.id });

  return row.id;
}

async function writeResponse(input: {
  complaintId: string;
  text: string;
  language: string;
  botUserId: string;
  generatedBy: "ai_bot" | "ai_manual";
  /** Şikayet bazlı memnuniyet — yalnızca yanıt sonrası yazılır. */
  rating?: number | null;
}): Promise<void> {
  await db.insert(schema.complaintReplies).values({
    complaintId: input.complaintId,
    userId: input.botUserId,
    body: input.text,
    isBrand: true,
    isInternal: false,
    language: input.language,
    generatedBy: input.generatedBy,
  });

  const [c] = await db
    .select({ createdAt: schema.complaints.createdAt })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, input.complaintId))
    .limit(1);

  const now = new Date();
  const minutes = c
    ? Math.max(1, Math.round((now.getTime() - new Date(c.createdAt).getTime()) / 60_000))
    : 1;

  await db
    .update(schema.complaints)
    .set({
      status: "answered",
      brandResponse: input.text,
      brandResponseAt: now,
      firstResponseAt: now,
      firstResponseMinutes: minutes,
      botError: null,
      ...(input.rating != null ? { rating: clamp(Math.round(input.rating), 1, 5) } : {}),
      updatedAt: now,
    })
    .where(eq(schema.complaints.id, input.complaintId));
}

/**
 * Bir marka için botu çalıştırır.
 *
 * Idempotans: o gün üretilmiş sentetik şikayet sayısı hedefe ulaşmışsa hiçbir
 * şey üretilmez ("skipped"). Bu yüzden cron gün içinde kaç kez tetiklenirse
 * tetiklensin toplam sabit kalır.
 */
export async function runBotForBrand(opts: {
  brandId: string;
  trigger: "cron" | "manual";
  triggeredBy?: string | null;
  /** Manuel üretimde kaç adet (cron'da yok sayılır). */
  count?: number;
  /** Manuel üretimde sabit senaryo/puan/dil. */
  scenario?: ScenarioKey;
  rating?: number;
  language?: LanguageCode;
  /** Manuel çağrıda bot kapalı olsa da üret. */
  ignoreEnabled?: boolean;
  /** Manuel üretimde marka yanıtı yazılsın mı (yoksa marka ayarı). */
  withResponse?: boolean;
}): Promise<BotRunResult> {
  const [brand] = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
      categoryId: schema.brands.categoryId,
      isActive: schema.brands.isActive,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, opts.brandId))
    .limit(1);

  const base = {
    runId: null,
    brandId: opts.brandId,
    brandName: brand?.name ?? "",
    targetCount: 0,
    complaintsGenerated: 0,
    responsesGenerated: 0,
    duplicatesDetected: 0,
    retriedResponses: 0,
    errors: [] as string[],
  };

  if (!brand) return { ...base, status: "failed", errors: ["Marka bulunamadı"] };
  if (!brand.isActive && opts.trigger === "cron") {
    return { ...base, status: "skipped", reason: "Marka pasif" };
  }

  const config = await getBotConfig(opts.brandId);
  if (!config.enabled && !opts.ignoreEnabled) {
    return { ...base, status: "skipped", reason: "Bot kapalı" };
  }

  const shouldGenerateResponse = opts.withResponse ?? config.generateResponses;

  if (running.has(opts.brandId)) {
    return { ...base, status: "skipped", reason: "Bu marka için çalışma sürüyor" };
  }
  running.add(opts.brandId);

  const effectiveConfig: BotConfig = {
    ...config,
    language: opts.language ?? config.language,
  };

  try {
    const [{ count: todayCountRaw }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.complaints)
      .where(
        and(
          eq(schema.complaints.brandId, opts.brandId),
          eq(schema.complaints.isSynthetic, true),
          gte(schema.complaints.createdAt, sqlTodayStart()),
        ),
      );
    const todayCount = Number(todayCountRaw);

    const target =
      opts.trigger === "manual"
        ? clamp(Math.round(opts.count ?? 1), 1, 10)
        : Math.max(0, effectiveConfig.dailyTarget - todayCount);

    if (target <= 0) {
      return {
        ...base,
        status: "skipped",
        reason: `Günlük hedef tamamlandı (${todayCount}/${effectiveConfig.dailyTarget})`,
      };
    }

    const [run] = await db
      .insert(schema.botRuns)
      .values({
        brandId: opts.brandId,
        trigger: opts.trigger,
        status: "running",
        targetCount: target,
        provider: aiProviderLabel(),
        triggeredBy: opts.triggeredBy ?? null,
      })
      .returning({ id: schema.botRuns.id });

    const result: BotRunResult = { ...base, runId: run.id, status: "success", targetCount: target };
    const botUserId = await ensureBotUser();
    const generatedBy = opts.trigger === "manual" ? "ai_manual" : "ai_bot";

    // Panelde/AI promptunda tekrardan kaçınmak için son başlıklar + senaryolar.
    const recent = await db
      .select({
        title: schema.complaints.title,
        body: schema.complaints.body,
        scenario: schema.complaints.botScenario,
        anonName: schema.complaints.anonName,
      })
      .from(schema.complaints)
      .where(eq(schema.complaints.brandId, opts.brandId))
      .orderBy(desc(schema.complaints.createdAt))
      .limit(50);

    const avoidTitles = recent.map((r) => r.title);
    const avoidBodies = recent.map((r) => r.body);
    const avoidDisplayNames = recent
      .map((r) => r.anonName)
      .filter((n): n is string => !!n);
    const recentScenarios = recent
      .map((r) => r.scenario)
      .filter((s): s is string => !!s)
      .slice(0, 8);

    /* --- 1) Önce yanıtı üretilemeyen eski şikayetleri yeniden dene --------- */
    const stuck = await db
      .select({
        id: schema.complaints.id,
        title: schema.complaints.title,
        body: schema.complaints.body,
        scenario: schema.complaints.botScenario,
        rating: schema.complaints.rating,
        language: schema.complaints.language,
      })
      .from(schema.complaints)
      .where(
        and(
          eq(schema.complaints.brandId, opts.brandId),
          eq(schema.complaints.isSynthetic, true),
          isNotNull(schema.complaints.botError),
        ),
      )
      .orderBy(desc(schema.complaints.createdAt))
      .limit(MAX_RETRY_PER_RUN);

    if (shouldGenerateResponse) {
      for (const item of stuck) {
        try {
          const retryRating = item.rating ?? generateRating(effectiveConfig);
          const response = await generateComplaintResponse({
            brandName: brand.name,
            title: item.title,
            body: item.body,
            scenario: item.scenario ?? "customer_support",
            config: { ...effectiveConfig, language: (item.language as LanguageCode) ?? effectiveConfig.language },
            rating: retryRating,
          });
          await writeResponse({
            complaintId: item.id,
            text: response.text,
            language: item.language ?? effectiveConfig.language,
            botUserId,
            generatedBy,
            rating: retryRating,
          });
          result.responsesGenerated++;
          result.retriedResponses++;
        } catch (e) {
          result.errors.push(`Yanıt yeniden denemesi başarısız (${item.id}): ${errText(e)}`);
        }
      }
    }

    /* --- 2) Eksik şikayetleri üret ----------------------------------------- */
    for (let i = 0; i < target; i++) {
      const scenario = opts.scenario ?? pickScenario(effectiveConfig.scenarios, recentScenarios);
      const rating = opts.rating
        ? clamp(Math.round(opts.rating), 1, 5)
        : generateRating(effectiveConfig);

      let generated: GeneratedComplaint | null = null;

      // Kopya çıkarsa farklı senaryoyla en fazla 5 kez dene.
      for (let attempt = 0; attempt < 5 && !generated; attempt++) {
        const attemptScenario =
          attempt === 0
            ? scenario
            : (opts.scenario ?? pickScenario(effectiveConfig.scenarios, [...recentScenarios, scenario]));
        const variationAngle = pickVariationAngle();

        let candidate: GeneratedComplaint;
        try {
          candidate = await generateComplaint({
            brandName: brand.name,
            config: effectiveConfig,
            scenario: attemptScenario,
            rating,
            avoidTitles,
            avoidBodies,
            avoidDisplayNames,
            variationAngle,
          });
        } catch (e) {
          result.errors.push(`Şikayet üretimi başarısız: ${errText(e)}`);
          break;
        }

        // Üretilen metin ön moderasyondan geçmiyorsa (küfür/PII) kullanılmaz.
        const mod = moderateAndScore(`${candidate.title}\n${candidate.body}`);
        if (!mod.ok) {
          result.errors.push(`Üretilen metin ön moderasyonu geçmedi: ${mod.issues[0] ?? ""}`);
          continue;
        }

        const verdict = await detectDuplicateComplaint({
          brandId: opts.brandId,
          title: candidate.title,
          body: candidate.body,
          threshold: effectiveConfig.similarityThreshold,
        });
        if (verdict.duplicate) {
          result.duplicatesDetected++;
          continue;
        }

        generated = candidate;
        recentScenarios.unshift(attemptScenario);
        avoidBodies.unshift(candidate.body);
        avoidDisplayNames.unshift(candidate.displayName);

        const complaintId = await writeComplaint({
          brand,
          config: effectiveConfig,
          scenario: attemptScenario,
          rating,
          generated: candidate,
          runId: run.id,
          generatedBy,
          botUserId,
        });
        result.complaintsGenerated++;
        avoidTitles.unshift(candidate.title);

        /* --- 3) Yanıt üret (isteğe bağlı) ----------------------------------- */
        if (shouldGenerateResponse) {
          try {
            const response = await generateComplaintResponse({
              brandName: brand.name,
              title: candidate.title,
              body: candidate.body,
              scenario: attemptScenario,
              config: effectiveConfig,
              rating,
            });
            await writeResponse({
              complaintId,
              text: response.text,
              language: effectiveConfig.language,
              botUserId,
              generatedBy,
              rating,
            });
            result.responsesGenerated++;
          } catch (e) {
            // Şikayet duruyor, yanıt yok: işaretle ki sonraki çalışmada
            // YENİDEN ÜRETİLMESİN, sadece yanıtı tekrar denensin.
            const message = errText(e);
            result.errors.push(`Yanıt üretilemedi (${complaintId}): ${message}`);
            await db
              .update(schema.complaints)
              .set({ botError: message.slice(0, 500), updatedAt: new Date() })
              .where(eq(schema.complaints.id, complaintId));
          }
        }
      }
    }

    /* --- 4) Kapanış -------------------------------------------------------- */
    const status: BotRunResult["status"] =
      result.complaintsGenerated === 0 && result.errors.length > 0
        ? "failed"
        : result.errors.length > 0 || result.complaintsGenerated < target
          ? "partial"
          : "success";
    result.status = status;

    await db
      .update(schema.botRuns)
      .set({
        status,
        completedAt: new Date(),
        complaintsGenerated: result.complaintsGenerated,
        responsesGenerated: result.responsesGenerated,
        duplicatesDetected: result.duplicatesDetected,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 20),
      })
      .where(eq(schema.botRuns.id, run.id));

    await db
      .insert(schema.brandBotConfigs)
      .values({ brandId: opts.brandId, lastRunAt: new Date() })
      .onConflictDoUpdate({
        target: schema.brandBotConfigs.brandId,
        set: { lastRunAt: new Date(), updatedAt: new Date() },
      });

    // Yeni şikayet/yanıt = marka sayaçları ve puan ortalaması tazelenmeli.
    if (result.complaintsGenerated > 0 || result.responsesGenerated > 0) {
      await refreshBrandAggregates(opts.brandId);
    }

    return result;
  } catch (e) {
    console.error("[complaint-bot] beklenmeyen hata:", opts.brandId, e);
    return { ...base, status: "failed", errors: [errText(e)] };
  } finally {
    running.delete(opts.brandId);
  }
}

function errText(e: unknown): string {
  if (e instanceof AiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Cron girişi: botu AÇIK olan tüm aktif markalar için paralel (sınırlı) çalıştırır.
 */
export async function runComplaintBotForAllBrands(opts: {
  trigger: "cron" | "manual";
  triggeredBy?: string | null;
}): Promise<{ brands: number; results: BotRunResult[] }> {
  const rows = await db
    .select({ brandId: schema.brandBotConfigs.brandId })
    .from(schema.brandBotConfigs)
    .innerJoin(schema.brands, eq(schema.brands.id, schema.brandBotConfigs.brandId))
    .where(and(eq(schema.brandBotConfigs.enabled, true), eq(schema.brands.isActive, true)));

  const results = await runBotForBrands(
    rows.map((r) => r.brandId),
    {
      trigger: opts.trigger,
      triggeredBy: opts.triggeredBy ?? null,
    },
  );

  return { brands: rows.length, results };
}

export type RunBotForBrandOpts = {
  brandId: string;
  trigger: "cron" | "manual";
  triggeredBy?: string | null;
  count?: number;
  scenario?: ScenarioKey;
  rating?: number;
  language?: LanguageCode;
  ignoreEnabled?: boolean;
};

const DEFAULT_PARALLEL = 3;
const MAX_PARALLEL = 8;

function botParallelLimit(): number {
  const n = Number(process.env.BOT_PARALLEL_BRANDS);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PARALLEL;
  return Math.min(MAX_PARALLEL, Math.round(n));
}

/** Sınırlı eşzamanlılıkla promise havuzu — ek bağımlılık yok. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Seçili markalara aynı anda (sınırlı paralellik) şikayet üretir. */
export async function runBotForBrands(
  brandIds: string[],
  opts: Omit<RunBotForBrandOpts, "brandId">,
): Promise<BotRunResult[]> {
  const unique = [...new Set(brandIds.filter(Boolean))];
  if (!unique.length) return [];

  return mapPool(unique, botParallelLimit(), (brandId) =>
    runBotForBrand({ ...opts, brandId }),
  );
}

export function summarizeBotResults(results: BotRunResult[]) {
  const complaints = results.reduce((s, r) => s + r.complaintsGenerated, 0);
  const responses = results.reduce((s, r) => s + r.responsesGenerated, 0);
  const duplicates = results.reduce((s, r) => s + r.duplicatesDetected, 0);
  const errors = results.flatMap((r) => r.errors);
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const ok = results.filter((r) => r.status === "success" || r.status === "partial").length;

  let status: "success" | "partial" | "failed" | "skipped" = "success";
  if (ok === 0 && skipped === results.length) status = "skipped";
  else if (failed === results.length) status = "failed";
  else if (failed > 0 || skipped > 0) status = "partial";

  return { status, complaints, responses, duplicates, errors };
}
