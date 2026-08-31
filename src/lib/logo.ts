// Brand logo — manuel override → sunucu çözümleyici → depolanmış URL.
import { proxyImage } from "./img";
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

  if (slugKey && SLUG_LOGO_OVERRIDES[slugKey]) {
    push(SLUG_LOGO_OVERRIDES[slugKey]);
  }

  // Sunucu: Telegram → site ikonu → kalıcı depolama (self-heal)
  if (slugKey) {
    push(`/api/brand-logo/${slugKey}`);
  }

  // İyi depolanmış logo (MinIO / public)
  if (raw.startsWith("/") && !isLikelyBrokenLogo(raw)) {
    push(raw);
  } else if (raw.startsWith("http") && !isLikelyBrokenLogo(raw)) {
    push(proxyImage(raw) ?? raw);
  }

  return out;
}

export function brandLogoUrl(opts: BrandLogoOpts): string | null {
  return brandLogoCandidates(opts)[0] ?? null;
}

export function isGamblingBrand(slug?: string | null, domain?: string | null): boolean {
  return /bet|bahis|casino|slot|poker|rulet|kumar|gambling/i.test(slug ?? "") || /bet|bahis|casino/i.test(domain ?? "");
}
