/** Panelden / admin'den yüklenen özel marka logoları — otomatik scriptler bunlara dokunmamalı. */
export function isManualBrandLogoUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? "";
  if (!u) return false;
  if (u.startsWith("/brand-logos/") && !u.includes("/seed/")) return true;
  return u.startsWith("/api/files/brand-logos/") && !u.includes("/seed/");
}

/** Depolama anahtarından yükleme zaman damgasını çıkarır (brand-logos/{id}/{ts}-file.ext). */
export function timestampFromBrandLogoKey(key: string): number {
  const base = key.split("/").pop() ?? "";
  const m = /^(\d{10,})-/.exec(base);
  return m ? Number(m[1]) : 0;
}
