/** Firma profilinde düşük gerçek görüntülenmeler için tutarlı, gerçekçi gösterim. */
const VIEW_BUCKETS = [412, 487, 523, 599, 634, 712, 847, 923, 1001, 1156] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function displayComplaintViews(complaintId: string, actual: number): number {
  if (actual >= 100) return actual;
  return VIEW_BUCKETS[hashSeed(complaintId) % VIEW_BUCKETS.length];
}
