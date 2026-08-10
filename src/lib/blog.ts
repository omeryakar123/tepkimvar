/** Blog veri katmanı — data.ts ile aynı SSR/URL çözümleme desenini kullanır. */

export type BlogListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  cover_url: string | null;
  published_at: string;
};

export type BlogPost = BlogListItem & {
  body: string;
  seo_title: string | null;
  seo_description: string | null;
};

function resolveUrl(url: string): string {
  if (typeof window !== "undefined") return url;
  const base =
    process.env.INTERNAL_API_URL ||
    process.env.SITE_URL ||
    `http://localhost:${process.env.PORT || "8080"}`;
  return new URL(url, base).toString();
}

export async function fetchBlogList(
  page = 1,
  pageSize = 12,
): Promise<{ items: BlogListItem[]; total: number }> {
  const res = await fetch(resolveUrl(`/api/blog?page=${page}&pageSize=${pageSize}`));
  if (!res.ok) throw new Error(`blog list -> ${res.status}`);
  return (await res.json()) as { items: BlogListItem[]; total: number };
}

export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch(resolveUrl(`/api/blog?slug=${encodeURIComponent(slug)}`));
  if (!res.ok) return null;
  return (await res.json()) as BlogPost;
}
