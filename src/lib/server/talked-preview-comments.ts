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

const AGO_OFFSETS_MIN = [5, 12, 45, 120, 300, 1440, 2880, 5760] as const;

const TEMPLATES: Record<Topic, string[]> = {
  withdrawal: [
    "Ben de {brand} tarafında çekim talebim günlerdir bekliyor, aynı mağduriyeti yaşadım.",
    "Çekim onaylandı yazıyor ama param hâlâ hesaba geçmedi; benzer sorunu yaşıyorum.",
    "Destek her seferinde farklı bir gerekçe söylüyor, çözüm hâlâ yok.",
    "Küçük tutar değil, ciddi bir çekim bekliyorum — aynı firmada takıldım.",
    "Banka ekstresinde işlem yok, site tarafında ise tamamlandı görünüyor.",
    "Canlı destekten çıkış yapıp tekrar bağlanınca kayıt silinmiş gibi davrandılar.",
  ],
  deposit: [
    "Yatırımım hesaba geçmedi, dekontu göndermeme rağmen aynı cevabı alıyorum.",
    "Ben de {brand} üzerinde yatırım sonrası bakiye güncellenmedi.",
    "Ödeme sağlayıcı onayladı ama siteye düşmedi; benzer durumdayım.",
    "Kampanya döneminde yatırım yaptım, tutar yarım gün sonra göründü — stresli süreç.",
    "Havaleyi doğru IBAN'a attım, sistem hâlâ işlem arıyor.",
  ],
  bonus: [
    "Bonus şartları net değildi, ben de benzer bir promosyon sorunu yaşadım.",
    "Çevrim tamamlandı denmesine rağmen bonus silindi; aynı firmada oldu.",
    "Free spinler hesaba hiç yansımadı, destek konuyu farklı anlatıyor.",
    "Kampanya kodu geçersiz dediler ama duyuruda aktif görünüyordu.",
  ],
  verification: [
    "Kimlik doğrulamam haftalardır bekliyor, ben de aynı firmada takıldım.",
    "Evrakları tekrar tekrar istediler, onay bir türlü gelmiyor.",
    "Hesap doğrulaması olmadan çekim yapılamıyor; süreç çok uzadı.",
    "Selfie + kimlik gönderdim, sistem hâlâ incelemede diyor.",
  ],
  support: [
    "Canlı destek saatlerce yanıt vermiyor, benzer bir deneyim yaşadım.",
    "Her temsilci farklı bilgi veriyor; kayıt tutulmuyor gibi.",
    "Mail attım, 3 gündür dönüş yok — aynı firmada yaşadım.",
    "Telefon hattına bağlanamıyorum, sıra bir türlü gelmiyor.",
  ],
  account: [
    "Hesabım sebepsiz kısıtlandı, ben de aynı durumdayım.",
    "Giriş yapamıyorum, şifre sıfırlama maili gelmiyor.",
    "Oturum düşüyor, bakiye ekranda farklı görünüyor — benzer şikayet.",
    "Hesap askıya alındı denildi ama gerekçe yazılmadı.",
  ],
  technical: [
    "Oyun ortasında bağlantı koptu, kazanç kayboldu — bende de oldu.",
    "Mobil uygulama sürekli çöküyor, aynı sorunu yaşıyorum.",
    "Canlı bahis kuponu dondu, sonuç farklı işlendi.",
    "Site gece boyu açılmadı, maç kaçırdım.",
  ],
  general: [
    "Benzer bir mağduriyet yaşadım, umarım çözülür.",
    "Aynı firmada ben de sorun yaşadım; takip ediyorum.",
    "Bu konu gündeme gelmesi iyi oldu, ben de bekliyorum.",
    "Şeffaf çözüm bekliyoruz; ben de etkilendim.",
    "Topluluk olarak bu tür sorunların çözülmesi lazım.",
    "Ben de yazacaktım, aynı problem bende de var.",
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

function fillBrand(template: string, brandName: string): string {
  return template.replace(/\{brand\}/g, brandName);
}

/**
 * Çok Konuşulanlar kartları için konuya uygun, farklı kullanıcılardan
 * topluluk yorumları (gerçek yorum yoksa veya azsa tamamlanır).
 */
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
  const count = Math.min(3, Math.max(1, input.count));
  const topic = detectTopic(input.title, input.body, input.scenario);
  const pool = [...TEMPLATES[topic], ...TEMPLATES.general];
  const seed = hashSeed(input.complaintId);
  const usedBodies = new Set((input.avoidBodies ?? []).map((b) => b.trim().toLowerCase()));
  const usedNames = new Set((input.avoidNames ?? []).map((n) => n.trim().toLowerCase()));
  const out: TalkedPreviewComment[] = [];

  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 17) % pool.length;
    let body = "";
    for (let j = 0; j < pool.length; j++) {
      const candidate = fillBrand(pool[(idx + j) % pool.length], input.brandName);
      if (!usedBodies.has(candidate.toLowerCase())) {
        body = candidate;
        usedBodies.add(candidate.toLowerCase());
        break;
      }
    }
    if (!body) body = fillBrand(pool[(seed + i) % pool.length], input.brandName);

    const avoid = [...usedNames];
    let name = pickTurkishDisplayName(avoid);
    for (let k = 0; k < 8 && usedNames.has(name.toLowerCase()); k++) {
      avoid.push(name);
      name = pickTurkishDisplayName(avoid);
    }
    usedNames.add(name.toLowerCase());

    const agoMin = AGO_OFFSETS_MIN[(seed + i * 5) % AGO_OFFSETS_MIN.length];
    out.push({
      id: `preview-${input.complaintId.slice(0, 8)}-${i}`,
      body,
      created_at: new Date(Date.now() - agoMin * 60_000).toISOString(),
      profiles: { full_name: name, username: null },
    });
  }

  return out;
}
