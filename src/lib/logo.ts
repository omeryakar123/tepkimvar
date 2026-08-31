// Brand logo helper — MinIO/direct PNG öncelikli; favicon proxy asla kullanılmaz.
import { proxyImage } from "./img";

const LOGO_DEV_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY as string | undefined;

/** Bilinen slug → doğrudan favicon domain eşlemesi (casino / bahis markaları). */
const SLUG_DOMAIN_OVERRIDES: Record<string, string> = {
  betwoon: "betwoon.com",
  "betwoon-casino": "betwoon.com",
  casibom: "casibom.com",
  jojobet: "jojobet.com",
  matbet: "matbet.com",
  mavibet: "mavibet.com",
  holiganbet: "holiganbet.com",
  meritking: "mrking.com",
  grandpashabet: "grandpashabet.com",
  bets10: "bets10.com",
  mobilbahis: "mobilbahis.com",
  tipobet: "tipobet.com",
  betmatik: "betmatik.com",
  betpas: "betpas.com",
  betist: "betist.com",
  betgaranti: "betgaranti.com",
  cratosslot: "cratosslot.com",
  onwin: "onwin.com",
  marsbahis: "marsbahis.com",
  betebet: "betebet.com",
  superbetin: "superbetin.com",
  youwin: "youwin.com",
  kazansana: "kazansana.com",
  evetabi: "evetabi.com",
  betnano: "betnano.com",
  bovbet: "bovbet.com",
  exobet: "exobet.org",
  etrobet: "etrobet.org",
  huhubeet: "huhubet.com",
  meritliman: "meritlimanbet.com",
  meybet: "meybetgir.com",
  mobiloyna: "mobiloynatr.com",
  tekelbet: "tekelbet.net",
  bahsine: "bahsine.com",
  hadibet: "hadibet.com",
  natobet: "natobet.com",
  mexiwin: "mexiwin.com",
  pulibet: "pulibet.com",
  padisahbet: "padisahbet.com",
  galabet: "galabet.com",
  bahiscasino: "bahiscasino.com",
  favoribahis: "favoribahis.com",
  meritwin: "meritwin.com",
  neredebahis: "neredebahis.com",
  yasalbahis: "yasalbahis.com",
  betmartin: "betmartin.com",
  sanscasino: "sanscasino.com",
  playbet: "playbet.io",
  hizlicasino: "hizlicasino.com",
  betsmove: "betsmove.com",
  virusbet: "virusbet.com",
  trendyol: "trendyol.com",
  hepsiburada: "hepsiburada.com",
  turkcell: "turkcell.com.tr",
  vodafone: "vodafone.com.tr",
  "turk-telekom": "turktelekom.com.tr",
  migros: "migros.com.tr",
  thy: "turkishairlines.com",
  arcelik: "arcelik.com.tr",
};

/** Site olmayan veya favicon dışında kaynak gereken markalar — yerel yüksek çözünürlük */
export const SLUG_LOGO_OVERRIDES: Record<string, string> = {};

/** superbonus14.pro/sponsorlar listesindeki markalar — yüksek çözünürlüklü PNG */
export const SUPERBONUS_SPONSOR_SLUGS = new Set([
  "kazansana", "evetabi", "betnano", "bovbet", "bahsine", "hadibet", "natobet", "exobet",
  "mexiwin", "pulibet", "padisahbet", "galabet", "bahiscasino", "favoribahis", "meritwin",
  "neredebahis", "yasalbahis", "tekelbet", "betmartin", "sanscasino", "marsbahis", "playbet",
  "hizlicasino", "betsmove", "virusbet",
]);

export const superbonusLogoUrl = (slug: string) =>
  `https://superbonus14.pro/clients/logo/${slug.replace(/copy$/i, "")}.png`;

const GAMBLING_SLUG_RE = /bet|bahis|casino|slot|poker|rulet|kumar|gambling/i;

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0];
  if (!s.includes(".")) return null;
  return s;
}

/** Düşük kaliteli / kırık / artık çalışmayan kaynaklar */
function isLikelyBrokenLogo(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("ui-avatars.com") ||
    u.includes("unavatar.io") ||
    u.includes("placeholder") ||
    u.includes("via.placeholder") ||
    u.includes("logo.clearbit.com") ||
    u.endsWith(".svg") ||
    u.includes("googleusercontent.com/a/default") ||
    u.includes("porkbun-logo") ||
    u.includes("superbonus14.pro")
  );
}

/** Google s2 / gstatic / duckduckgo — düşük çözünürlüklü favicon proxy */
function isFaviconProxy(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("google.com/s2/favicons") ||
    u.includes("gstatic.com/favicon") ||
    u.includes("duckduckgo.com/ip3")
  );
}

function isDirectImageUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  const path = url.toLowerCase().split("?")[0];
  return /\.(png|jpe?g|webp|gif|avif|ico)$/.test(path);
}

/** Eski UUID tabanlı yüklemeler sık 404 — önce domain yedeklerini dene */
function isUuidUploadLogo(url: string): boolean {
  return /^\/api\/files\/brand-logos\/[0-9a-f-]{36}\//i.test(url);
}

/** Eski migrate script'in yazdığı düşük çözünürlüklü MinIO favicon'ları */
function isLowResStoredLogo(url: string): boolean {
  if (!url.startsWith("/api/files/brand-logos/seed/")) return false;
  const u = url.toLowerCase();
  return !u.includes("-hq.png") && !u.includes("-superbonus.png") && !u.includes("-v2.png") && !u.includes("-tg.png");
}

function gstaticFavicon(domain: string, size = 256): string {
  const sz = Math.min(256, Math.max(64, size));
  const page = encodeURIComponent(`https://${domain}`);
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${page}&size=${sz}`;
}

function s2Favicon(domain: string, size = 256): string {
  const sz = Math.min(256, Math.max(64, size));
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;
}

function duckduckgoIcon(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

function resolveDomain(opts: { slug?: string | null; website?: string | null }): string | null {
  const slug = opts.slug?.trim().toLowerCase();
  if (slug && SLUG_DOMAIN_OVERRIDES[slug]) return SLUG_DOMAIN_OVERRIDES[slug];
  const fromWeb = normalizeDomain(opts.website);
  if (fromWeb) return fromWeb;
  if (slug && slug.includes(".")) return normalizeDomain(slug);
  return null;
}

export type BrandLogoOpts = {
  logoUrl?: string | null;
  website?: string | null;
  slug?: string | null;
  size?: number;
};

/** Retina ekranlar için minimum 256px kaynak iste */
export function logoFetchSize(displayPx: number): number {
  return Math.max(256, Math.ceil(displayPx * 2.5));
}

/** Yedek sıralı logo URL listesi — img onError ile sırayla denenebilir */
export function brandLogoCandidates(opts: BrandLogoOpts): string[] {
  const fetchSize = 256;
  const slugKey = opts.slug?.trim().toLowerCase() ?? "";
  const dom = resolveDomain({ slug: opts.slug, website: opts.website });
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  const raw = opts.logoUrl?.trim() ?? "";

  // Yerel / sabit logo (site yok veya düşük kaliteli favicon)
  if (slugKey && SLUG_LOGO_OVERRIDES[slugKey]) {
    push(SLUG_LOGO_OVERRIDES[slugKey]);
  }

  // MinIO yüksek çözünürlük veya doğrudan PNG/JPEG (düşük seed / UUID yüklemelerini atla)
  if (raw.startsWith("/") && !isLowResStoredLogo(raw) && !isLikelyBrokenLogo(raw) && !isUuidUploadLogo(raw)) {
    push(raw);
  } else if (
    raw.startsWith("http") &&
    isDirectImageUrl(raw) &&
    !isLikelyBrokenLogo(raw) &&
    !isFaviconProxy(raw)
  ) {
    push(proxyImage(raw) ?? raw);
  }

  // Domain tabanlı yedekler — superbonus kapalı olduğu için gstatic/site öncelikli
  if (dom) {
    push(gstaticFavicon(dom, fetchSize));
    push(duckduckgoIcon(dom));
    push(s2Favicon(dom, fetchSize));
    if (LOGO_DEV_KEY) {
      push(`https://img.logo.dev/${dom}?token=${LOGO_DEV_KEY}&size=${fetchSize}&format=png&fallback=monogram`);
    }
  }

  // superbonus14.pro çoğu markada 404 — en son yedek
  if (
    slugKey &&
    !SLUG_LOGO_OVERRIDES[slugKey] &&
    (SUPERBONUS_SPONSOR_SLUGS.has(slugKey) || isGamblingBrand(slugKey, dom))
  ) {
    push(superbonusLogoUrl(slugKey));
  }

  // UUID tabanlı eski yüklemeler (404 olabilir) — tüm yedeklerden sonra
  if (raw.startsWith("/") && isUuidUploadLogo(raw) && !isLikelyBrokenLogo(raw)) {
    push(raw);
  }

  return out;
}

export function brandLogoUrl(opts: BrandLogoOpts): string | null {
  return brandLogoCandidates(opts)[0] ?? null;
}

/** Gambling / bahis markası mı (superbonus önceliği için) */
export function isGamblingBrand(slug?: string | null, domain?: string | null): boolean {
  return GAMBLING_SLUG_RE.test(slug ?? "") || GAMBLING_SLUG_RE.test(domain ?? "");
}
