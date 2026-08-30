/** Listelerde en üste sabitlenen markalar (sıra önemli). */
export const PRIORITY_BRAND_SLUGS = [
  "kazansana",
  "bovbet",
  "bahsine",
  "hadibet", // kullanıcı "handikap" — DB slug hadibet
  "evetabi",
] as const;

export type PriorityBrandSlug = (typeof PRIORITY_BRAND_SLUGS)[number];

export const PRIORITY_BRAND_LABELS: Record<PriorityBrandSlug, string> = {
  kazansana: "Kazansana",
  bovbet: "Bovbet",
  bahsine: "Bahsine",
  hadibet: "Hadibet",
  evetabi: "Evetabi",
};

/** Popüler / footer linkleri için hazır liste. */
export const PRIORITY_BRAND_LINKS = PRIORITY_BRAND_SLUGS.map((slug) => ({
  slug,
  name: PRIORITY_BRAND_LABELS[slug],
}));
