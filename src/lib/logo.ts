// Brand logo helper — uses uploaded logo_url when present,
// falls back to Logo.dev CDN when brand has a website domain.
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

export function brandLogoUrl(opts: {
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
}): string | null {
  if (opts.logoUrl) {
    if (opts.logoUrl.startsWith("http")) return proxyImage(opts.logoUrl);
    // MinIO'ya yüklenen logolar göreceli gelir (/api/files/brand-logos/...).
    if (opts.logoUrl.startsWith("/")) return opts.logoUrl;
  }
  const dom = normalizeDomain(opts.website);
  if (!dom || !LOGO_DEV_KEY) return null;
  const size = opts.size ?? 128;
  return `https://img.logo.dev/${dom}?token=${LOGO_DEV_KEY}&size=${size}&format=png&fallback=monogram`;
}
