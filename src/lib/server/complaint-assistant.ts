import { chatCompleteJson, isAiConfigured } from "@/lib/server/ai/client";

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

function extractAmount(text: string): string | null {
  const m = text.match(/(\d[\d.,\s]*)\s*(tl|try|lira|bin|k)?/i);
  if (!m) return null;
  return m[0].trim();
}

function buildDraftFromConversation(messages: AssistMessage[], brand: BrandHint | null): string {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  if (userTexts.length === 0) return "";

  const intro = brand
    ? `${brand.name} platformunda yaşadığım sorun hakkında şikayetimi iletmek istiyorum.`
    : "Yaşadığım sorun hakkında şikayetimi iletmek istiyorum.";

  const details = userTexts.join(" ");
  const amount = extractAmount(details);
  const amountLine = amount ? ` Etkilenen tutar: ${amount}.` : "";

  return `${intro}\n\n${userTexts.join("\n\n")}${amountLine ? `\n\n${amountLine.trim()}` : ""}`.trim();
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
  brands: BrandHint[],
  body: string,
  brand: BrandHint | null,
): string {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const last = userTexts[userTexts.length - 1] ?? "";
  const combined = userTexts.join(" ");
  const missing = inferMissing(combined, brand, body);

  if (userTexts.length <= 1 && last.length < 12) {
    return "Merhaba! Hangi siteyle sorun yaşadınız ve ne oldu? Kısaca anlatın — ben metni sizin için düzenleyeceğim.";
  }

  if (!brand) {
    if (/hangi|site|marka|firma/i.test(last)) {
      return "Marka adını net yazarsanız şikayetin doğru firmaya ulaşır. Örn: Jojobet, Matbet…";
    }
    return "Anladım. Hangi bahis/casino sitesi olduğunu yazar mısınız?";
  }

  if (missing.includes("tutar") && missing.includes("tarih")) {
    return `${brand.name} ile ilgili not ettim. Yaklaşık ne zaman oldu ve etkilenen tutar ne kadar? (Örn: 15.000 TL, geçen hafta)`;
  }
  if (missing.includes("tutar")) {
    return "Teşekkürler. Etkilenen tutar ne kadar? (Yaklaşık da olur)";
  }
  if (missing.includes("tarih")) {
    return "Sorun yaklaşık ne zaman başladı? (Tarih veya «geçen hafta» gibi)";
  }
  if (missing.includes("detay")) {
    return "Biraz daha detay ekler misiniz? Yatırım/çekim mi, site ne yanıt verdi, hesabınıza erişebiliyor musunuz?";
  }

  if (body.length >= 80) {
    return "Teşekkürler, yeterli bilgi topladım. Başka eklemek istediğiniz bir şey var mı?";
  }

  return "Anlattıklarınızı not aldım. Biraz daha detay verirseniz daha güçlü bir şikayet metni hazırlayabilirim.";
}

function ruleBasedAssist(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const combined = userTexts.join("\n");
  const brand = matchBrand(combined, brands);

  let body = currentBody.trim();
  if (!body || body.length < userTexts.join(" ").length) {
    body = buildDraftFromConversation(messages, brand);
  }

  let title = currentTitle.trim();
  if (!title && brand) {
    const snippet = userTexts[userTexts.length - 1]?.slice(0, 60) ?? "Şikayet";
    title = `${brand.name} — ${snippet.replace(/\s+/g, " ")}`;
  } else if (!title && body) {
    title = body.split(/[.!?\n]/)[0]?.slice(0, 100) ?? "";
  }

  const missingFields = inferMissing(combined, brand, body);
  const reply = contextualReply(messages, brands, body, brand);

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
  };
}

const SYSTEM_PROMPT = `Sen tepkimvar.com şikayet yazma asistanısın. Türkçe, samimi ama profesyonel konuş.

Görev: Kullanıcının serbest anlatımını dinle, bağlamı anla, eksik kritik bilgileri DOĞAL sorularla tamamla, arka planda yayına hazır şikayet metni oluştur.

Kritik bilgiler: marka/site adı, sorunun özü, tutar (varsa), yaklaşık tarih, yatırım/çekim/bonus gibi işlem türü.

Kurallar:
- Sabit soru listesi okuma; sohbete göre TEK odaklı soru sor.
- Kullanıcı zaten söylediğini tekrar sorma.
- title: net, 6-120 karakter, marka adı geçsin.
- body: 2-5 paragraf, kronolojik, birinci tekil, somut, küfür/uydurma ekleme.
- Her turda body'yi güncelle — kullanıcının söylediklerini profesyonel dile çevir.
- readyToContinue: marka belli + body>=80 karakter + sorun net ise true.
- draftQuality: draft | good | excellent
- brandName: listeden eşleşen marka.
- rating: memnuniyetsizlik 1-2, belirsizse null.

JSON:
{ "reply", "title", "body", "brandName", "rating", "readyToContinue", "draftQuality", "missingFields" }`;

const FINALIZE_PROMPT = `Sen tepkimvar.com şikayet yazma asistanısın. Sohbet bitti — nihai metni yaz.

Görev: Tüm sohbeti birleştirerek moderasyona uygun, profesyonel, kronolojik şikayet metni oluştur.

Kurallar:
- title: net, marka adı geçsin (6-120 karakter).
- body: 3-6 paragraf, birinci tekil, somut (tutar, tarih, işlem), akıcı Türkçe.
- reply: 1-2 cümle — özeti sunduğunu, onay beklediğini söyle.
- readyToContinue: true
- draftQuality: good veya excellent

JSON:
{ "reply", "title", "body", "brandName", "rating", "readyToContinue", "draftQuality", "missingFields" }`;

function ruleBasedFinalize(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const base = ruleBasedAssist(messages, brands, currentTitle, currentBody);
  const polished = base.body.length >= 80 ? base.body : buildDraftFromConversation(messages, matchBrand(
    messages.filter((m) => m.role === "user").map((m) => m.content).join("\n"),
    brands,
  ));

  return {
    ...base,
    body: polished.slice(0, 5000),
    reply:
      "Anlattıklarınızı düzenledim. Aşağıdaki özeti kontrol edin; uygunsa onaylayarak marka adımına geçebilirsiniz.",
    readyToContinue: true,
    draftQuality: polished.length >= 100 ? "good" : base.draftQuality,
  };
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

  if (!isAiConfigured() || combined.trim().length < 3) {
    return mode === "finalize"
      ? ruleBasedFinalize(input.messages, brands, input.currentTitle ?? "", input.currentBody ?? "")
      : ruleBasedAssist(
          input.messages,
          brands,
          input.currentTitle ?? "",
          input.currentBody ?? "",
        );
  }

  const brandList = brands.map((b) => b.name).slice(0, 80).join(", ");
  const systemPrompt = mode === "finalize" ? FINALIZE_PROMPT : SYSTEM_PROMPT;

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\nMarkalar (eşleştir): ${brandList || "—"}`,
    },
    ...input.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (input.currentTitle?.trim() || input.currentBody?.trim()) {
    aiMessages.push({
      role: "user",
      content: `[Sistem notu — mevcut taslak]\nBaşlık: ${input.currentTitle ?? ""}\nGövde: ${input.currentBody ?? ""}`,
    });
  }

  try {
    const raw = await chatCompleteJson<AiAssistJson>({
      messages: aiMessages,
      temperature: mode === "finalize" ? 0.45 : 0.55,
      maxTokens: mode === "finalize" ? 1400 : 1000,
    });

    const matched =
      brands.find((b) => normalize(b.name) === normalize(raw.brandName ?? "")) ??
      matchBrand(raw.brandName ?? combined, brands) ??
      matchBrand(combined, brands);

    const title = (raw.title ?? input.currentTitle ?? "").trim().slice(0, 200);
    const body = (raw.body ?? input.currentBody ?? combined).trim().slice(0, 5000);
    const reply = (raw.reply ?? "Anlattıklarınızı not aldım.").trim();

    const ready =
      mode === "finalize" ||
      Boolean(raw.readyToContinue) ||
      (body.length >= 80 && title.length >= 6 && Boolean(matched));

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
    };
  } catch {
    return mode === "finalize"
      ? ruleBasedFinalize(input.messages, brands, input.currentTitle ?? "", input.currentBody ?? combined)
      : ruleBasedAssist(
          input.messages,
          brands,
          input.currentTitle ?? "",
          input.currentBody ?? combined,
        );
  }
}
