// Rewrite Supabase storage URLs (public/sign/authenticated) to our proxy route
// so private buckets are served through the app.
const ALLOWED = new Set(["avatars", "brand-logos", "brand-covers", "complaint-images", "blog-images", "banner-images", "brand-gallery"]);

export function proxyImage(url?: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith("http")) return url;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return url;
  const [, bucket, path] = m;
  if (!ALLOWED.has(bucket)) return url;
  return `/api/public/img/${bucket}/${path}`;
}
