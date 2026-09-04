import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { USER_REQUESTED_BRANDS_MISSING } from "@/data/user-requested-brands-missing";
import { slugifyBrandName } from "@/lib/brand-slug";

/** Marka slug → gerçek domain (website + unavatar logo). */
const DOMAIN_OVERRIDES: Record<string, string> = {
  "6q-bet": "6qbet.com",
  "bc-game": "bc.game",
  "casino-metropol": "casinometropol.com",
  "cassino-bet-br": "cassino.bet.br",
  "discount-casino": "discountcasino.com",
  "ice-casino": "icecasino.com",
  "im-jbet": "imjbet.com",
  "istinye-casino": "istinyecasino.com",
  "nv-casino": "nvcasino.com",
  "william-hill": "williamhill.com",
  aztekbet: "aztekbet.com",
  bahiscom: "bahiscom.com",
  bahisfair: "bahisfair.com",
  bankobet: "bankobet.com",
  betano: "betano.com",
  betchip: "betchip.com",
  betelli: "betelli.com",
  betewin: "betewin.com",
  betfred: "betfred.com",
  betkom: "betkom.com",
  betlesene: "betlesene.com",
  betroad: "betroad.com",
  betsen: "betsen.com",
  betsin: "betsin.com",
  betsmith: "betsmith.com",
  betsolid: "betsolid.com",
  betvictor: "betvictor.com",
  betwinner: "betwinner.com",
  bycasino: "bycasino.com",
  casher: "casher.com",
  cryptobet: "cryptobet.com",
  davegas: "davegas.com",
  dedebet: "dedebet.com",
  dodobet: "dodobet.com",
  elitbahis: "elitbahis.com",
  elitwin: "elitwin.com",
  esascasino: "esascasino.com",
  fanatikbet: "fanatikbet.com",
  galyabet: "galyabet.com",
  gamdom: "gamdom.com",
  ggbet: "gg.bet",
  genzobet: "genzobet.com",
  gizabet: "gizabet.com",
  handikap: "handikap.com",
  havanabet: "havanabet.com",
  hepyek: "hepyek.com",
  herkulbet: "herkulbet.com",
  hitpot: "hitpot.com",
  hovarda: "hovarda.com",
  jestbahis: "jestbahis.com",
  jetbet: "jetbet.com",
  jokera: "jokera.com",
  kraliyetbet: "kraliyetbet.com",
  lidyabet: "lidyabet.com",
  ligobet: "ligobet.com",
  luluslot: "luluslot.com",
  metrobahis: "metrobahis.com",
  milyar: "milyar.com",
  milyonluk: "milyonluk.com",
  mislikazan: "mislikazan.com",
  monobahis: "monobahis.com",
  napoleon: "napoleongames.be",
  palazzobet: "palazzobet.com",
  parsbet: "parsbet.com",
  plump: "plump.com",
  primebahis: "primebahis.com",
  prizmabet: "prizmabet.com",
  privebet: "privebet.com",
  robinbet: "robinbet.com",
  safirbet: "safirbet.com",
  slotbon: "slotbon.com",
  soccer: "soccer.com",
  spino: "spino.com",
  stake: "stake.com",
  supertotobet: "supertotobet.com",
  talksport: "talksport.com",
  teslabahis: "teslabahis.com",
  thebet: "thebet.com",
  tipobet: "tipobet.com",
  vegasslot: "vegasslot.com",
  venombet: "venombet.com",
  venusbet: "venusbet.com",
  winnit: "winnit.com",
  yikimisi: "yikimisi.com",
  zbahis: "zbahis.com",
};

const NAME_OVERRIDES: Record<string, string> = {
  "im-jbet": "IM JBET",
  "bc-game": "BC.GAME",
  "cassino-bet-br": "CASSINO.BET.BR",
  ggbet: "GGBET",
  "nv-casino": "NV CASINO",
  "ice-casino": "ICE Casino",
  "6q-bet": "6Q Bet",
  "istinye-casino": "İstinye Casino",
  "discount-casino": "Discount Casino",
  "casino-metropol": "Casino Metropol",
  talksport: "talkSPORT",
  stake: "Stake",
  gamdom: "Gamdom",
};

function rnd(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function displayName(raw: string, slug: string) {
  return NAME_OVERRIDES[slug] ?? raw.trim();
}

function logoUrl(name: string, slug: string) {
  const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=1B263B&color=fff&bold=true&length=2`;
  return `https://unavatar.io/${dom}?fallback=${encodeURIComponent(fb)}`;
}

export type SeedUserRequestedBrandsResult = {
  listSize: number;
  added: number;
  skipped: number;
  addedNames: string[];
  skippedSlugs: string[];
};

/** DB'de slug varsa atlar; yoksa ekler. Script spawn gerektirmez. */
export async function seedUserRequestedBrands(): Promise<SeedUserRequestedBrandsResult> {
  const [cat] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.slug, "bilisim-teknoloji"))
    .limit(1);

  if (!cat) {
    throw new Error("Kategori bulunamadı: bilisim-teknoloji");
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of USER_REQUESTED_BRANDS_MISSING) {
    const slug = slugifyBrandName(raw);
    if (seen.has(slug)) continue;
    seen.add(slug);
    names.push(displayName(raw, slug));
  }

  let added = 0;
  let skipped = 0;
  const addedNames: string[] = [];
  const skippedSlugs: string[] = [];

  for (const name of names) {
    const slug = slugifyBrandName(name);
    const [exists] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.slug, slug))
      .limit(1);

    if (exists) {
      skipped++;
      skippedSlugs.push(slug);
      continue;
    }

    const dom = DOMAIN_OVERRIDES[slug] ?? `${slug.replace(/-/g, "")}.com`;
    const website = dom.startsWith("http") ? dom : `https://${dom}`;
    const total = rnd(20, 180);
    const resolvedPct = rnd(8, 35);
    const resolved = Math.round((total * resolvedPct) / 100);

    await db.insert(schema.brands).values({
      slug,
      name,
      categoryId: cat.id,
      website,
      city: "İstanbul",
      logoUrl: logoUrl(name, slug),
      verified: false,
      premium: false,
      rating: (rnd(18, 34) / 10).toFixed(2),
      ratingCount: rnd(8, 120),
      totalComplaints: total,
      complaintsResolved: resolved,
      resolutionRate: resolvedPct,
      avgResponseMinutes: rnd(90, 1800),
      isActive: true,
    });

    added++;
    addedNames.push(name);
  }

  return { listSize: names.length, added, skipped, addedNames, skippedSlugs };
}
