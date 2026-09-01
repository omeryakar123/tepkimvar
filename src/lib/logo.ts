// Brand logo — manuel override → sunucu çözümleyici → depolanmış URL.
import { proxyImage } from "./img";
import { isManualBrandLogoUrl } from "./brand-logo-manual";
import { MANUAL_BRAND_LOGOS } from "./manual-brand-logos";

/** Site olmayan veya favicon dışında kaynak gereken markalar */
export const SLUG_LOGO_OVERRIDES: Record<string, string> = { ...MANUAL_BRAND_LOGOS };

const BAD = [
  "ui-avatars.com",
  "unavatar.io",
  "placeholder",
  "via.placeholder",
  "logo.clearbit.com",
  "superbonus14.pro",
];

function isLikelyBrokenLogo(url: string): boolean {
  const u = url.toLowerCase();
  return (
    BAD.some((p) => u.includes(p)) ||
    u.endsWith(".svg") ||
    u.includes("google.com/s2/favicons") ||
    u.includes("gstatic.com/favicon") ||
    u.includes("duckduckgo.com/ip3")
  );
}

export type BrandLogoOpts = {
  logoUrl?: string | null;
  website?: string | null;
  slug?: string | null;
  size?: number;
};

export function logoFetchSize(displayPx: number): number {
  return Math.max(256, Math.ceil(displayPx * 2.5));
}

/** Yedek sıralı logo URL listesi — img onError ile sırayla denenebilir */
function isCustomUploadedLogo(url: string): boolean {
  return isManualBrandLogoUrl(url);
}

export function brandLogoCandidates(opts: BrandLogoOpts): string[] {
  const slugKey = opts.slug?.trim().toLowerCase() ?? "";
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  const raw = opts.logoUrl?.trim() ?? "";

  // Panelden yüklenen logo her zaman önce — otomatik çözümleyici override etmesin.
  if (raw && !isLikelyBrokenLogo(raw)) {
    if (raw.startsWith("/api/files/brand-logos/") || raw.startsWith("/brand-logos/")) {
      push(raw);
    } else if (raw.startsWith("/")) {
      push(raw);
    } else if (raw.startsWith("http")) {
      push(proxyImage(raw) ?? raw);
    }
  }

  if (slugKey && SLUG_LOGO_OVERRIDES[slugKey]) {
    push(SLUG_LOGO_OVERRIDES[slugKey]);
  }

  // Otomatik çözümleyici yalnızca özel logo yoksa — aksi halde DB'yi ezer.
  if (slugKey && !isCustomUploadedLogo(raw)) {
    push(`/api/brand-logo/${slugKey}`);
  }

  return out;
}

export { isCustomUploadedLogo, isManualBrandLogoUrl };

export function brandLogoUrl(opts: BrandLogoOpts): string | null {
  return brandLogoCandidates(opts)[0] ?? null;
}

export function isGamblingBrand(slug?: string | null, domain?: string | null): boolean {
  return /bet|bahis|casino|slot|poker|rulet|kumar|gambling/i.test(slug ?? "") || /bet|bahis|casino/i.test(domain ?? "");
}
