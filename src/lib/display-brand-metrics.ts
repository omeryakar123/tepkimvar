/** Firma profilinde boş/0 aggregate değerler için tutarlı gösterim. */

export function displayResolutionRate(
  _slug: string,
  stored: number | null | undefined,
  totalComplaints?: number | null,
  resolvedComplaints?: number | null,
): number | null {
  const total = totalComplaints ?? 0;
  if (total <= 0) return null;

  const rate = stored ?? 0;
  if (rate > 0) return Math.min(99, Math.round(rate));

  const resolved = resolvedComplaints ?? 0;
  if (resolved > 0) return Math.min(99, Math.round((resolved / total) * 100));

  return 0;
}

export function displayResponseMinutes(
  _slug: string,
  stored: number | null | undefined,
  totalComplaints?: number | null,
): number | null {
  if ((totalComplaints ?? 0) <= 0) return null;
  const mins = stored ?? 0;
  return mins > 0 ? mins : null;
}

/** Şikayeti olmayan markada çözüm oranı gösterilmez. */
export function formatResolutionRate(
  rate: number | null | undefined,
  totalComplaints?: number | null,
): string {
  if (!totalComplaints || totalComplaints <= 0) return "—";
  if (rate == null || rate < 0) return "—";
  return `%${Math.min(99, Math.round(rate))}`;
}
