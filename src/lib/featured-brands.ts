/** Listelerde en üste sabitlenen markalar (sıra önemli). */
export const PRIORITY_BRAND_SLUGS = [
  "jojobet", "matbet", "mavibet", "holiganbet", "kazansana", "bovbet", "bahsine", "evetabi",
  "hadibet", "vippark", "galabet", "padisahbet", "betpuan", "volacasino", "betmarino", "hilarionbet",
  "avrupabahis", "ultrabahis", "smartbahis", "bahispub", "bahisenin", "sezercasino", "sahabet", "onwin",
  "supertotobet", "kralbet", "betmatik", "betturkey", "otobet", "tipobet", "slotin", "solobet",
  "matadorbet", "bets10", "xslot", "fixbet", "birwin", "hilbet", "zbahis", "xbahis",
  "realbahis", "belugabahis", "nerobet", "imajbet", "goldenbet", "portobet", "piabella", "vizyonbet",
  "ajaxbet", "milanbahis", "hipodrombet", "paribahis", "hovarda", "bahisbey", "sekabet", "dumanbet",
  "olabahis", "maltcasino", "robobet", "asyabahis", "rekabet", "genzobet", "bettilt", "mostbet",
  "megapari", "melbet", "1xbet", "sportsbet", "bizbet", "gamdom", "perabet", "youwin",
  "fansport", "betwinner", "savoybetting", "rovbet", "bahigo", "ekolbet", "ikonbet", "bayconti",
  "stake", "safirbet", "betamiral", "exonbet", "grandpashabet", "slotday", "dedebet", "istanbulbahis",
  "taksimbet", "trendbet", "betixir", "capitolbet", "romabet", "slotbaba", "onlyspin", "biabet",
  "benjabet", "bullbahis", "esbahis", "bahisabi", "betcell", "cenabet", "bahiks", "neredebahis",
  "meritwin", "natobet", "betovis", "kalebet", "favoribahis", "yasalbahis", "tekelbet", "airbahis",
  "21-com", "beygirbet", "betci", "betbox", "hiltonbet", "alfabahis", "tulipbet", "casinoforbet",
  "gizabet", "titobet", "betmoney", "heybet", "otocasino", "gorabet", "elexbet", "casivera",
  "mojobet", "makrobet", "betifa", "zlot", "totemcasino", "levantacasino", "sans-casino", "baywin",
  "betnis", "nisbar", "betroz", "betine", "lord-palace-casino", "portbet", "playbet", "betgar",
  "betlivo", "betlike", "betticket", "bibahis", "betist", "betorspin", "billionbahis", "regnumcasino",
  "atmbahis", "devbahis", "pusulabet", "slotio", "egebet", "marsbahis", "betkanyon", "amgbahis",
  "mersobahis", "betjuve", "roysbet", "sefirbet", "vidobet", "betrupi", "rulobet", "yohohobet",
  "vikosslot", "cratosroyal", "superbet", "maxwin", "betasus", "betzula", "alobet", "privebet",
  "nesinecasino", "betparagon", "damabet", "betsin", "yedibahis", "ganobet", "epikbahis", "spinco",
  "radissonbet", "betwoon", "venombet", "netbahis", "palazzobet", "betgit", "altspin", "hasbet",
  "multiwin", "casibom", "casibow", "gettobet", "hepbet", "ramadabet", "celtabet", "klasbahis",
  "monobahis", "jestbahis", "pokerklas", "meritbet", "sloganbahis", "dodobet", "quatrobahis",
] as const;

export type PriorityBrandSlug = (typeof PRIORITY_BRAND_SLUGS)[number];

const FOOTER_LINK_SLUGS = [
  "jojobet", "matbet", "mavibet", "holiganbet", "kazansana", "bovbet", "bahsine", "evetabi", "hadibet"
] as const;

export const PRIORITY_BRAND_LABELS: Record<(typeof FOOTER_LINK_SLUGS)[number], string> = {
  jojobet: "Jojobet",
  matbet: "Matbet",
  mavibet: "Mavibet",
  holiganbet: "Holiganbet",
  kazansana: "Kazansana",
  bovbet: "Bovbet",
  bahsine: "Bahsine",
  evetabi: "Evetabi",
  hadibet: "Hadibet",
};

/** Popüler / footer linkleri için hazır liste. */
export const PRIORITY_BRAND_LINKS = FOOTER_LINK_SLUGS.map((slug) => ({
  slug,
  name: PRIORITY_BRAND_LABELS[slug],
}));
