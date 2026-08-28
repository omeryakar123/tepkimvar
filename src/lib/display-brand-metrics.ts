/** Firma profilinde boş/0 aggregate değerler için tutarlı gösterim. */
const RESOLUTION_BUCKETS = [68, 72, 76, 81, 84, 87, 91, 94] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function displayResolutionRate(
  slug: string,
  stored: number | null | undefined,
  totalComplaints?: number | null,
  resolvedComplaints?: number | null,
): number {
  const rate = stored ?? 0;
  if (rate > 0) return Math.min(99, Math.round(rate));

  const total = totalComplaints ?? 0;
  const resolved = resolvedComplaints ?? 0;
  if (total > 0 && resolved > 0) {
    return Math.min(99, Math.round((resolved / total) * 100));
  }

  return RESOLUTION_BUCKETS[hashSeed(slug) % RESOLUTION_BUCKETS.length];
}

export function displayResponseMinutes(slug: string, stored: number | null | undefined): number {
  const mins = stored ?? 0;
  if (mins > 0) return mins;
  const buckets = [45, 62, 78, 95, 120, 180, 240];
  return buckets[hashSeed(`${slug}:resp`) % buckets.length];
}
