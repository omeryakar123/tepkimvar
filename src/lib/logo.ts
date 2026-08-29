// Brand logo helper — uses uploaded logo_url when present,
// falls back to Logo.dev CDN or unavatar.io when brand has a website domain.
import { proxyImage } from "./img";
const LOGO_DEV_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY as string | undefined;

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
  return u.includes("placeholder") || u.includes("via.placeholder") || u.endsWith(".svg");
}

export function brandLogoUrl(opts: {
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
}): string | null {
  const dom = normalizeDomain(opts.website);
  const size = opts.size ?? 128;

  if (opts.logoUrl) {
    const raw = opts.logoUrl.trim();
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("http")) {
      if (isLikelyBrokenLogo(raw)) {
        // Bozuk placeholder — domain fallback'e düş.
      } else {
        const proxied = proxyImage(raw);
        return proxied ?? raw;
      }
    }
  }

  if (dom) {
    if (LOGO_DEV_KEY) {
      return `https://img.logo.dev/${dom}?token=${LOGO_DEV_KEY}&size=${size}&format=png&fallback=monogram`;
    }
    return `https://unavatar.io/${dom}?fallback=false`;
  }

  return null;
}
