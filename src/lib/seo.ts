/**
 * SEO yardımcıları — meta/OG/canonical/JSON-LD üretimi.
 * Domain'i Coolify'da SITE_URL (sunucu) / VITE_SITE_URL (client) ile ver.
 */
export const SITE_NAME = "itirazvar";
export const SITE_URL =
  (typeof process !== "undefined" ? process.env.SITE_URL : undefined) ||
  (import.meta.env?.VITE_SITE_URL as string | undefined) ||
  "https://itirazvarplus.com";

/** Sayfaya özel görsel verilmediğinde kullanılan varsayılan OG görseli. */
export const DEFAULT_OG_IMAGE = "/itiraz1.png";

export function absUrl(path: string): string {
  return `${SITE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Meta description için düz metne indir + kırp. */
export function clamp(text: string | null | undefined, max = 155): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

type SeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  publishedTime?: string | null;
};

/** TanStack `head()` için meta + canonical üretir. */
export function seoHead(input: SeoInput) {
  const url = absUrl(input.path);
  const rawImage = input.image ?? DEFAULT_OG_IMAGE;
  const image = rawImage ? (rawImage.startsWith("http") ? rawImage : absUrl(rawImage)) : null;

  const meta: Record<string, string>[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "tr_TR" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  if (input.publishedTime) {
    meta.push({ property: "article:published_time", content: input.publishedTime });
  }
  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** JSON-LD script nesnesi (TanStack `scripts` dizisine konur). */
export function jsonLd(data: Record<string, unknown>) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  });
}
