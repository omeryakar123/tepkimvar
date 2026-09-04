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

type BrandHint = { id: string; name: string; slug?: string };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, "");
}

function stripTurkishSuffix(token: string): string {
  return token.replace(/(?:[''']?(?:te|ta|de|da|den|dan|ten|tan|e|a|i|ı|u|ü))$/i, "");
}

function formatBrandToken(base: string): string {
  const lower = base.toLowerCase();
  if (lower.endsWith("bet")) {
    const stem = lower.slice(0, -3);
    if (!stem) return base;
    return `${stem.charAt(0).toUpperCase()}${stem.slice(1)}Bet`;
  }
  if (lower.endsWith("casino")) {
    const stem = lower.slice(0, -6);
    return `${stem.charAt(0).toUpperCase()}${stem.slice(1)}Casino`;
  }
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

function matchBrand(text: string, brands: BrandHint[]): string | null {
  const n = normalize(text);
  if (!n) return null;

  let best: string | null = null;
  let bestLen = 0;

  for (const b of brands) {
    const bn = normalize(b.name);
    const bs = b.slug ? normalize(b.slug) : bn;
    if (bn.length >= 3 && n.includes(bn) && bn.length > bestLen) {
      best = b.name;
      bestLen = bn.length;
    }
    if (bs.length >= 3 && bs !== bn && n.includes(bs) && bs.length > bestLen) {
      best = b.name;
      bestLen = bs.length;
    }
  }

  if (best) return best;

  for (const word of text.split(/\s+/)) {
    const raw = normalize(word);
    if (raw.length < 4) continue;
    const stripped = stripTurkishSuffix(raw);
    for (const b of brands) {
      const bn = normalize(b.name);
      const bs = b.slug ? normalize(b.slug) : bn;
      if (stripped === bn || stripped === bs || bn.startsWith(stripped) || stripped.startsWith(bn)) {
        if (bn.length > bestLen) {
          best = b.name;
          bestLen = bn.length;
        }
      }
    }
  }

  return best;
}

/** Marka listesi yoksa metinden tahmin (fixbette → FixBet). */
function extractBrandFallback(text: string): string | null {
  const patterns = [
    /\b([a-z0-9]{2,18}bet)(?:[''']?(?:te|ta|de|da|den|dan|ten|tan))?\b/i,
    /\b([a-z0-9]{2,18}casino)(?:[''']?(?:te|ta|de|da))?\b/i,
    /\b([a-z0-9]{2,24}(?:bet|casino))\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return formatBrandToken(m[1]);
  }
  return null;
}

function resolveBrandName(name: string, brands: BrandHint[]): string {
  const n = normalize(name);
  const hit = brands.find((b) => normalize(b.name) === n || (b.slug && normalize(b.slug) === n));
  return hit?.name ?? name;
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
  { re: /yatırım|yatirim|para yatır|para yatir|yatirdim|yatırdım|deposit/i, type: "yatırım" },
  { re: /çekim|cekim|para çek|para cek|withdraw/i, type: "çekim" },
  { re: /bonus|promosyon|freespin|free spin/i, type: "bonus" },
  { re: /bahis|kupon|iddaa/i, type: "bahis" },
  { re: /casino|slot|rulet|blackjack/i, type: "casino" },
  { re: /hesap|üyelik|uyelik|kapat|bloke|doğrulama|dogrulama|kimlik/i, type: "hesap" },
  { re: /teknik|site açılm|site acilm|bağlantı|baglanti|hata/i, type: "teknik sorun" },
];

const PROBLEM_PATTERNS: { re: RegExp; problem: string }[] = [
  { re: /yatırım yaptım.*(geçmedi|yansımadı|yansimadi|gelmedi)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /yatirim yaptim.*(geçmedi|yansımadı|yansimadi|gelmedi)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /yatırım.*(geçmedi|yansımadı|yansimadi|gelmedi)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /(geçmedi|yansımadı|yansimadi|gelmedi).*(yatırım|yatirim|hesab|para)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /hesab(a|ıma|ima)?\s*(geçmedi|yansımadı|yansimadi|gelmedi)/i, problem: "Yapılan yatırım hesaba yansımadı" },
  { re: /çekim.*(yapılmadı|yapilmadi|gelmedi|vermediler|ödenmedi|odenmedi)/i, problem: "Çekim talebi karşılanmadı" },
  { re: /(vermediler|ödemediler|odedemediler|paramı vermediler|parami vermediler)/i, problem: "Ödeme/çekim yapılmadı" },
  { re: /bonus.*(verilmedi|iptal|silindi)/i, problem: "Bonus hakkı tanınmadı veya iptal edildi" },
  { re: /hesab.*(kapand|kapatt|bloke|askıya|askiya)/i, problem: "Hesap erişimi kısıtlandı veya kapatıldı" },
  {
    re: /param(a|ı|i|ım|im)?\s*(çöktü|çöktüler|coktu|coktuler|çekti|cekti|çektiler|cektiler|bloke|kilitl)/i,
    problem: "Bakiyeme/parama el konuldu veya para çekildi",
  },
  {
    re: /para(mı|mi|m)?\s*(aldı|aldi|çekti|cekti|yok|kayboldu|gitti|vermediler)/i,
    problem: "Param alındı veya iade edilmedi",
  },
  {
    re: /(çöktü|çöktüler|coktu|coktuler|el koyd|bloke)/i,
    problem: "Bakiyeme el konuldu veya hesap bloke edildi",
  },
  {
    re: /canlı yardım|canli yardim|canli destek|canlı destek/i,
    problem: "Canlı yardım yanıt vermedi",
  },
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
  const swap = text.match(
    /(\d[\d.,\s]*)\s*(?:tl|try|lira)?\s*değil\s*(\d[\d.,\s]*)\s*(tl|try|lira)?/i,
  );
  if (swap) {
    return { amount: parseAmount(swap[2]), currency: "TRY" };
  }

  const hayir = text.match(/(?:hayır|hayir)\s*(\d[\d.,\s]*)\s*(tl|try|lira)?/i);
  if (hayir) {
    return { amount: parseAmount(hayir[1]), currency: "TRY" };
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
  const problems: string[] = [];

  for (const { re, problem } of PROBLEM_PATTERNS) {
    if (re.test(text)) problems.push(problem);
  }

  if (/canlı yardım|canli yardim|canli destek|canlı destek/i.test(text) &&
      /cevap vermiyor|yanıt alamad|yanit alamad|dönüş yok|donus yok/i.test(text)) {
    problems.push("Canlı yardım yanıt vermedi");
  }

  if (problems.length) {
    const unique = [...new Set(problems)];
    if (prev.problem && !unique.includes(prev.problem)) {
      return `${prev.problem}; ${unique.join("; ")}`;
    }
    return unique.join("; ");
  }

  if (isVagueProblemStatement(text)) return prev.problem;
  if (prev.problem) return prev.problem;
  if (text.length >= 22 && /sorun yaşıyorum|sorun yasiyorum|sorun yasıyorum/.test(text)) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (/parama|para |çöktü|coktu|çekti|cekti|bloke|geçmedi|yansımadı|yansimadi/.test(cleaned)) {
      return cleaned.length <= 200 ? cleaned : cleaned.slice(0, 200);
    }
  }
  if (text.length >= 28 && /sorun|mağdur|magdur|şikayet|sikayet|yaşadım|yasadim/.test(text)) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length <= 200 ? cleaned : cleaned.slice(0, 200);
  }
  return null;
}

function isCorrectionMessage(text: string): boolean {
  return /yanlış|yanlis|değil|degil|aslında|aslinda|pardon|düzelttim|duzelttim|yanlis söyledim|yanlış söyledim|yanlis soyledim|yanlış soyledim|^yok\b/i.test(
    text.toLowerCase(),
  );
}

function isGreetingOnly(text: string): boolean {
  return /^(merhaba|selam|hey|hi|hello|günaydın|gunaydin|iyi akşamlar|iyi aksamlar)[.!?\s]*$/i.test(text.trim());
}

export function isFrustratedRepeatMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(soyledim|söyledim|az önce|az once|yukarıda|yukarida|onu zaten|tekrar sorma|söylemiştim|soylemistim|yazdım|yazdim)/.test(t) ||
    /zaten söyledim|zaten soyledim|söylemiştim|soylemistim/.test(t);
}

function isSubstantiveMessage(text: string): boolean {
  const t = text.trim();
  if (t.length <= 3) return false;
  if (/^(merhaba|selam|hayır|hayir|evet|tamam|ok|olur)$/i.test(t)) return false;
  if (isFrustratedRepeatMessage(t)) return false;
  return true;
}

function uniqueAppend(list: string[], item: string): string[] {
  const trimmed = item.trim();
  if (!trimmed) return list;
  if (list.some((x) => normalize(x) === normalize(trimmed))) return list;
  return [...list, trimmed];
}

function buildChronologyEntries(text: string, state: Partial<ComplaintState>): string[] {
  const entries: string[] = [];
  const brand = state.brandName;
  const amount = state.amount;
  const currency = state.currency;
  const tx = state.transactionType;
  const date = state.date;

  if (brand && tx === "yatırım" && amount != null) {
    const when = date ? `${date.charAt(0).toUpperCase()}${date.slice(1)} ` : "";
    entries.push(`${when}${brand}'e ${formatAmount(amount, currency)} yatırım yaptım.`.trim());
  } else if (brand && tx) {
    entries.push(`${brand} üzerinde ${tx} işlemi gerçekleştirdim.`);
  }

  if (/hesab(a|ıma|ima)?\s*(geçmedi|yansımadı|yansimadi|gelmedi)/i.test(text)) {
    entries.push("Yatırım hesabıma yansımadı.");
  }
  if (/canlı yardım|canli yardim/i.test(text) && /cevap vermiyor|yanıt alamad|yanit alamad/i.test(text)) {
    entries.push("Canlı yardım yanıt vermedi.");
  }

  if (entries.length === 0 && isSubstantiveMessage(text)) entries.push(text);
  return entries;
}

export function normalizeComplaintState(raw: Partial<ComplaintState> | null | undefined): ComplaintState {
  if (!raw) return { ...EMPTY_COMPLAINT_STATE, chronology: [], evidence: [] };
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
  const brandFallback = brandHit ? null : extractBrandFallback(text);

  if (brandHit) {
    updates.brandName = brandHit;
  } else if (brandFallback) {
    updates.brandName = resolveBrandName(brandFallback, brands);
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
    const draft = mergeComplaintState(prev, updates);
    updates.chronology = buildChronologyEntries(text, draft);
  }

  return updates;
}

export function hasMinimumComplaintInfo(state: ComplaintState): boolean {
  return Boolean(state.brandName?.trim() && state.problem?.trim());
}

export function rebuildStateFromMessages(
  messages: { role: string; content: string }[],
  brands: BrandHint[],
): ComplaintState {
  let state = EMPTY_COMPLAINT_STATE;
  for (const m of messages) {
    if (m.role !== "user") continue;
    state = processIntakeMessage({ message: m.content, complaintState: state, brands });
  }
  return state;
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
    const short =
      state.amount != null
        ? `${formatAmount(state.amount, state.currency)} ${state.transactionType ?? "işlem"} — ${state.problem}`
        : state.problem;
    const clipped = short.length > 80 ? `${short.slice(0, 77)}…` : short;
    return `${state.brandName} — ${clipped}`.slice(0, 200);
  }
  const first = body.split(/[.!?\n]/)[0]?.trim() ?? "";
  return first.length >= 6 ? first.slice(0, 200) : "";
}

export function getMissingFields(state: ComplaintState): string[] {
  const missing: string[] = [];
  if (!state.brandName) missing.push("brandName");
  if (!state.problem) missing.push("problem");
  return missing;
}

export function getNextQuestion(state: ComplaintState): string | null {
  if (hasMinimumComplaintInfo(state)) return null;

  if (!state.brandName) {
    return "Anladım. Hangi site veya markayla sorun yaşadınız?";
  }

  if (!state.problem) {
    return `Anladım. ${state.brandName}'de tam olarak ne sorun yaşadığınızı kısaca anlatır mısınız?`;
  }

  return null;
}

export function computeReadyToContinue(state: ComplaintState, body: string): boolean {
  if (!hasMinimumComplaintInfo(state)) return false;
  return body.trim().length >= 60;
}

export function computeDraftQuality(
  state: ComplaintState,
  body: string,
): "draft" | "good" | "excellent" {
  if (!hasMinimumComplaintInfo(state)) return "draft";
  if (body.length >= 120 && state.amount != null) return "excellent";
  if (body.length >= 60) return "good";
  return "draft";
}

const ASK_PATTERNS: { field: keyof ComplaintState; patterns: RegExp[] }[] = [
  {
    field: "brandName",
    patterns: [/hangi site/i, /hangi marka/i, /hangi bahis/i, /hangi casino/i, /site.*olduğunu/i],
  },
  {
    field: "problem",
    patterns: [
      /ne sorun/i,
      /sorun.*nedir/i,
      /sorunun ne/i,
      /tam olarak ne sorun/i,
      /neler yaşad/i,
      /neler yasad/i,
      /kısaca anlatır mısınız/i,
      /kisaca anlatir misiniz/i,
    ],
  },
  {
    field: "amount",
    patterns: [/ne kadar/i, /kaç tl/i, /kac tl/i, /yatırım yaptınız/i, /yatirim yaptiniz/i],
  },
  {
    field: "date",
    patterns: [/ne zaman/i, /hangi tarih/i, /yaklaşık ne zaman/i, /yaklasik ne zaman/i],
  },
];

export function replyAsksKnownField(reply: string, state: ComplaintState): boolean {
  const r = reply.toLowerCase().trim();
  const looksLikeQuestion =
    r.includes("?") ||
    /^(anladım\.?\s*)?(hangi|ne sorun|ne kadar|ne zaman|kaç tl|kac tl|tam olarak ne)/.test(r);
  if (!looksLikeQuestion) return false;

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

export function buildAcknowledgmentReply(state: ComplaintState): string {
  const brand = state.brandName ?? "ilgili site";
  const parts: string[] = ["Anladım."];

  if (state.amount != null) {
    parts.push(
      `${brand}'te ${formatAmount(state.amount, state.currency)} tutarındaki ${state.transactionType ?? "işlem"}inizin`,
    );
  } else if (state.transactionType) {
    parts.push(`${brand}'te ${state.transactionType} işleminizin`);
  } else {
    parts.push(`${brand}'te belirttiğiniz sorunun`);
  }

  if (state.problem?.toLowerCase().includes("canlı yardım") || state.problem?.toLowerCase().includes("canli yardim")) {
    parts.push("hesabınıza yansımadığını ve canlı yardımdan yanıt alamadığınızı");
  } else if (state.problem?.toLowerCase().includes("yansımadı") || state.problem?.toLowerCase().includes("geçmedi")) {
    parts.push("hesabınıza yansımadığını");
  } else {
    parts.push("yaşandığını");
  }

  parts.push("belirtiyorsunuz. Bu bilgilerle şikayet taslağınızı hazırladım.");
  return parts.join(" ");
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
  message: string,
  opts?: { isFrustrated?: boolean },
): string {
  if (isGreetingOnly(message)) {
    return "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın.";
  }

  if (opts?.isFrustrated || isFrustratedRepeatMessage(message)) {
    if (hasMinimumComplaintInfo(state)) {
      return buildAcknowledgmentReply(state);
    }
  }

  const question = getNextQuestion(state);
  if (question) return question;

  if (hasMinimumComplaintInfo(state)) {
    return buildAcknowledgmentReply(state);
  }

  return "Anlattıklarınızı not aldım. Biraz daha detay verirseniz metni güçlendirebilirim.";
}

export function logComplaintDebug(label: string, data: Record<string, unknown>): void {
  const isDev =
    (typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) ||
    (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
  if (isDev) {
    console.info(`[COMPLAINT DEBUG] ${label}`, data);
  }
}
