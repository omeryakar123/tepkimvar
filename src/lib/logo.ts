// Brand logo helper — uploaded logo_url, domain favicon, Logo.dev / unavatar fallback.
import { proxyImage } from "./img";

const LOGO_DEV_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY as string | undefined;

/** Bilinen slug → doğrudan favicon domain eşlemesi (casino / bahis markaları). */
const SLUG_DOMAIN_OVERRIDES: Record<string, string> = {
  "betwoon": "betwoon.com",
  "betwoon-casino": "betwoon.com",
  "casibom": "casibom.com",
  "jojobet": "jojobet.com",
  "holiganbet": "holiganbet.com",
  "meritking": "meritking.com",
  "grandpashabet": "grandpashabet.com",
  "bets10": "bets10.com",
  "mobilbahis": "mobilbahis.com",
  "tipobet": "tipobet.com",
  "betmatik": "betmatik.com",
  "betpas": "betpas.com",
  "betist": "betist.com",
  "betgaranti": "betgaranti.com",
  "cratosslot": "cratosslot.com",
  "onwin": "onwin.com",
  "marsbahis": "marsbahis.com",
  "betebet": "betebet.com",
  "superbetin": "superbetin.com",
  "youwin": "youwin.com",
  "kazansana": "kazansana.com",
  "evetabi": "evetabi.com",
  "betnano": "betnano.com",
  "bovbet": "bovbet.com",
  "bahsine": "bahsine.com",
  "hadibet": "hadibet.com",
  "natobet": "natobet.com",
  "exobet": "exobet.com",
  "mexiwin": "mexiwin.com",
  "pulibet": "pulibet.com",
  "padisahbet": "padisahbet.com",
  "galabet": "galabet.com",
  "bahiscasino": "bahiscasino.com",
  "favoribahis": "favoribahis.com",
  "meritwin": "meritwin.com",
  "neredebahis": "neredebahis.com",
  "yasalbahis": "yasalbahis.com",
  "tekelbet": "tekelbet.com",
  "betmartin": "betmartin.com",
  "sanscasino": "sanscasino.com",
  "playbet": "playbet.io",
  "hizlicasino": "hizlicasino.com",
  "betsmove": "betsmove.com",
  "virusbet": "virusbet.com",
};

/** superbonus14.pro/sponsorlar listesindeki markalar */
const SUPERBONUS_SPONSOR_SLUGS = new Set([
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

function isLikelyBrokenLogo(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("placeholder") ||
    u.includes("via.placeholder") ||
    u.endsWith(".svg") ||
    u.includes("googleusercontent.com/a/default") ||
    u.includes("unavatar.io/fallback")
  );
}

function faviconUrl(domain: string, size = 128): string {
  const sz = Math.min(256, Math.max(32, size));
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;
}

function resolveDomain(opts: { slug?: string | null; website?: string | null }): string | null {
  const slug = opts.slug?.trim().toLowerCase();
  if (slug && SLUG_DOMAIN_OVERRIDES[slug]) return SLUG_DOMAIN_OVERRIDES[slug];
  const fromWeb = normalizeDomain(opts.website);
  if (fromWeb) return fromWeb;
  if (slug && slug.includes(".")) return normalizeDomain(slug);
  return null;
}

export function brandLogoUrl(opts: {
  logoUrl?: string | null;
  website?: string | null;
  slug?: string | null;
  size?: number;
}): string | null {
  const size = opts.size ?? 128;
  const dom = resolveDomain({ slug: opts.slug, website: opts.website });
  const gambling = GAMBLING_SLUG_RE.test(opts.slug ?? "") || GAMBLING_SLUG_RE.test(dom ?? "");

  if (opts.logoUrl) {
    const raw = opts.logoUrl.trim();
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("http") && !isLikelyBrokenLogo(raw)) {
      const proxied = proxyImage(raw);
      if (!gambling || !isLikelyBrokenLogo(proxied ?? raw)) return proxied ?? raw;
    }
  }

  if (dom) {
    if (gambling || !opts.logoUrl) {
      const slug = opts.slug?.trim().toLowerCase();
      if (slug && SUPERBONUS_SPONSOR_SLUGS.has(slug)) return superbonusLogoUrl(slug);
      return faviconUrl(dom, size);
    }
    if (LOGO_DEV_KEY) {
      return `https://img.logo.dev/${dom}?token=${LOGO_DEV_KEY}&size=${size}&format=png&fallback=monogram`;
    }
    return faviconUrl(dom, size);
  }

  return null;
}
