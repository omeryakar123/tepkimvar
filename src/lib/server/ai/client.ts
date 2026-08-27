/**
 * Sağlayıcıdan bağımsız AI istemcisi (SUNUCU TARAFI).
 *
 * NEDEN ELLE: Projede daha önce hiç AI entegrasyonu yoktu (`moderation.ts`
 * kural tabanlı bir ön filtredir, AI değil) ve bağımlılık listesinde hiçbir AI
 * SDK'sı bulunmuyor. "Gereksiz dependency ekleme" kuralına uymak için OpenAI
 * ile UYUMLU `/chat/completions` sözleşmesine düz `fetch` ile konuşuyoruz.
 * Bu sözleşmeyi OpenAI, OpenRouter, Groq, Together, DeepSeek, vLLM ve Ollama
 * (`/v1`) aynı şekilde konuşur — sağlayıcı değiştirmek için tek env yeter.
 *
 * ANAHTAR YOKSA: `isAiConfigured()` false döner ve bot şablon tabanlı yerel
 * üretime düşer (bkz. prompts.ts). Yani özellik anahtarsız da çalışır, sistem
 * asla AI hatası yüzünden çökmez.
 */

export type AiRole = "system" | "user" | "assistant";
export type AiMessage = { role: AiRole; content: string };

export class AiError extends Error {
  /** Geçici hata mı? (429 / 5xx / timeout / ağ) — retry edilebilir. */
  retryable: boolean;
  status?: number;

  constructor(message: string, opts: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "AiError";
    this.retryable = opts.retryable ?? false;
    this.status = opts.status;
  }
}

type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  jsonMode: boolean;
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function num(key: string, fallback: number): number {
  const v = Number(env(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function readConfig(): AiConfig | null {
  const apiKey = env("AI_API_KEY");
  if (!apiKey) return null;
  return {
    baseUrl: (env("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey,
    model: env("AI_MODEL") || "gpt-4o-mini",
    timeoutMs: num("AI_TIMEOUT_MS", 30_000),
    maxRetries: Math.min(5, num("AI_MAX_RETRIES", 2)),
    jsonMode: env("AI_JSON_MODE") !== "false",
  };
}

export function isAiConfigured(): boolean {
  return readConfig() !== null;
}

/** Bot çalıştırma kaydına yazılan sağlayıcı etiketi. */
export function aiProviderLabel(): string {
  const cfg = readConfig();
  return cfg ? cfg.model : "template-fallback";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OpenAI 429 hem gerçek rate-limit hem `insufficient_quota` döner.
 * Kota/fatura kalıcıdır — retry etmek hem süreyi hem kotayı boşa harcar.
 */
function classifyHttpError(status: number, detail: string): { message: string; retryable: boolean } {
  let type = "";
  let apiMessage = "";
  try {
    const parsed = JSON.parse(detail) as {
      error?: { type?: string; code?: string; message?: string };
    };
    type = (parsed.error?.type ?? parsed.error?.code ?? "").toLowerCase();
    apiMessage = (parsed.error?.message ?? "").trim();
  } catch {
    /* gövde JSON değilse ham metne bakılır */
  }

  const blob = `${type} ${apiMessage} ${detail}`.toLowerCase();
  const quota =
    type === "insufficient_quota" ||
    blob.includes("insufficient_quota") ||
    blob.includes("exceeded your current quota");

  if (quota) {
    return {
      message:
        "OpenAI hesabında kullanılabilir API kredisi yok (insufficient_quota). Usage 0 normaldir — reddedilen istek sayılmaz. ChatGPT Plus API kredisi vermez. platform.openai.com → Settings → Billing’de kredi bakiyesi ve ödeme yöntemi; Limits’te proje/aylık bütçe $0 olmamalı. Kredi eklendiyse birkaç dakika bekleyin.",
      retryable: false,
    };
  }

  if (status === 401 || status === 403) {
    return {
      message: `AI API anahtarı reddedildi (${status}). AI_API_KEY değerini kontrol edin.`,
      retryable: false,
    };
  }

  const retryable = status === 408 || status === 429 || status >= 500;
  const short = apiMessage || detail.slice(0, 240);
  return {
    message: `AI isteği başarısız (${status}): ${short}`,
    retryable,
  };
}

/** 429/503 için sağlayıcının önerdiği bekleme; yoksa jitter'lı exponential. */
function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return Math.min(30_000, secs * 1000);
  }
  return Math.min(8_000, 2 ** attempt * 500) + Math.floor(Math.random() * 400);
}

type ChatOptions = {
  messages: AiMessage[];
  /** Yaratıcılık. Şikayet üretiminde yüksek, yanıt üretiminde düşük tutuyoruz. */
  temperature?: number;
  maxTokens?: number;
  /** true ise sağlayıcıdan JSON nesnesi istenir. */
  json?: boolean;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

/**
 * Tek bir sohbet tamamlama isteği. Geçici hatalarda `maxRetries` kadar
 * yeniden dener; kalıcı hatada AiError fırlatır (çağıran yakalar, loglar).
 */
export async function chatComplete(opts: ChatOptions): Promise<string> {
  const cfg = readConfig();
  if (!cfg) throw new AiError("AI yapılandırılmadı (AI_API_KEY yok)");

  // Bazı sağlayıcılar bilinmeyen alanları 400 ile reddeder; ilk 400'de
  // response_format'ı düşürüp bir kez daha deniyoruz.
  let useJsonMode = cfg.jsonMode && opts.json === true;
  let lastError: AiError | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 700,
          ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);

        if (res.status === 400 && useJsonMode) {
          useJsonMode = false;
          attempt--; // bu deneme "harcanmış" sayılmasın
          continue;
        }

        const classified = classifyHttpError(res.status, detail);
        lastError = new AiError(classified.message, {
          retryable: classified.retryable,
          status: res.status,
        });
        if (!classified.retryable || attempt === cfg.maxRetries) throw lastError;
        await sleep(backoffMs(attempt, res.headers.get("retry-after")));
        continue;
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        lastError = new AiError(
          data.error?.message ?? "AI boş yanıt döndürdü",
          { retryable: true },
        );
        if (attempt === cfg.maxRetries) throw lastError;
        await sleep(backoffMs(attempt, null));
        continue;
      }
      return content;
    } catch (e) {
      if (e instanceof AiError) {
        if (!e.retryable || attempt === cfg.maxRetries) throw e;
        lastError = e;
      } else {
        // AbortError (timeout) ve ağ hataları: geçici kabul edilir.
        const aborted = e instanceof Error && e.name === "AbortError";
        lastError = new AiError(
          aborted ? `AI isteği ${cfg.timeoutMs}ms içinde yanıt vermedi` : String(e),
          { retryable: true },
        );
        if (attempt === cfg.maxRetries) throw lastError;
      }
      await sleep(backoffMs(attempt, null));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new AiError("AI isteği başarısız");
}

/**
 * Modelin döndürdüğü metinden JSON çıkarır. Modeller sık sık ```json bloğu
 * veya açıklama cümlesi ekler; bu yüzden ilk `{`–son `}` aralığını alıyoruz.
 */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new AiError("AI yanıtı JSON olarak ayrıştırılamadı", { retryable: true });
  }
}

/** JSON bekleyen çağrılar için kısayol. */
export async function chatCompleteJson<T>(opts: ChatOptions): Promise<T> {
  const raw = await chatComplete({ ...opts, json: true });
  return parseJsonLoose<T>(raw);
}
