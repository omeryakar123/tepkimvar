/**
 * Sunucu tarafı ön moderasyon + duygu analizi.
 *
 * ÖNEMLİ: Bu dosya SUNUCUDA çalışır. Daha önce `src/lib/sentiment.ts` olarak
 * duruyordu ama hiçbir yerden çağrılmıyordu — yani arayüz "şikayetin
 * moderasyondan geçer" derken hiçbir kontrol yapılmıyordu.
 *
 * Ne yapar: Türkçe küfür/hakaret, T.C. kimlik no, telefon, IBAN ve kart
 * numarası tespiti + anahtar kelimeye dayalı duygu tahmini.
 * Ne YAPMAZ: bu bir yapay zekâ değil; kural tabanlı bir ÖN filtredir.
 * Şüpheli içerik yayınlanmaz, moderasyon kuyruğuna düşer.
 */

export type Sentiment = "angry" | "sad" | "neutral" | "positive";

const PROFANITY = [
  "amk", "aq", "amına", "amına koy", "orospu", "piç", "sik", "siktir", "yarrak", "göt", "ibne",
  "sg", "mq", "amcık", "kahpe", "puşt", "şerefsiz", "salak", "geri zekalı", "pezevenk",
];

const ANGRY = ["rezalet", "berbat", "iğrenç", "asla", "dolandırıcı", "yalancı", "kandırdı", "çaldı", "scam", "öfke", "kabus", "felaket"];
const SAD = ["üzgün", "kırıldım", "hayal kırıklığı", "mağdurum", "çaresiz", "ağladım"];
const POSITIVE = ["teşekkür", "memnun", "harika", "süper", "çözüldü", "mükemmel", "tebrik"];

/**
 * Küfür eşleşmesi KELİME SINIRIYLA yapılır.
 * Alt-dizgi araması yapılırsa masum kelimeler yakalanır: "sik" -> "sikayet",
 * "göt" -> "götürdü". Türkçe karakterler harf sayılsın diye \p{L} kullanılıyor
 * (\b latin dışı harflerde güvenilir değil).
 */
const PROFANITY_RE = new RegExp(
  `(^|[^\\p{L}])(${PROFANITY.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^\\p{L}]|$)`,
  "iu",
);

function hasProfanity(lowerText: string): boolean {
  return PROFANITY_RE.test(lowerText);
}

const TC_RE = /\b[1-9]\d{10}\b/;
const PHONE_RE = /\b(?:\+?90[\s-]?)?(?:0?5\d{2})[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/;
const IBAN_RE = /\bTR\d{2}\s?(\d{4}\s?){5}\d{2}\b/i;
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/;

export type ModerationResult = {
  ok: boolean;
  issues: string[];
  sentiment: Sentiment;
  confidence: number;
  isHighPriority: boolean;
};

export function moderateAndScore(text: string): ModerationResult {
  const issues: string[] = [];
  const low = text.toLowerCase();

  if (hasProfanity(low)) issues.push("Ağır küfür/hakaret tespit edildi — şikayetinizi nezaket çerçevesinde düzenleyin.");
  if (TC_RE.test(text)) issues.push("T.C. Kimlik Numarası gibi hassas kişisel veri tespit edildi — lütfen kaldırın.");
  if (PHONE_RE.test(text)) issues.push("Telefon numarası tespit edildi — gizlilik için kaldırmanızı öneririz.");
  if (IBAN_RE.test(text)) issues.push("IBAN tespit edildi — finansal bilginizi paylaşmayın.");
  if (CC_RE.test(text.replace(/[^\d ]/g, "")) && /\d{13,}/.test(text.replace(/\D/g, ""))) {
    issues.push("Kart numarasına benzer bir dizi tespit edildi — lütfen kaldırın.");
  }

  const angryHits = ANGRY.filter((w) => low.includes(w)).length;
  const sadHits = SAD.filter((w) => low.includes(w)).length;
  const positiveHits = POSITIVE.filter((w) => low.includes(w)).length;

  let sentiment: Sentiment = "neutral";
  let confidence = 0.5;
  if (angryHits >= 2 || (angryHits >= 1 && issues.some((i) => i.includes("küfür")))) {
    sentiment = "angry";
    confidence = Math.min(0.95, 0.6 + angryHits * 0.1);
  } else if (sadHits > angryHits && sadHits >= 1) {
    sentiment = "sad";
    confidence = Math.min(0.9, 0.55 + sadHits * 0.1);
  } else if (positiveHits >= 2) {
    sentiment = "positive";
    confidence = Math.min(0.9, 0.6 + positiveHits * 0.1);
  } else if (angryHits >= 1) {
    sentiment = "angry";
    confidence = 0.65;
  }

  const isHighPriority = sentiment === "angry" && (angryHits >= 2 || /dolandırıcı|scam|çaldı/.test(low));

  return {
    ok: issues.length === 0,
    issues,
    sentiment,
    confidence,
    isHighPriority,
  };
}
