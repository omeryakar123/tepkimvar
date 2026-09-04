import { chatCompleteJson, isAiConfigured } from "@/lib/server/ai/client";
import {
  loadComplaintAssistantConfig,
  type ComplaintAssistantConfig,
} from "@/lib/server/complaint-assistant-config";

export type AssistMessage = { role: "user" | "assistant"; content: string };

export type BrandHint = { id: string; name: string };

export type ComplaintAssistResult = {
  reply: string;
  title: string;
  body: string;
  suggestedBrandName: string | null;
  suggestedBrandId: string | null;
  suggestedRating: number | null;
  readyToContinue: boolean;
  draftQuality: "draft" | "good" | "excellent";
  missingFields: string[];
  aiUsed: boolean;
};

type AiAssistJson = {
  reply?: string;
  title?: string;
  body?: string;
  brandName?: string;
  rating?: number;
  readyToContinue?: boolean;
  draftQuality?: string;
  missingFields?: string[];
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, "");
}

function matchBrand(text: string, brands: BrandHint[]): BrandHint | null {
  const n = normalize(text);
  if (!n) return null;

  let best: BrandHint | null = null;
  let bestLen = 0;
  for (const b of brands) {
    const bn = normalize(b.name);
    if (bn.length < 3) continue;
    if (n.includes(bn) && bn.length > bestLen) {
      best = b;
      bestLen = bn.length;
    }
  }
  return best;
}

/** Son kullanıcı mesajlarındaki markayı önceliklendirir (marka değişimini yakalar). */
function matchBrandFromMessages(messages: AssistMessage[], brands: BrandHint[]): BrandHint | null {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  for (let i = userTexts.length - 1; i >= 0; i--) {
    const hit = matchBrand(userTexts[i], brands);
    if (hit) return hit;
  }
  return matchBrand(userTexts.join("\n"), brands);
}

function extractAmount(text: string): string | null {
  const m = text.match(/(\d[\d.,\s]*)\s*(tl|try|lira|bin|k)?/i);
  if (!m) return null;
  return m[0].trim();
}

function buildDraftFromConversation(messages: AssistMessage[], brand: BrandHint | null): string {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  if (userTexts.length === 0) return "";

  const substantive = userTexts.filter((t) => t.length > 3 && !/^(merhaba|selam|hey|hi|hello)$/i.test(t));
  const intro = brand
    ? `${brand.name} platformunda yaşadığım sorun hakkında şikayetimi iletmek istiyorum.`
    : "Yaşadığım sorun hakkında şikayetimi iletmek istiyorum.";

  const amount = extractAmount(substantive.join(" "));
  const amountLine = amount ? `\n\nEtkilenen tutar: ${amount}.` : "";

  return `${intro}\n\n${substantive.join("\n\n")}${amountLine}`.trim();
}

function inferMissing(combined: string, brand: BrandHint | null, body: string): string[] {
  const missing: string[] = [];
  if (!brand) missing.push("marka");
  if (!extractAmount(combined) && !/\d/.test(combined)) missing.push("tutar");
  if (body.length < 60) missing.push("detay");
  if (!/(tarih|gün|ay|hafta|dün|bugün|\d{1,2}[./]\d{1,2})/i.test(combined)) missing.push("tarih");
  return missing;
}

function contextualReply(
  messages: AssistMessage[],
  body: string,
  brand: BrandHint | null,
): string {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const last = userTexts[userTexts.length - 1] ?? "";
  const combined = userTexts.join(" ");
  const missing = inferMissing(combined, brand, body);

  if (/^(merhaba|selam|hey|hi|hello|günaydın|iyi akşamlar)/i.test(last) && last.length < 30) {
    return "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın.";
  }

  if (!brand) {
    return "Anladım. Hangi bahis/casino sitesi olduğunu yazar mısınız?";
  }

  if (last.length <= 20 && matchBrand(last, [brand]) && missing.includes("detay")) {
    return `${brand.name} ile ilgili not aldım. Yaşadığınız sorunu birkaç cümleyle anlatır mısınız?`;
  }

  if (missing.includes("detay")) {
    return "Sorunun ne olduğunu biraz daha anlatır mısınız? (Yatırım/çekim, site ne dedi, hesaba erişim vb.)";
  }
  if (missing.includes("tutar")) {
    return "Etkilenen tutar yaklaşık ne kadar?";
  }
  if (missing.includes("tarih")) {
    return "Sorun yaklaşık ne zaman başladı?";
  }

  if (body.length >= 80) {
    return "Teşekkürler. Başka eklemek istediğiniz bir detay var mı?";
  }

  return "Anlattıklarınızı not aldım. Biraz daha detay verirseniz metni güçlendirebilirim.";
}

function sanitizeReply(raw: string, title: string, brand: BrandHint | null, fallback: string): string {
  const reply = raw.trim();
  if (!reply || reply.length < 15) return fallback;
  if (reply === title.trim()) return fallback;
  if (brand && normalize(reply) === normalize(brand.name)) return fallback;
  if (reply.length < 40 && !reply.includes("?") && !reply.includes(".") && !reply.includes(",")) {
    return fallback;
  }
  return reply;
}

function ruleBasedAssist(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const combined = userTexts.join("\n");
  const brand = matchBrandFromMessages(messages, brands);

  let body = currentBody.trim();
  if (!body || body.length < userTexts.join(" ").length) {
    body = buildDraftFromConversation(messages, brand);
  }

  let title = currentTitle.trim();
  if (!title && brand && body.length > 20) {
    const firstLine = body.split(/[.!?\n]/)[0]?.trim() ?? "";
    title = firstLine.length >= 6 ? firstLine.slice(0, 120) : `${brand.name} — Şikayet`;
  } else if (!title && body) {
    title = body.split(/[.!?\n]/)[0]?.slice(0, 100) ?? "";
  }

  const missingFields = inferMissing(combined, brand, body);
  const reply = contextualReply(messages, body, brand);

  const readyToContinue =
    body.length >= 80 && title.length >= 6 && Boolean(brand) && missingFields.length <= 1;

  const draftQuality: ComplaintAssistResult["draftQuality"] =
    body.length >= 140 && brand && !missingFields.includes("tutar")
      ? "excellent"
      : body.length >= 70
        ? "good"
        : "draft";

  return {
    reply,
    title: title.slice(0, 200),
    body: body.slice(0, 5000),
    suggestedBrandName: brand?.name ?? null,
    suggestedBrandId: brand?.id ?? null,
    suggestedRating: readyToContinue ? 1 : null,
    readyToContinue,
    draftQuality,
    missingFields,
    aiUsed: false,
  };
}

function ruleBasedFinalize(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const base = ruleBasedAssist(messages, brands, currentTitle, currentBody);
  const brand = matchBrandFromMessages(messages, brands);
  const polished =
    base.body.length >= 80 ? base.body : buildDraftFromConversation(messages, brand);

  return {
    ...base,
    body: polished.slice(0, 5000),
    reply:
      "Anlattıklarınızı düzenledim. Özeti kontrol edin; uygunsa onaylayarak devam edebilirsiniz.",
    readyToContinue: true,
    draftQuality: polished.length >= 100 ? "good" : base.draftQuality,
    aiUsed: false,
  };
}

function buildSystemPrompt(config: ComplaintAssistantConfig, mode: "chat" | "finalize", brandList: string): string {
  const base = mode === "finalize" ? config.finalizePrompt : config.systemPrompt;
  const extra = config.customInstructions.trim();
  return `${base}${extra ? `\n\nEk talimatlar:\n${extra}` : ""}\n\nMarkalar (eşleştir): ${brandList || "—"}`;
}

export async function assistComplaintDraft(input: {
  messages: AssistMessage[];
  brands: BrandHint[];
  currentTitle?: string;
  currentBody?: string;
  mode?: "chat" | "finalize";
}): Promise<ComplaintAssistResult> {
  const brands = input.brands.slice(0, 200);
  const userTexts = input.messages.filter((m) => m.role === "user").map((m) => m.content);
  const combined = userTexts.join("\n");
  const mode = input.mode ?? "chat";
  const config = await loadComplaintAssistantConfig();

  const fallback = () =>
    mode === "finalize"
      ? ruleBasedFinalize(input.messages, brands, input.currentTitle ?? "", input.currentBody ?? "")
      : ruleBasedAssist(
          input.messages,
          brands,
          input.currentTitle ?? "",
          input.currentBody ?? "",
        );

  if (!isAiConfigured() || combined.trim().length < 2) {
    return fallback();
  }

  const brandList = brands.map((b) => b.name).slice(0, 80).join(", ");

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(config, mode, brandList) },
    ...input.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const raw = await chatCompleteJson<AiAssistJson>({
      messages: aiMessages,
      temperature: mode === "finalize" ? Math.min(config.temperature, 0.5) : config.temperature,
      maxTokens: config.maxTokens,
    });

    const matched =
      brands.find((b) => normalize(b.name) === normalize(raw.brandName ?? "")) ??
      matchBrand(raw.brandName ?? combined, brands) ??
      matchBrandFromMessages(input.messages, brands);

    const title = (raw.title ?? input.currentTitle ?? "").trim().slice(0, 200);
    const body = (raw.body ?? input.currentBody ?? combined).trim().slice(0, 5000);
    const fb = contextualReply(input.messages, body, matched);
    const reply = sanitizeReply(raw.reply ?? "", title, matched, fb);

    const ready =
      mode === "finalize" ||
      Boolean(raw.readyToContinue) ||
      (body.length >= 100 && title.length >= 6 && Boolean(matched));

    const quality = (["draft", "good", "excellent"] as const).includes(
      raw.draftQuality as ComplaintAssistResult["draftQuality"],
    )
      ? (raw.draftQuality as ComplaintAssistResult["draftQuality"])
      : body.length >= 120
        ? "excellent"
        : body.length >= 60
          ? "good"
          : "draft";

    return {
      reply,
      title,
      body,
      suggestedBrandName: matched?.name ?? raw.brandName?.trim() ?? null,
      suggestedBrandId: matched?.id ?? null,
      suggestedRating:
        typeof raw.rating === "number" && raw.rating >= 1 && raw.rating <= 5
          ? Math.round(raw.rating)
          : ready
            ? 1
            : null,
      readyToContinue: ready,
      draftQuality: quality,
      missingFields: Array.isArray(raw.missingFields) ? raw.missingFields.map(String) : [],
      aiUsed: true,
    };
  } catch {
    return fallback();
  }
}

export async function getComplaintAssistantGreeting(): Promise<string> {
  const config = await loadComplaintAssistantConfig();
  return config.greeting;
}
