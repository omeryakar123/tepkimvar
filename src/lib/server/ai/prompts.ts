/**
 * Prompt & senaryo katmanı.
 *
 * Promptlar iş mantığının içine gömülmesin diye tüm metinler burada durur:
 * senaryo kataloğu, ton/dil sözlükleri, prompt kurucular ve AI anahtarı
 * olmadığında kullanılan ŞABLON YEDEĞİ.
 *
 * Şablon yedeği neden var: özellik bir SaaS'a ekleniyor ve sağlayıcı anahtarı
 * girilmemiş bir kurulumda botun sessizce hiçbir şey üretmemesi (ya da hata
 * kusması) kabul edilemez. Yedek, token'lı çerçevelerden kombinatoryal metin
 * üretir; benzerlik kontrolü zaten kopyaları eler.
 */

export const SCENARIO_KEYS = [
  "deposit",
  "withdrawal",
  "bonus",
  "free_spin",
  "casino_game",
  "sports_betting",
  "verification",
  "customer_support",
  "technical",
  "account",
  "payment",
] as const;

export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export const COMPLAINT_TONES = ["natural", "angry", "disappointed", "neutral", "formal"] as const;
export type ComplaintTone = (typeof COMPLAINT_TONES)[number];

export const RESPONSE_TONES = ["professional", "friendly", "formal", "short", "empathetic"] as const;
export type ResponseTone = (typeof RESPONSE_TONES)[number];

export const LANGUAGES = ["tr", "en", "de", "es", "ru"] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

const LANGUAGE_NAMES: Record<string, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  es: "Spanish",
  ru: "Russian",
};

const COMPLAINT_TONE_HINTS: Record<ComplaintTone, string> = {
  natural: "the everyday tone of a real customer: mildly irritated but coherent",
  angry: "clearly angry and impatient, but without profanity or insults",
  disappointed: "let down and discouraged, more sad than aggressive",
  neutral: "matter-of-fact, reporting the issue without emotion",
  formal: "polite and formal, like a written petition",
};

const RESPONSE_TONE_HINTS: Record<ResponseTone, string> = {
  professional: "professional, calm and solution-focused",
  friendly: "warm and approachable while still professional",
  formal: "formal and corporate, using courteous phrasing",
  short: "very concise — at most three sentences, no filler",
  empathetic: "empathetic, acknowledging the frustration before the solution",
};

type ScenarioLocale = { label: string; titles: string[]; details: string[] };

type Scenario = {
  key: ScenarioKey;
  /** Modele verilen varyasyon ipucu (İngilizce; model çıktıyı hedef dilde üretir). */
  hint: string;
  tr: ScenarioLocale;
  en: ScenarioLocale;
};

/**
 * 11 senaryo. `titles`/`details` yalnızca şablon yedeği içindir; AI aktifse
 * model bunları görmez, sadece `hint` ile yönlendirilir (aksi halde çıktılar
 * şablonlara benzeşip tekrara düşer).
 */
export const SCENARIOS: Scenario[] = [
  {
    key: "deposit",
    hint: "a deposit that never arrived, was credited to the wrong account, got stuck as pending, or was debited twice",
    tr: {
      label: "Para yatırma",
      titles: ["Yatırdığım para hesabıma geçmedi", "Yatırım işlemi askıda kaldı", "Aynı yatırım iki kez çekildi"],
      details: [
        "{method} ile {amount} TL yatırım yaptım, tutar bankadan çıktı ama hesabıma tanımlanmadı.",
        "{amount} TL yatırımım {days} gündür 'beklemede' görünüyor, dekontu da ilettim.",
        "Tek yatırım yaptım fakat kartımdan {amount} TL iki kez çekilmiş, fazlası iade edilmedi.",
      ],
    },
    en: {
      label: "Deposit",
      titles: ["My deposit never reached my account", "Deposit stuck as pending", "I was charged twice for one deposit"],
      details: [
        "I deposited {amount} via {method}; the money left my bank but was never credited.",
        "My {amount} deposit has been 'pending' for {days} days even though I sent the receipt.",
        "I made a single deposit but {amount} was charged twice and the extra was never refunded.",
      ],
    },
  },
  {
    key: "withdrawal",
    hint: "a withdrawal that is delayed far beyond the promised window, silently cancelled, or repeatedly reset to pending",
    tr: {
      label: "Para çekme",
      titles: ["Çekim talebim {days} gündür onaylanmadı", "Çekim talebim sebepsiz iptal edildi", "Para çekme sürekli beklemede"],
      details: [
        "{amount} TL çekim talebim {days} gündür işleme alınmadı, açıklama da yapılmıyor.",
        "Çekim talebim hiçbir gerekçe gösterilmeden iptal edildi, bakiyem geri döndü ama sorunum sürüyor.",
        "{method} ile {amount} TL çekmek istedim; talep her seferinde tekrar 'beklemede' durumuna düşüyor.",
      ],
    },
    en: {
      label: "Withdrawal",
      titles: ["My withdrawal has been pending for {days} days", "Withdrawal cancelled without reason", "Withdrawal keeps resetting to pending"],
      details: [
        "My {amount} withdrawal has not been processed for {days} days and nobody explains why.",
        "My withdrawal was cancelled without any justification; the balance came back but the issue remains.",
        "I requested {amount} via {method} and the request keeps falling back to 'pending'.",
      ],
    },
  },
  {
    key: "bonus",
    hint: "a bonus that was not credited, was removed mid-play, or had wagering terms that were changed or hidden",
    tr: {
      label: "Bonus",
      titles: ["Bonusum tanımlanmadı", "Bonusum oyun sırasında silindi", "Çevrim şartları sonradan değişti"],
      details: [
        "Kampanya koşullarını sağladım ama {amount} TL bonus hesabıma tanımlanmadı.",
        "Çevrimi sürerken bonusum ve kazancım tek seferde silindi, gerekçe iletilmedi.",
        "Bonusu alırken belirtilen çevrim şartı sonradan değiştirildi, kazancım geçersiz sayıldı.",
      ],
    },
    en: {
      label: "Bonus",
      titles: ["My bonus was never credited", "My bonus was removed mid-play", "Wagering terms changed after the fact"],
      details: [
        "I met every campaign condition but the {amount} bonus was never added to my account.",
        "My bonus and winnings were wiped out mid-wagering with no explanation.",
        "The wagering requirement was changed after I claimed the bonus and my winnings were voided.",
      ],
    },
  },
  {
    key: "free_spin",
    hint: "free spins that never appeared, expired early, or paid nothing due to an apparent error",
    tr: {
      label: "Free spin",
      titles: ["Free spin haklarım yüklenmedi", "Free spinlerim süresi dolmadan kayboldu", "Free spin kazancı hesaba geçmedi"],
      details: [
        "Kampanyadan hak ettiğim free spinler {days} gündür hesabıma yüklenmedi.",
        "Kullanmadığım free spinler süresi bitmeden hesabımdan kaldırıldı.",
        "Free spinlerden kazandığım {amount} TL bakiyeme yansımadı.",
      ],
    },
    en: {
      label: "Free spins",
      titles: ["My free spins were never added", "Free spins disappeared before expiry", "Free spin winnings never credited"],
      details: [
        "The free spins I earned from the campaign have not been added for {days} days.",
        "My unused free spins were removed from the account before their expiry date.",
        "The {amount} I won from free spins was never reflected in my balance.",
      ],
    },
  },
  {
    key: "casino_game",
    hint: "a casino game that froze mid-round, lost a winning round after a disconnect, or settled a round incorrectly",
    tr: {
      label: "Casino oyunu",
      titles: ["Oyun ortasında donma yaşadım", "Bağlantı koptu, kazancım silindi", "Tur yanlış sonuçlandı"],
      details: [
        "{game} oyununda tur ortasında ekran dondu, bahsim düştü ama sonuç işlenmedi.",
        "Kazandığım turda bağlantı koptu ve dönüşte {amount} TL kazanç hesabımda yoktu.",
        "{game} oyununda tur yanlış sonuçlandırıldı, oyun geçmişi ile bakiyem uyuşmuyor.",
      ],
    },
    en: {
      label: "Casino game",
      titles: ["The game froze mid-round", "Lost my winnings after a disconnect", "A round was settled incorrectly"],
      details: [
        "{game} froze in the middle of a round; my stake was taken but the round never settled.",
        "I disconnected during a winning round and the {amount} win was gone when I returned.",
        "A {game} round settled incorrectly — my game history does not match my balance.",
      ],
    },
  },
  {
    key: "sports_betting",
    hint: "a sports bet voided after placement, settled against the official result, or with odds changed at the last second",
    tr: {
      label: "Spor bahis",
      titles: ["Kuponum haksız şekilde iptal edildi", "Maç sonucu yanlış işlendi", "Oran son saniyede değişti"],
      details: [
        "Kazanan kuponum maç bitiminden sonra 'iptal' olarak işaretlendi.",
        "Resmî sonuç farklı olmasına rağmen kuponum kaybetti olarak sonuçlandırıldı.",
        "Bahsi onayladığım anda oran düşürüldü ve {amount} TL kazancım eksik ödendi.",
      ],
    },
    en: {
      label: "Sports betting",
      titles: ["My winning slip was voided unfairly", "Match result settled incorrectly", "Odds dropped at the last second"],
      details: [
        "My winning slip was marked as 'void' after the match had already ended.",
        "My slip was settled as a loss even though the official result says otherwise.",
        "The odds were cut the moment I confirmed the bet and I was paid {amount} less than shown.",
      ],
    },
  },
  {
    key: "verification",
    hint: "KYC documents rejected without a reason, verification stuck for days, or the same document requested repeatedly",
    tr: {
      label: "Hesap doğrulama",
      titles: ["Belgelerim sebepsiz reddedildi", "Doğrulama {days} gündür bitmedi", "Aynı belge tekrar tekrar isteniyor"],
      details: [
        "Kimlik ve adres belgemi yükledim, gerekçe belirtilmeden reddedildi.",
        "Doğrulama sürecim {days} gündür sonuçlanmadı, bu yüzden çekim yapamıyorum.",
        "Aynı belgeyi {days} kez yükledim, her seferinde yeniden talep ediliyor.",
      ],
    },
    en: {
      label: "Verification",
      titles: ["My documents were rejected without reason", "Verification unfinished for {days} days", "The same document is requested again and again"],
      details: [
        "I uploaded my ID and address proof and both were rejected with no reason given.",
        "My verification has been unresolved for {days} days, so I cannot withdraw.",
        "I have uploaded the same document {days} times and it keeps being requested again.",
      ],
    },
  },
  {
    key: "customer_support",
    hint: "support that never replies, closes the chat without solving, or gives contradictory answers between agents",
    tr: {
      label: "Müşteri hizmetleri",
      titles: ["Canlı destek yanıt vermiyor", "Talebim çözülmeden kapatıldı", "Her temsilci farklı şey söylüyor"],
      details: [
        "Canlı desteğe {days} gündür yazıyorum, tek bir yanıt alamadım.",
        "Destek talebim çözüm üretilmeden 'kapatıldı' olarak işaretlendi.",
        "Görüştüğüm her temsilci farklı bir açıklama yapıyor, süreç ilerlemiyor.",
      ],
    },
    en: {
      label: "Customer support",
      titles: ["Live support never answers", "My ticket was closed without a solution", "Every agent tells me something different"],
      details: [
        "I have been writing to live support for {days} days without a single reply.",
        "My support ticket was marked as 'closed' without any solution.",
        "Every agent gives me a different explanation and nothing moves forward.",
      ],
    },
  },
  {
    key: "technical",
    hint: "a technical fault: app crashes, login loops, pages not loading, or balance shown incorrectly",
    tr: {
      label: "Teknik sorun",
      titles: ["Uygulama sürekli çöküyor", "Giriş ekranı döngüye giriyor", "Bakiyem hatalı görünüyor"],
      details: [
        "Mobil uygulama açılışta kapanıyor, {days} gündür işlem yapamıyorum.",
        "Giriş yaptıktan sonra sürekli oturum düşüyor ve tekrar giriş ekranına dönüyorum.",
        "Bakiyem sitede {amount} TL, uygulamada farklı görünüyor; hangisi doğru bilmiyorum.",
      ],
    },
    en: {
      label: "Technical issue",
      titles: ["The app keeps crashing", "Login screen loops endlessly", "My balance is displayed incorrectly"],
      details: [
        "The mobile app closes on launch and I have not been able to do anything for {days} days.",
        "My session drops right after login and I am sent back to the login screen.",
        "My balance shows {amount} on the website but something else in the app.",
      ],
    },
  },
  {
    key: "account",
    hint: "an account locked or self-excluded by mistake, closed without notice, or duplicated",
    tr: {
      label: "Hesap işlemleri",
      titles: ["Hesabım habersiz kapatıldı", "Hesabım hatalı şekilde kilitlendi", "Hesabıma erişemiyorum"],
      details: [
        "Hesabım hiçbir bildirim yapılmadan kapatıldı, bakiyem içeride kaldı.",
        "Hesabım güvenlik gerekçesiyle kilitlendi ama hangi kural ihlal edilmiş açıklanmıyor.",
        "E-posta ve şifrem doğru olmasına rağmen {days} gündür hesabıma giriş yapamıyorum.",
      ],
    },
    en: {
      label: "Account",
      titles: ["My account was closed without notice", "My account was locked by mistake", "I cannot access my account"],
      details: [
        "My account was closed without any notification and my balance is stuck inside.",
        "My account was locked for 'security reasons' but nobody says which rule I broke.",
        "My email and password are correct yet I have been locked out for {days} days.",
      ],
    },
  },
  {
    key: "payment",
    hint: "a payment method failing, a refund never issued, or an unexplained fee deducted from a transaction",
    tr: {
      label: "Ödeme",
      titles: ["Ödeme yöntemi çalışmıyor", "İade tutarı hiç yatmadı", "İşlemden açıklanmayan kesinti yapıldı"],
      details: [
        "{method} ile ödeme her denemede hata veriyor, başka yöntem de sunulmuyor.",
        "İade edileceği söylenen {amount} TL {days} gündür hesabıma geçmedi.",
        "{amount} TL işlemimden açıklanmayan bir kesinti yapıldı, faturası da yok.",
      ],
    },
    en: {
      label: "Payment",
      titles: ["Payment method does not work", "My refund never arrived", "An unexplained fee was deducted"],
      details: [
        "Paying with {method} fails on every attempt and no alternative is offered.",
        "The {amount} refund I was promised has not arrived for {days} days.",
        "An unexplained fee was deducted from my {amount} transaction and there is no invoice.",
      ],
    },
  },
];

export function scenarioByKey(key: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.key === key);
}

export function scenarioLabel(key: string, language: string): string {
  const s = scenarioByKey(key);
  if (!s) return key;
  return language === "tr" ? s.tr.label : s.en.label;
}

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? "English";
}

/* -------------------------------------------------------------------------- */
/*                              Prompt kurucular                              */
/* -------------------------------------------------------------------------- */

export type ComplaintPromptInput = {
  brandName: string;
  scenario: ScenarioKey;
  language: string;
  tone: ComplaintTone;
  rating: number;
  customInstructions?: string | null;
  /** Modelin tekrara düşmemesi için son üretilen başlıklar. */
  avoidTitles: string[];
};

const COMPLAINT_SYSTEM = [
  "You generate SYNTHETIC test data for a consumer complaint platform.",
  "The output is stored as clearly flagged synthetic content for QA, demo and staging environments.",
  "Write like a single real customer describing one concrete incident.",
  "Hard rules:",
  "- Never invent real people's names, phone numbers, e-mails, IBANs, card numbers or ID numbers.",
  "- No profanity, no insults, no threats, no accusations of crime.",
  "- One incident only. No marketing language, no meta commentary, no emojis.",
  "- Return ONLY a JSON object with keys: title, body, nickname.",
].join("\n");

export function buildComplaintMessages(input: ComplaintPromptInput) {
  const scenario = scenarioByKey(input.scenario);
  const avoid = input.avoidTitles.slice(0, 12);

  const user = [
    `Brand: ${input.brandName}`,
    `Scenario: ${input.scenario} — ${scenario?.hint ?? ""}`,
    `Language: ${languageName(input.language)} (write everything in this language)`,
    `Customer tone: ${COMPLAINT_TONE_HINTS[input.tone]}`,
    `Satisfaction the customer would give afterwards: ${input.rating}/5 — the severity of the text must match this score (1 = severe unresolved problem, 5 = minor issue that was handled well).`,
    "",
    "Constraints:",
    "- title: 4-10 words, no quotes, no brand slogan.",
    "- body: 45-110 words, first person, includes one concrete detail (an amount, a duration or a step already taken).",
    "- nickname: a short invented display name (no real-looking full names).",
    avoid.length ? `- Must NOT resemble any of these existing titles: ${avoid.map((t) => `"${t}"`).join(", ")}` : "",
    input.customInstructions ? `\nBrand-specific instructions: ${input.customInstructions}` : "",
    "",
    'Respond as: {"title": "...", "body": "...", "nickname": "..."}',
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: COMPLAINT_SYSTEM },
    { role: "user" as const, content: user },
  ];
}

export type ResponsePromptInput = {
  brandName: string;
  complaintTitle: string;
  complaintBody: string;
  scenario: string;
  language: string;
  tone: ResponseTone;
  rating: number;
  customInstructions?: string | null;
};

const RESPONSE_SYSTEM = [
  "You are the customer support team of the brand, replying publicly to one complaint.",
  "Hard rules:",
  "- Reply in the SAME language as the complaint.",
  "- Address the specific issue described; never answer generically.",
  "- Max 90 words. No emojis, no signature block, no links.",
  "- Never promise a specific payout amount or date you cannot know; describe the next concrete step instead.",
  "- Never ask for card numbers, passwords or full ID numbers in public.",
  "- Return ONLY a JSON object with key: response.",
].join("\n");

export function buildResponseMessages(input: ResponsePromptInput) {
  const user = [
    `Brand: ${input.brandName}`,
    `Language: ${languageName(input.language)}`,
    `Support tone: ${RESPONSE_TONE_HINTS[input.tone]}`,
    `Scenario: ${input.scenario}`,
    `Customer satisfaction score: ${input.rating}/5 — a low score means the reply must acknowledge the failure more directly.`,
    "",
    `Complaint title: ${input.complaintTitle}`,
    `Complaint body: ${input.complaintBody}`,
    input.customInstructions ? `\nBrand-specific instructions: ${input.customInstructions}` : "",
    "",
    'Respond as: {"response": "..."}',
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: RESPONSE_SYSTEM },
    { role: "user" as const, content: user },
  ];
}

/* -------------------------------------------------------------------------- */
/*                              Şablon yedeği                                 */
/* -------------------------------------------------------------------------- */

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

const TOKEN_POOLS = {
  tr: {
    method: ["havale/EFT", "kredi kartı", "banka kartı", "mobil ödeme", "kripto (USDT)"],
    game: ["slot", "canlı casino", "rulet", "blackjack", "çark oyunu"],
  },
  en: {
    method: ["bank transfer", "credit card", "debit card", "mobile payment", "crypto (USDT)"],
    game: ["a slot", "live casino", "roulette", "blackjack", "a wheel game"],
  },
} as const;

const DEMANDS = {
  tr: [
    "Konunun ivedilikle çözülmesini ve bilgilendirilmeyi talep ediyorum.",
    "Somut bir açıklama ve işlem tarihi bekliyorum.",
    "Mağduriyetimin giderilmesini istiyorum, aksi halde şikayetimi yetkili mercilere de ileteceğim.",
    "Bu süreçle ilgili yazılı bir dönüş yapılmasını rica ediyorum.",
  ],
  en: [
    "I expect this to be resolved urgently and to be informed about it.",
    "I would like a concrete explanation and a processing date.",
    "I want this resolved; otherwise I will escalate the complaint further.",
    "Please get back to me in writing about this process.",
  ],
} as const;

const CONTEXT = {
  tr: [
    "Destek ekibiyle {days} kez yazıştım, sonuç alamadım.",
    "Tüm belgeleri ve işlem numarasını ({ref}) paylaştım.",
    "Aynı sorunu daha önce de yaşadım ama bu kez hiç dönüş olmadı.",
    "Referans numaram {ref}; kayıtlarda görünüyor olmalı.",
  ],
  en: [
    "I have contacted support {days} times with no result.",
    "I shared every document and the transaction id ({ref}).",
    "I had the same problem before, but this time nobody replied at all.",
    "My reference number is {ref}; it should be visible in your records.",
  ],
} as const;

const NICKNAMES = [
  "gecikenkullanici", "sabirlimusteri", "kayipbakiye", "denizd", "arda_k", "mgurses",
  "beklemedeyim", "oyuncu42", "sessizmagdur", "yorgunkullanici", "efe.t", "seda_y",
  "player_88", "no_reply_user", "kanitlivar", "hesapmagduru",
];

function fillTokens(text: string, lang: "tr" | "en"): string {
  const pools = TOKEN_POOLS[lang];
  return text
    .replace(/\{days\}/g, String(int(2, 21)))
    .replace(/\{amount\}/g, lang === "tr" ? int(2, 60).toString() + "00" : int(50, 3000).toString())
    .replace(/\{method\}/g, pick(pools.method))
    .replace(/\{game\}/g, pick(pools.game))
    .replace(/\{ref\}/g, `#${int(100000, 999999)}`);
}

/** Şablon yedeği yalnızca tr/en biliyor; diğer diller en'e düşer. */
function baseLang(language: string): "tr" | "en" {
  return language === "tr" ? "tr" : "en";
}

export function fallbackComplaint(input: {
  scenario: ScenarioKey;
  language: string;
}): { title: string; body: string; nickname: string } {
  const lang = baseLang(input.language);
  const scenario = scenarioByKey(input.scenario) ?? SCENARIOS[0];
  const locale = scenario[lang];

  const title = fillTokens(pick(locale.titles), lang);
  const body = [
    fillTokens(pick(locale.details), lang),
    fillTokens(pick(CONTEXT[lang]), lang),
    pick(DEMANDS[lang]),
  ].join(" ");

  return { title, body, nickname: `${pick(NICKNAMES)}${int(1, 99)}` };
}

const RESPONSE_OPENERS: Record<ResponseTone, { tr: string; en: string }> = {
  professional: {
    tr: "Merhaba, yaşadığınız aksaklığı incelemeye aldık.",
    en: "Hello, we have taken your issue into review.",
  },
  friendly: {
    tr: "Merhaba, bu durumu bize bildirdiğiniz için teşekkür ederiz.",
    en: "Hi there, thank you for letting us know about this.",
  },
  formal: {
    tr: "Sayın kullanıcımız, bildiriminiz tarafımıza ulaşmıştır.",
    en: "Dear customer, your notification has reached our team.",
  },
  short: { tr: "Merhaba, konuyu inceliyoruz.", en: "Hello, we are looking into this." },
  empathetic: {
    tr: "Merhaba, yaşadığınız bu deneyim için gerçekten üzgünüz.",
    en: "Hello, we are truly sorry about the experience you had.",
  },
};

const RESPONSE_ACTIONS = {
  tr: [
    "İlgili birim {scenario} kaydınızı işlem numarasıyla birlikte kontrol ediyor.",
    "{scenario} talebiniz öncelikli kuyruğa alındı ve teknik ekibe iletildi.",
    "Kaydınızı açtık; {scenario} sürecindeki adımlar baştan doğrulanıyor.",
  ],
  en: [
    "The relevant team is checking your {scenario} record together with the transaction id.",
    "Your {scenario} request has been moved to the priority queue and shared with the technical team.",
    "We opened a case and are re-verifying every step of the {scenario} process.",
  ],
} as const;

const RESPONSE_CLOSERS = {
  tr: [
    "Sonucu en kısa sürede hesabınızdaki iletişim adresinden paylaşacağız.",
    "Gelişmeleri sizinle bu şikayet üzerinden paylaşacağız; ek belge gerekirse yazacağız.",
    "İnceleme tamamlandığında size dönüş yapılacaktır, anlayışınız için teşekkür ederiz.",
  ],
  en: [
    "We will share the outcome via the contact details on your account as soon as possible.",
    "We will post updates on this complaint and write to you if further documents are needed.",
    "You will hear back from us once the review is complete — thank you for your patience.",
  ],
} as const;

export function fallbackResponse(input: {
  scenario: string;
  language: string;
  tone: ResponseTone;
}): string {
  const lang = baseLang(input.language);
  const label = scenarioLabel(input.scenario, lang).toLowerCase();
  const opener = RESPONSE_OPENERS[input.tone][lang];

  if (input.tone === "short") {
    return `${opener} ${pick(RESPONSE_CLOSERS[lang])}`;
  }
  return [
    opener,
    pick(RESPONSE_ACTIONS[lang]).replace("{scenario}", label),
    pick(RESPONSE_CLOSERS[lang]),
  ].join(" ");
}
