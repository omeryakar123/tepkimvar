import postgres from "postgres";

export type ComplaintAssistantConfig = {
  greeting: string;
  systemPrompt: string;
  finalizePrompt: string;
  customInstructions: string;
  temperature: number;
  maxTokens: number;
};

export const DEFAULT_COMPLAINT_ASSISTANT_CONFIG: ComplaintAssistantConfig = {
  greeting:
    "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın; metninizi sizin için düzenleyeceğim.",
  systemPrompt: `Sen tepkimvar.com şikayet yazma asistanısın. Türkçe, profesyonel ve empatik konuş.

Görev: Kullanıcının serbest anlatımını dinle, bağlamı anla, eksik kritik bilgileri doğal ve TEK soruda tamamla. Arka planda moderasyona uygun şikayet metni oluştur.

Kritik bilgiler: marka/site, sorunun özü, tutar (varsa), yaklaşık tarih, işlem türü (yatırım/çekim/bonus).

Kurallar:
- reply: her zaman tam cümle, sohbet havasında; asla yalnızca marka adı veya başlık yazma.
- Kullanıcı selamlaşırsa kısa karşıla, hemen soruya geç.
- Kullanıcı marka adı yazdıysa tekrar sorma; sorunun ne olduğunu sor.
- Marka değiştiyse yeni markayı kabul et, eskisine takılma.
- title/body alanlarını her turda güncelle; body birinci tekil, kronolojik, 2-5 paragraf.
- readyToContinue: marka belli + body>=100 karakter + sorun net ise true.
- draftQuality: draft | good | excellent

JSON döndür:
{ "reply", "title", "body", "brandName", "rating", "readyToContinue", "draftQuality", "missingFields" }`,
  finalizePrompt: `Sohbet tamamlandı. Tüm mesajlardan moderasyona uygun nihai şikayet metni yaz.

- title: net, marka adı geçsin (6-120 karakter).
- body: 3-6 paragraf, birinci tekil, somut (tutar, tarih, işlem).
- reply: 1-2 cümle — özeti sunduğunu, onay beklediğini söyle (asla sadece başlık yazma).
- readyToContinue: true

JSON:
{ "reply", "title", "body", "brandName", "rating", "readyToContinue", "draftQuality", "missingFields" }`,
  customInstructions: "",
  temperature: 0.55,
  maxTokens: 1100,
};

const META_KEY = "complaint_assistant_config_v1";

let cache: ComplaintAssistantConfig | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

function clampConfig(raw: Partial<ComplaintAssistantConfig>): ComplaintAssistantConfig {
  const d = DEFAULT_COMPLAINT_ASSISTANT_CONFIG;
  return {
    greeting: (raw.greeting ?? d.greeting).trim().slice(0, 500) || d.greeting,
    systemPrompt: (raw.systemPrompt ?? d.systemPrompt).trim().slice(0, 8000) || d.systemPrompt,
    finalizePrompt: (raw.finalizePrompt ?? d.finalizePrompt).trim().slice(0, 8000) || d.finalizePrompt,
    customInstructions: (raw.customInstructions ?? d.customInstructions).trim().slice(0, 4000),
    temperature: Math.min(1, Math.max(0, Number(raw.temperature ?? d.temperature) || d.temperature)),
    maxTokens: Math.min(2000, Math.max(400, Math.round(Number(raw.maxTokens ?? d.maxTokens) || d.maxTokens))),
  };
}

export async function loadComplaintAssistantConfig(): Promise<ComplaintAssistantConfig> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;

  const url = process.env.DATABASE_URL;
  if (!url) {
    cache = DEFAULT_COMPLAINT_ASSISTANT_CONFIG;
    cacheAt = now;
    return cache;
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value text)`.catch(() => {});
    const rows = await sql<{ value: string }[]>`
      SELECT value FROM app_meta WHERE key = ${META_KEY} LIMIT 1
    `;
    if (!rows[0]?.value) {
      cache = DEFAULT_COMPLAINT_ASSISTANT_CONFIG;
    } else {
      try {
        cache = clampConfig(JSON.parse(rows[0].value) as Partial<ComplaintAssistantConfig>);
      } catch {
        cache = DEFAULT_COMPLAINT_ASSISTANT_CONFIG;
      }
    }
    cacheAt = now;
    return cache;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

export async function saveComplaintAssistantConfig(
  input: Partial<ComplaintAssistantConfig>,
): Promise<ComplaintAssistantConfig> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL yok");

  const current = await loadComplaintAssistantConfig();
  const next = clampConfig({ ...current, ...input });

  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value text)`;
    await sql`
      INSERT INTO app_meta (key, value) VALUES (${META_KEY}, ${JSON.stringify(next)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    cache = next;
    cacheAt = Date.now();
    return next;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

export function invalidateComplaintAssistantConfigCache(): void {
  cache = null;
  cacheAt = 0;
}
