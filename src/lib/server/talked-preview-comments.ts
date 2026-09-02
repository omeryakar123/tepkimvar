import { pickTurkishDisplayName } from "@/lib/server/ai/prompts";

export type TalkedPreviewComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; username: string | null } | null;
};

type Topic =
  | "withdrawal"
  | "deposit"
  | "bonus"
  | "verification"
  | "support"
  | "account"
  | "technical"
  | "general";

/** Şikayet yayınlandıktan sonra yorumların görünme gecikmeleri (dakika). */
const REVEAL_BASE_MIN = [240, 1080, 4320] as const; // ~4 sa, ~18 sa, ~3 gün

const TEMPLATES: Record<Topic, string[]> = {
  withdrawal: [
    "Ben de {brand} tarafında çekim talebim günlerdir bekliyor; «{snippet}» konusunda aynı mağduriyeti yaşadım.",
    "Çekim onaylandı yazıyor ama param hâlâ hesaba geçmedi. Şikayetteki «{snippet}» ifadesi birebir tanıdık geldi.",
    "Destek her seferinde farklı gerekçe söylüyor; {detail} ile ilgili benzer bir süreçte takıldım.",
    "Küçük tutar değil — {detail} bekliyorum, {brand} tarafında aynı sorun devam ediyor.",
    "Banka ekstresinde işlem yok; sitede tamamlandı görünüyor. Bu şikayetle aynı tabloyu yaşıyorum.",
  ],
  deposit: [
    "Yatırımım hesaba geçmedi; «{snippet}» yazılmış, bende de aynı durum var.",
    "Ben de {brand} üzerinde yatırım sonrası bakiye güncellenmedi ({detail}).",
    "Ödeme sağlayıcı onayladı ama siteye düşmedi — bu başlık tam benim yaşadığım şey.",
    "Havaleyi doğru IBAN'a attım, sistem hâlâ işlem arıyor; {brand} için ben de bekliyorum.",
  ],
  bonus: [
    "Bonus şartları net değildi; «{snippet}» konusunda benzer promosyon sorunu yaşadım.",
    "Çevrim tamamlandı denmesine rağmen bonus silindi — {brand} tarafında aynısı oldu.",
    "Kampanya döneminde yaşanan {detail} mağduriyeti bende de var, takip ediyorum.",
  ],
  verification: [
    "Kimlik doğrulamam haftalardır bekliyor; «{snippet}» ifadesi benim sürecimle örtüşüyor.",
    "Evrakları tekrar tekrar istediler, onay bir türlü gelmiyor ({brand}).",
    "Hesap doğrulaması olmadan çekim yapılamıyor; aynı firmada takıldım.",
  ],
  support: [
    "Canlı destek saatlerce yanıt vermiyor; «{snippet}» konusunda ben de mağdurum.",
    "Her temsilci farklı bilgi veriyor — {brand} destek hattında aynı deneyim.",
    "Mail attım, günlerdir dönüş yok; bu şikayetle aynı tablodayım.",
  ],
  account: [
    "Hesabım sebepsiz kısıtlandı; «{snippet}» yazılmış, bende de benzer durum var.",
    "Giriş yapamıyorum, şifre sıfırlama maili gelmiyor ({brand}).",
    "Oturum düşüyor, bakiye farklı görünüyor — aynı şikayetten etkilendim.",
  ],
  technical: [
    "Oyun/bahis sırasında bağlantı koptu; «{snippet}» benzer bir teknik sorun.",
    "Mobil uygulama sürekli çöküyor, {brand} tarafında aynı problemi yaşıyorum.",
    "Kupon dondu, sonuç farklı işlendi — bu başlık tanıdık geldi.",
  ],
  general: [
    "Benzer bir mağduriyet yaşadım; «{snippet}» konusu {brand} için sık görülüyor gibi.",
    "Aynı firmada ben de sorun yaşadım, umarım çözülür.",
    "Bu konunun gündeme gelmesi iyi oldu — {detail} tarafında ben de etkilendim.",
    "Topluluk olarak şeffaf çözüm bekliyoruz; ben de yazacaktım.",
    "Aynı problem bende de var, süreci buradan takip edeceğim.",
  ],
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function detectTopic(title: string, body: string, scenario?: string | null): Topic {
  const scenarioMap: Record<string, Topic> = {
    withdrawal: "withdrawal",
    deposit: "deposit",
    bonus: "bonus",
    free_spin: "bonus",
    verification: "verification",
    customer_support: "support",
    account: "account",
    technical: "technical",
    casino_game: "technical",
    sports_betting: "technical",
    payment: "deposit",
  };
  if (scenario && scenario in scenarioMap) return scenarioMap[scenario];

  const t = `${title} ${body}`.toLocaleLowerCase("tr-TR");
  if (/çekim|para çek|withdraw|ödeme al|havale.*gelmedi/i.test(t)) return "withdrawal";
  if (/yatır|deposit|bakiye.*geç|havale.*att/i.test(t)) return "deposit";
  if (/bonus|free spin|çevrim|promosyon|kampanya/i.test(t)) return "bonus";
  if (/kimlik|doğrul|verification|evrak|selfie/i.test(t)) return "verification";
  if (/destek|canlı|yanıt|müşteri hizmet|cevap yok/i.test(t)) return "support";
  if (/hesap|giriş|askı|kısıt|ban/i.test(t)) return "account";
  if (/oyun|bahis|kupon|bağlant|uygulama|teknik/i.test(t)) return "technical";
  return "general";
}

function extractContext(title: string, body: string): { snippet: string; detail: string } {
  const combined = `${title}. ${body}`.replace(/\s+/g, " ").trim();
  const snippet =
    title.trim().slice(0, 72) + (title.length > 72 ? "…" : "") || combined.slice(0, 72);

  const amount = combined.match(/\d[\d.,]*\s*(?:tl|₺|lira|usd|usdt|dolar)/i)?.[0];
  if (amount) return { snippet, detail: amount.trim() };

  const method = combined.match(
    /(?:papara|payfix|havale|eft|fast|kripto|bitcoin|usdt|mefete|payco|credit)/i,
  )?.[0];
  if (method) return { snippet, detail: method.trim() };

  const days = combined.match(/\d+\s*(?:gün|saat|hafta)/i)?.[0];
  if (days) return { snippet, detail: days.trim() };

  return { snippet, detail: "işlem" };
}

function fillTemplate(
  template: string,
  brandName: string,
  ctx: { snippet: string; detail: string },
): string {
  return template
    .replace(/\{brand\}/g, brandName)
    .replace(/\{snippet\}/g, ctx.snippet)
    .replace(/\{detail\}/g, ctx.detail);
}

function revealDelayMs(complaintId: string, slot: number): number {
  const baseMin = REVEAL_BASE_MIN[slot] ?? REVEAL_BASE_MIN[REVEAL_BASE_MIN.length - 1];
  const h = hashSeed(`${complaintId}:reveal:${slot}`);
  const jitterMin = (h % 121) - 60;
  return Math.max(60, baseMin + jitterMin) * 60_000;
}

function pickBody(
  pool: string[],
  seed: number,
  slot: number,
  brandName: string,
  ctx: { snippet: string; detail: string },
  usedBodies: Set<string>,
): string {
  const start = (seed + slot * 17) % pool.length;
  for (let j = 0; j < pool.length; j++) {
    const candidate = fillTemplate(pool[(start + j) % pool.length], brandName, ctx);
    const key = candidate.toLowerCase();
    if (!usedBodies.has(key)) {
      usedBodies.add(key);
      return candidate;
    }
  }
  return fillTemplate(pool[(seed + slot) % pool.length], brandName, ctx);
}

/** Şikayet detayında kademeli görünen topluluk yorumları. */
export function generateScheduledPreviewComments(input: {
  complaintId: string;
  brandName: string;
  title: string;
  body: string;
  scenario?: string | null;
  complaintCreatedAt: Date | string;
  maxTotal?: number;
  avoidBodies?: string[];
  avoidNames?: string[];
  now?: Date;
}): TalkedPreviewComment[] {
  const maxTotal = Math.min(3, Math.max(0, input.maxTotal ?? 3));
  if (maxTotal === 0) return [];

  const created =
    input.complaintCreatedAt instanceof Date
      ? input.complaintCreatedAt
      : new Date(input.complaintCreatedAt);
  const now = input.now ?? new Date();
  const topic = detectTopic(input.title, input.body, input.scenario);
  const ctx = extractContext(input.title, input.body);
  const pool = [...TEMPLATES[topic], ...TEMPLATES.general];
  const seed = hashSeed(input.complaintId);
  const usedBodies = new Set((input.avoidBodies ?? []).map((b) => b.trim().toLowerCase()));
  const usedNames = new Set((input.avoidNames ?? []).map((n) => n.trim().toLowerCase()));
  const out: TalkedPreviewComment[] = [];
  const slotLimit = REVEAL_BASE_MIN.length;

  for (let slot = 0; slot < slotLimit; slot++) {
    if (out.length >= maxTotal) break;
    const revealAt = new Date(created.getTime() + revealDelayMs(input.complaintId, slot));
    if (now.getTime() < revealAt.getTime()) continue;

    const body = pickBody(pool, seed, slot, input.brandName, ctx, usedBodies);
    const avoid = [...usedNames];
    let name = pickTurkishDisplayName(avoid);
    for (let k = 0; k < 8 && usedNames.has(name.toLowerCase()); k++) {
      avoid.push(name);
      name = pickTurkishDisplayName(avoid);
    }
    usedNames.add(name.toLowerCase());

    const postJitterMin = (hashSeed(`${input.complaintId}:post:${slot}`) % 45) + 3;
    const postedAt = new Date(revealAt.getTime() + postJitterMin * 60_000);
    const createdAt =
      postedAt.getTime() > now.getTime()
        ? revealAt.toISOString()
        : postedAt.toISOString();

    out.push({
      id: `preview-${input.complaintId.slice(0, 8)}-${slot}`,
      body,
      created_at: createdAt,
      profiles: { full_name: name, username: null },
    });
  }

  return out;
}

/** Geriye dönük uyumluluk. */
export function generateTalkedPreviewComments(input: {
  complaintId: string;
  brandName: string;
  title: string;
  body: string;
  scenario?: string | null;
  count: number;
  avoidBodies?: string[];
  avoidNames?: string[];
}): TalkedPreviewComment[] {
  return generateScheduledPreviewComments({
    ...input,
    complaintCreatedAt: new Date(Date.now() - 7 * 24 * 60 * 60_000),
    maxTotal: input.count,
  });
}
