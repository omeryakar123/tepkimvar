/**
 * Sağlayıcıdan bağımsız AI istemcisi (SUNUCU TARAFI).
 *
 * Varsayılan sağlayıcı OpenRouter (`AI_PROVIDER=openrouter`): GPT-4o-mini
 * OpenAI kotası olmadan kullanılır. Doğrudan OpenAI için `AI_PROVIDER=openai`.
 *
 * ANAHTAR YOKSA: `isAiConfigured()` false döner ve bot şablon tabanlı yerel
 * üretime düşer (bkz. prompts.ts).
 */

export type AiRole = "system" | "user" | "assistant";
export type AiMessage = { role: AiRole; content: string };

export type AiProvider = "openrouter" | "openai" | "custom";

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
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  jsonMode: boolean;
  /** OpenRouter istek başlıkları (ranking / attribution). */
  extraHeaders: Record<string, string>;
};

const PROVIDER_PRESETS: Record<
  Exclude<AiProvider, "custom">,
  { baseUrl: string; model: string }
> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function num(key: string, fallback: number): number {
  const v = Number(env(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function resolveProvider(): AiProvider {
  const raw = env("AI_PROVIDER").toLowerCase();
  if (raw === "openai" || raw === "openrouter" || raw === "custom") return raw;
  // Eski kurulumlar: base URL'den tahmin et.
  const base = env("AI_BASE_URL").toLowerCase();
  if (base.includes("openrouter.ai")) return "openrouter";
  if (base.includes("api.openai.com")) return "openai";
  return "openrouter";
}

function readConfig(): AiConfig | null {
  const apiKey = env("AI_API_KEY");
  if (!apiKey) return null;

  const provider = resolveProvider();
  const preset = provider !== "custom" ? PROVIDER_PRESETS[provider] : null;

  const baseUrl = (
    env("AI_BASE_URL") || preset?.baseUrl || PROVIDER_PRESETS.openrouter.baseUrl
  ).replace(/\/+$/, "");

  const model = env("AI_MODEL") || preset?.model || PROVIDER_PRESETS.openrouter.model;

  const extraHeaders: Record<string, string> = {};
  if (provider === "openrouter" || baseUrl.includes("openrouter.ai")) {
    const referer = env("AI_HTTP_REFERER") || env("SITE_URL") || "https://tepkimvar.com";
    const title = env("AI_APP_TITLE") || "tepkimvar";
    extraHeaders["HTTP-Referer"] = referer;
    extraHeaders["X-Title"] = title;
  }

  return {
    provider,
    baseUrl,
    apiKey,
    model,
    timeoutMs: num("AI_TIMEOUT_MS", 30_000),
    maxRetries: Math.min(5, num("AI_MAX_RETRIES", 2)),
    jsonMode: env("AI_JSON_MODE") !== "false",
    extraHeaders,
  };
}

export function isAiConfigured(): boolean {
  return readConfig() !== null;
}

/** Bot çalıştırma kaydına yazılan sağlayıcı etiketi. */
export function aiProviderLabel(): string {
  const cfg = readConfig();
  if (!cfg) return "template-fallback";
  if (cfg.provider === "openrouter") return `openrouter/${cfg.model}`;
  if (cfg.provider === "openai") return `openai/${cfg.model}`;
  return cfg.model;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function providerName(provider: AiProvider): string {
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "openai") return "OpenAI";
  return "AI sağlayıcı";
}

/**
 * 429 hem rate-limit hem `insufficient_quota` dönebilir.
 * Kota/fatura kalıcıdır — retry etmek boşa harcar.
 */
function classifyHttpError(
  provider: AiProvider,
  status: number,
  detail: string,
): { message: string; retryable: boolean } {
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
    const hint =
      provider === "openrouter"
        ? "openrouter.ai → Credits sayfasından bakiye ekleyin veya AI_PROVIDER=openai ile doğrudan OpenAI deneyin."
        : "platform.openai.com → Billing’de API kredisi ekleyin veya AI_PROVIDER=openrouter ile OpenRouter kullanın.";
    return {
      message: `${providerName(provider)} kotası / kredisi yok (insufficient_quota). ${hint}`,
      retryable: false,
    };
  }

  if (status === 401 || status === 403) {
    const keyHint =
      provider === "openrouter"
        ? "OpenRouter anahtarı sk-or-v1-... formatında olmalı (openrouter.ai/keys)."
        : "OpenAI anahtarı sk-... veya sk-proj-... formatında olmalı.";
    return {
      message: `${providerName(provider)} API anahtarı reddedildi (${status}). AI_API_KEY değerini kontrol edin. ${keyHint}`,
      retryable: false,
    };
  }

  const retryable = status === 408 || status === 429 || status >= 500;
  const short = apiMessage || detail.slice(0, 240);
  return {
    message: `${providerName(provider)} isteği başarısız (${status}): ${short}`,
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
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export async function chatComplete(opts: ChatOptions): Promise<string> {
  const cfg = readConfig();
  if (!cfg) throw new AiError("AI yapılandırılmadı (AI_API_KEY yok)");

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
          ...cfg.extraHeaders,
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
          attempt--;
          continue;
        }

        const classified = classifyHttpError(cfg.provider, res.status, detail);
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

export async function chatCompleteJson<T>(opts: ChatOptions): Promise<T> {
  const raw = await chatComplete({ ...opts, json: true });
  return parseJsonLoose<T>(raw);
}
