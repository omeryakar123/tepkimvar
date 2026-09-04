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

function ruleBasedAssist(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const combined = userTexts.join("\n");
  const brand = matchBrand(combined, brands);

  const amount = extractAmount(combined);
  const hasProblem = combined.length >= 15;
  const hasBrand = Boolean(brand);
  const hasAmount = Boolean(amount);

  const paragraphs = userTexts.filter((t) => t.length > 2);
  let body = currentBody.trim();
  if (!body && paragraphs.length > 0) {
    body = paragraphs.join("\n\n");
  }

  let title = currentTitle.trim();
  if (!title && brand && hasProblem) {
    title = `${brand.name} — ${paragraphs[paragraphs.length - 1]?.slice(0, 70) ?? "Şikayet"}`;
  } else if (!title && hasProblem) {
    title = paragraphs[paragraphs.length - 1]?.slice(0, 100) ?? "";
  }

  const missingFields: string[] = [];
  if (!hasBrand) missingFields.push("marka");
  if (!hasAmount) missingFields.push("tutar");
  if (body.length < 40) missingFields.push("detay");

  let reply: string;
  if (!hasProblem) {
    reply = "Merhaba! Hangi bahis/casino sitesiyle sorun yaşadınız ve tam olarak ne oldu? Kısaca anlatın.";
  } else if (!hasBrand) {
    reply =
      "Anladım. Hangi site/marka olduğunu yazar mısınız? (Örn: Jojobet, Betconstruct vb.) Bu bilgi şikayetin doğru firmaya ulaşması için gerekli.";
  } else if (!hasAmount) {
    reply = `${brand!.name} ile ilgili olduğunu not ettim. Etkilenen tutar ne kadar? (Örn: 500.000 TL) Ayrıca yaklaşık tarih varsa ekleyin.`;
  } else if (body.length < 80) {
    reply =
      "Teşekkürler. Sorunun ne zaman başladığı, yaptığınız işlemler (yatırım/çekim) ve siteye ulaşıp ulaşamadığınızı birkaç cümleyle ekler misiniz?";
  } else {
    reply =
      "Teşekkürler, gerekli bilgileri aldım. Başka eklemek istediğiniz bir detay var mı?";
  }

  const readyToContinue = body.length >= 40 && title.length >= 6 && hasBrand;
  const draftQuality: ComplaintAssistResult["draftQuality"] =
    body.length >= 120 && hasBrand && hasAmount
      ? "excellent"
      : body.length >= 60
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

const SYSTEM_PROMPT = `Sen tepkimvar.com şikayet yazma asistanısın. Türkçe, profesyonel ve empatik konuş.
Görevin: kullanıcının dağınık anlatımından moderasyona uygun, yayına hazır şikayet metni oluşturmak.

Kurallar:
- Bahis/casino platform şikayetlerine odaklan.
- title: net, 6-120 karakter, marka adı geçsin.
- body: 3-6 paragraf, kronolojik, somut (tutar, tarih, kullanıcı adı varsa), küfür/yalan ekleme.
- Eksik kritik bilgi varsa nazikçe sor (marka, tutar, tarih, işlem türü).
- readyToContinue: body>=80 karakter VE marka belli VE sorun net ise true.
- draftQuality: draft | good | excellent
- brandName: metinden tespit ettiğin marka (listeden biri olmalı).
- rating: kullanıcı memnun değilse 1-2, belirsizse null.

JSON döndür:
{ reply, title, body, brandName, rating, readyToContinue, draftQuality, missingFields }

readyToContinue true olduğunda reply kısa olsun; kullanıcıya başka detay eklemek isteyip istemediğini sor.`;

const FINALIZE_PROMPT = `Sen tepkimvar.com şikayet yazma asistanısın. Sohbet tamamlandı — son adımdasın.
Görevin: kullanıcının anlattıklarından moderasyona uygun, profesyonel ve kronolojik nihai şikayet metni yazmak.

Kurallar:
- title: net, 6-120 karakter, marka adı geçsin.
- body: 3-6 paragraf, somut (tutar, tarih, işlem türü), birinci tekil, küfür/yalan ekleme.
- reply: kısa (1-2 cümle) — düzenlenmiş özeti sunduğunu ve onay beklediğini söyle.
- readyToContinue: her zaman true.
- draftQuality: good veya excellent.

JSON döndür:
{ reply, title, body, brandName, rating, readyToContinue, draftQuality, missingFields }`;

function ruleBasedFinalize(
  messages: AssistMessage[],
  brands: BrandHint[],
  currentTitle: string,
  currentBody: string,
): ComplaintAssistResult {
  const base = ruleBasedAssist(messages, brands, currentTitle, currentBody);
  return {
    ...base,
    reply:
      "Anlattıklarınızı düzenledim. Aşağıdaki şikayet özetini kontrol edin; onaylarsanız marka adımına geçeriz.",
    readyToContinue: true,
    draftQuality: base.body.length >= 80 ? "good" : base.draftQuality,
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

  try {
    const raw = await chatCompleteJson<AiAssistJson>({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Markalar (eşleştir): ${brandList || "—"}

Mevcut taslak başlık: ${input.currentTitle ?? ""}
Mevcut taslak gövde: ${input.currentBody ?? ""}

Sohbet:
${input.messages.map((m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`).join("\n")}`,
        },
      ],
      temperature: mode === "finalize" ? 0.5 : 0.65,
      maxTokens: mode === "finalize" ? 1200 : 900,
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
