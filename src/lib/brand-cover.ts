/** Tüm marka profillerinde cover_url yoksa gösterilen varsayılan kapak */
export const DEFAULT_BRAND_COVER = "/brand-default-cover.jpg";

export function brandCoverUrl(coverUrl?: string | null): string {
  const url = coverUrl?.trim();
  return url || DEFAULT_BRAND_COVER;
}

export function hasCustomBrandCover(coverUrl?: string | null): boolean {
  return Boolean(coverUrl?.trim());
}
