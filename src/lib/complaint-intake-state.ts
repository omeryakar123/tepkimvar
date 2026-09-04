export interface ComplaintState {
  brandName: string | null;
  problem: string | null;
  transactionType: string | null;
  amount: number | string | null;
  currency: string | null;
  date: string | null;
  chronology: string[];
  evidence: string[];
  desiredResolution: string | null;
}

export const EMPTY_COMPLAINT_STATE: ComplaintState = {
  brandName: null,
  problem: null,
  transactionType: null,
  amount: null,
  currency: null,
  date: null,
  chronology: [],
  evidence: [],
  desiredResolution: null,
};

type BrandHint = { id: string; name: string };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, "");
}

function matchBrand(text: string, brands: BrandHint[]): string | null {
  const n = normalize(text);
  if (!n) return null;
  let best: string | null = null;
  let bestLen = 0;
  for (const b of brands) {
    const bn = normalize(b.name);
    if (bn.length < 3) continue;
    if (n.includes(bn) && bn.length > bestLen) {
      best = b.name;
      bestLen = bn.length;
    }
  }
  return best;
}

function parseAmount(raw: string): number | string {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : raw.trim();
}

function formatAmount(amount: number | string, currency: string | null): string {
  if (typeof amount === "number") {
    const formatted = amount.toLocaleString("tr-TR");
    return currency === "TRY" || !currency ? `${formatted} TL` : `${formatted} ${currency}`;
  }
  return String(amount);
}

const TX_PATTERNS: { re: RegExp; type: string }[] = [
  { re: /yatırım|yatirim|para yatır|para yatir|deposit/i, type: "yatırım" },
  { re: /çekim|cekim|para çek|para cek|withdraw/i, type: "çekim" },
  { re: /bonus|promosyon|freespin|free spin/i, type: "bonus" },
  { re: /bahis|kupon|iddaa/i, type: "bahis" },
  { re: /casino|slot|rulet|blackjack/i, type: "casino" },
  { re: /hesap|üyelik|uyelik|kapat|bloke|doğrulama|dogrulama|kimlik/i, type: "hesap" },
  { re: /teknik|site açılm|site acilm|bağlantı|baglanti|hata/i, type: "teknik sorun" },
  { re: /müşteri hizmet|musteri hizmet|canlı destek|canli destek|destek/i, type: "müşteri hizmetleri" },
];

const PROBLEM_PATTERNS: { re: RegExp; problem: string }[] = [
  { re: /yatırım.*(geçmedi|yansımadı|yansimadi|gelmedi)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /(geçmedi|yansımadı|yansimadi|gelmedi).*(yatırım|yatirim)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /çekim.*(yapılmadı|yapilmadi|gelmedi|vermediler|ödenmedi|odenmedi)/i, problem: "Çekim talebi karşılanmadı" },
  { re: /(vermediler|ödemediler|odedemediler|paramı vermediler|parami vermediler)/i, problem: "Ödeme/çekim yapılmadı" },
  { re: /bonus.*(verilmedi|iptal|silindi)/i, problem: "Bonus hakkı tanınmadı veya iptal edildi" },
  { re: /hesab.*(kapand|kapatt|bloke|askıya|askiya)/i, problem: "Hesap erişimi kısıtlandı veya kapatıldı" },
];

const DATE_PATTERNS: RegExp[] = [
  /\bdün\b|\bdun\b/i,
  /\bbugün\b|\bbugun\b/i,
  /\bgeçen hafta\b|\bgecen hafta\b/i,
  /\byaklaşık\s+\d+\s+gün\b|\byaklasik\s+\d+\s+gun\b/i,
  /\d{1,2}\s+(ocak|şubat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(\s+\d{4})?/i,
  /\d{1,2}[./]\d{1,2}([./]\d{2,4})?/,
];

const EVIDENCE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /dekont/i, label: "dekont" },
  { re: /ekran görüntüsü|ekran goruntusu|screenshot/i, label: "ekran görüntüsü" },
  { re: /işlem numarası|islem numarasi|referans/i, label: "işlem numarası" },
  { re: /canlı destek|canli destek|destek konuşması|destek konusmasi/i, label: "canlı destek konuşması" },
];

function extractDate(text: string): string | null {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

function extractAmountAndCurrency(text: string): { amount: number | string; currency: string } | null {
  const correction = text.match(
    /(\d[\d.,\s]*)\s*(?:tl|try|lira)?\s*değil\s*(\d[\d.,\s]*)\s*(tl|try|lira)?/i,
  );
  if (correction) {
    return { amount: parseAmount(correction[2]), currency: "TRY" };
  }

  const m = text.match(/(\d[\d.,\s]*)\s*(tl|try|lira|usd|eur|€|\$|dolar|euro)?/i);
  if (!m) return null;
  const amount = parseAmount(m[1]);
  const curRaw = (m[2] ?? "TRY").toUpperCase();
  let currency = "TRY";
  if (/usd|dolar|\$/.test(curRaw)) currency = "USD";
  else if (/eur|euro|€/.test(curRaw)) currency = "EUR";
  return { amount, currency };
}

function isVagueProblemStatement(text: string): boolean {
  const t = text.trim();
  if (t.length > 55) return false;
  return /sorun yaşad|sorun yasad|problem yaşad|problem yasad|sorun var|problem var/i.test(t);
}

function inferProblem(text: string, prev: ComplaintState): string | null {
  for (const { re, problem } of PROBLEM_PATTERNS) {
    if (re.test(text)) return problem;
  }
  if (isVagueProblemStatement(text)) return prev.problem;
  if (prev.problem) return prev.problem;
  if (text.length >= 28 && /sorun|mağdur|magdur|şikayet|sikayet|yaşadım|yasadim/.test(text)) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length <= 200 ? cleaned : cleaned.slice(0, 200);
  }
  return null;
}

function isCorrectionMessage(text: string): boolean {
  return /yanlış|yanlis|değil|degil|aslında|aslinda|pardon|düzelttim|duzelttim|yanlis söyledim|yanlış söyledim|yanlis soyledim|yanlış soyledim/i.test(
    text,
  );
}

function isGreetingOnly(text: string): boolean {
  return /^(merhaba|selam|hey|hi|hello|günaydın|gunaydin|iyi akşamlar|iyi aksamlar)[.!?\s]*$/i.test(text.trim());
}

function isSubstantiveMessage(text: string): boolean {
  const t = text.trim();
  if (t.length <= 3) return false;
  if (/^(merhaba|selam|hayır|hayir|evet|tamam|ok|olur)$/i.test(t)) return false;
  return true;
}

function uniqueAppend(list: string[], item: string): string[] {
  const trimmed = item.trim();
  if (!trimmed) return list;
  if (list.some((x) => normalize(x) === normalize(trimmed))) return list;
  return [...list, trimmed];
}

export function normalizeComplaintState(raw: Partial<ComplaintState> | null | undefined): ComplaintState {
  if (!raw) return { ...EMPTY_COMPLAINT_STATE };
  return {
    brandName: raw.brandName?.trim() || null,
    problem: raw.problem?.trim() || null,
    transactionType: raw.transactionType?.trim() || null,
    amount: raw.amount ?? null,
    currency: raw.currency?.trim()?.toUpperCase() || null,
    date: raw.date?.trim() || null,
    chronology: Array.isArray(raw.chronology) ? raw.chronology.map(String).filter(Boolean) : [],
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String).filter(Boolean) : [],
    desiredResolution: raw.desiredResolution?.trim() || null,
  };
}

/** Yeni bilgiler eski bilgilerin üzerine yazar; diziler birleştirilir. */
export function mergeComplaintState(prev: ComplaintState, updates: Partial<ComplaintState>): ComplaintState {
  const next = normalizeComplaintState(prev);
  const patch = normalizeComplaintState(updates);

  if (patch.brandName !== null) next.brandName = patch.brandName;
  if (patch.problem !== null) next.problem = patch.problem;
  if (patch.transactionType !== null) next.transactionType = patch.transactionType;
  if (patch.amount !== null) next.amount = patch.amount;
  if (patch.currency !== null) next.currency = patch.currency;
  if (patch.date !== null) next.date = patch.date;
  if (patch.desiredResolution !== null) next.desiredResolution = patch.desiredResolution;

  if (updates.chronology?.length) {
    for (const item of updates.chronology) {
      next.chronology = uniqueAppend(next.chronology, item);
    }
  }
  if (updates.evidence?.length) {
    for (const item of updates.evidence) {
      next.evidence = uniqueAppend(next.evidence, item);
    }
  }

  return next;
}

/** Kullanıcı mesajından çıkarılabilecek bilgileri döner (varsayım yapmaz). */
export function extractStateFromMessage(
  message: string,
  prev: ComplaintState,
  brands: BrandHint[],
): Partial<ComplaintState> {
  const text = message.trim();
  if (!text) return {};

  const updates: Partial<ComplaintState> = {};
  const lower = text.toLowerCase();

  const brandHit = matchBrand(text, brands);
  if (brandHit && (isCorrectionMessage(text) || !prev.brandName || normalize(text).includes(normalize(brandHit)))) {
    updates.brandName = brandHit;
  }

  for (const { re, type } of TX_PATTERNS) {
    if (re.test(text)) {
      updates.transactionType = type;
      break;
    }
  }

  const amountHit = extractAmountAndCurrency(text);
  if (amountHit) {
    updates.amount = amountHit.amount;
    updates.currency = amountHit.currency;
  }

  const dateHit = extractDate(text);
  if (dateHit) updates.date = dateHit;
  else if (text.length <= 40 && /^(dün|dun|bugün|bugun)$/i.test(text)) updates.date = text.toLowerCase();

  const problemHit = inferProblem(text, prev);
  if (problemHit) updates.problem = problemHit;

  const evidence: string[] = [];
  for (const { re, label } of EVIDENCE_PATTERNS) {
    if (re.test(text)) evidence.push(label);
  }
  if (evidence.length) updates.evidence = evidence;

  if (/istiyorum|talep ediyorum|talep ederim|iade|aktarılmasını|aktarilmasini|çözülmesini|cozulmesini|geri ödem/i.test(lower)) {
    updates.desiredResolution = text.length <= 220 ? text : text.slice(0, 220);
  }

  if (isSubstantiveMessage(text)) {
    updates.chronology = [text];
  }

  return updates;
}

export function buildBodyFromState(state: ComplaintState): string {
  const paragraphs: string[] = [];

  if (state.brandName) {
    paragraphs.push(`${state.brandName} platformunda yaşadığım sorun hakkında şikayetimi iletmek istiyorum.`);
  } else {
    paragraphs.push("Yaşadığım sorun hakkında şikayetimi iletmek istiyorum.");
  }

  if (state.chronology.length > 0) {
    paragraphs.push(state.chronology.join(" "));
  } else {
    const parts: string[] = [];
    if (state.date && state.brandName && state.amount != null && state.transactionType) {
      parts.push(
        `${state.date.charAt(0).toUpperCase() + state.date.slice(1)} ${state.brandName} üzerinde ${formatAmount(state.amount, state.currency)} tutarında ${state.transactionType} işlemi gerçekleştirdim.`,
      );
    } else if (state.brandName && state.transactionType) {
      parts.push(`${state.brandName} üzerinde ${state.transactionType} işlemi gerçekleştirdim.`);
    }
    if (state.problem) parts.push(state.problem.endsWith(".") ? state.problem : `${state.problem}.`);
    if (parts.length) paragraphs.push(parts.join(" "));
  }

  if (state.evidence.length) {
    paragraphs.push(`İlgili kanıtlarım: ${state.evidence.join(", ")}.`);
  }

  if (state.desiredResolution) {
    paragraphs.push(
      state.desiredResolution.endsWith(".") ? state.desiredResolution : `${state.desiredResolution}.`,
    );
  } else if (state.problem) {
    paragraphs.push("İşlemle ilgili yaşadığım sorunun çözülmesini talep ediyorum.");
  }

  return paragraphs.join("\n\n").trim();
}

export function buildTitleFromState(state: ComplaintState, body: string): string {
  if (state.brandName && state.problem) {
    const short = state.problem.length > 80 ? `${state.problem.slice(0, 77)}…` : state.problem;
    return `${state.brandName} — ${short}`.slice(0, 200);
  }
  const first = body.split(/[.!?\n]/)[0]?.trim() ?? "";
  return first.length >= 6 ? first.slice(0, 200) : "";
}

function isAmountRelevant(state: ComplaintState): boolean {
  if (!state.transactionType) {
    if (!state.problem) return false;
    return /yatırım|yatirim|çekim|cekim|tutar|tl|para|ödeme|odeme|bonus/i.test(state.problem);
  }
  return ["yatırım", "çekim", "bonus", "bahis", "casino"].includes(state.transactionType);
}

export function getMissingFields(state: ComplaintState, body: string): string[] {
  const missing: string[] = [];
  if (!state.brandName) missing.push("brandName");
  if (!state.problem) missing.push("problem");
  if (!state.transactionType && state.problem && /yatırım|yatirim|çekim|cekim|bonus|bahis/i.test(state.problem)) {
    missing.push("transactionType");
  }
  if (isAmountRelevant(state) && state.amount == null) missing.push("amount");
  if (!state.date) missing.push("date");
  if (!state.desiredResolution && body.length < 120) missing.push("desiredResolution");
  if (state.evidence.length === 0 && body.length < 100) missing.push("evidence");
  return missing;
}

export function isStateCompleteEnough(state: ComplaintState, body: string): boolean {
  if (!state.brandName || !state.problem) return false;
  if (body.length >= 100) return true;
  if (
    state.brandName &&
    state.problem &&
    state.transactionType &&
    state.amount != null &&
    state.date
  ) {
    return true;
  }
  return false;
}

/** En fazla bir soru; state'te bilinen alanları asla sormaz. */
export function getNextQuestion(state: ComplaintState, body: string): string | null {
  if (isStateCompleteEnough(state, body)) return null;

  if (!state.brandName) {
    return "Anladım. Hangi site veya markayla sorun yaşadınız?";
  }

  if (!state.problem) {
    return `Anladım. ${state.brandName}'de tam olarak ne sorun yaşadığınızı kısaca anlatır mısınız?`;
  }

  if (isAmountRelevant(state) && state.amount == null) {
    return "Etkilenen tutar yaklaşık ne kadar?";
  }

  if (!state.date) {
    return "Bu işlem yaklaşık ne zaman gerçekleşti?";
  }

  if (body.length < 80) {
    return "Sorunun nasıl geliştiğini bir cümle daha anlatır mısınız?";
  }

  return null;
}

export function computeReadyToContinue(state: ComplaintState, body: string): boolean {
  if (!state.brandName || !state.problem) return false;
  if (body.length < 100) return false;
  if (!state.problem.trim()) return false;
  if (isAmountRelevant(state) && state.amount == null && body.length < 140) return false;
  return isStateCompleteEnough(state, body) || body.length >= 100;
}

export function computeDraftQuality(
  state: ComplaintState,
  body: string,
): "draft" | "good" | "excellent" {
  if (!state.brandName || !state.problem) return "draft";
  if (body.length >= 140 && state.brandName && state.problem && (!isAmountRelevant(state) || state.amount != null)) {
    return "excellent";
  }
  if (body.length >= 70 && state.brandName && state.problem) return "good";
  return "draft";
}

const ASK_PATTERNS: { field: keyof ComplaintState; patterns: RegExp[] }[] = [
  {
    field: "brandName",
    patterns: [/hangi site/i, /hangi marka/i, /hangi bahis/i, /hangi casino/i, /site.*olduğunu/i],
  },
  {
    field: "problem",
    patterns: [/ne sorun/i, /sorun.*nedir/i, /sorunun ne/i, /neler yaşad/i, /neler yasad/i, /anlatır mısınız/i],
  },
  {
    field: "amount",
    patterns: [/ne kadar/i, /tutar/i, /kaç tl/i, /kac tl/i],
  },
  {
    field: "date",
    patterns: [/ne zaman/i, /hangi tarih/i, /yaklaşık ne zaman/i, /yaklasik ne zaman/i],
  },
];

/** Model state'te bilinen bir alanı tekrar soruyorsa true. */
export function replyAsksKnownField(reply: string, state: ComplaintState): boolean {
  const r = reply.toLowerCase();
  for (const { field, patterns } of ASK_PATTERNS) {
    const val = state[field];
    const known =
      field === "amount"
        ? val != null
        : field === "chronology" || field === "evidence"
          ? Array.isArray(val) && val.length > 0
          : Boolean(val);
    if (!known) continue;
    if (patterns.some((p) => p.test(r))) return true;
  }
  return false;
}

export function processIntakeMessage(input: {
  message: string;
  complaintState: ComplaintState;
  brands: BrandHint[];
}): ComplaintState {
  const prev = normalizeComplaintState(input.complaintState);
  const extracted = extractStateFromMessage(input.message, prev, input.brands);
  return mergeComplaintState(prev, extracted);
}

export function buildIntakeReply(
  state: ComplaintState,
  body: string,
  message: string,
): string {
  if (isGreetingOnly(message)) {
    return "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın.";
  }

  const question = getNextQuestion(state, body);
  if (question) return question;

  if (body.length >= 80) {
    return "Teşekkürler. Anlattıklarınızı not aldım; metni hazırladım. Başka eklemek istediğiniz bir detay var mı?";
  }

  return "Anlattıklarınızı not aldım. Biraz daha detay verirseniz metni güçlendirebilirim.";
}
