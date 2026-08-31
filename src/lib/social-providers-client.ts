/** İstemcide hangi OAuth butonlarının gösterileceği (build-time VITE_*). */

export type OAuthProvider = "google" | "facebook" | "apple";

const truthy = (v: unknown) => v === "true" || v === "1";

export function enabledOAuthProviders(): OAuthProvider[] {
  const out: OAuthProvider[] = [];
  if (truthy(import.meta.env.VITE_OAUTH_GOOGLE) || truthy(import.meta.env.VITE_GOOGLE_ENABLED)) {
    out.push("google");
  }
  if (truthy(import.meta.env.VITE_OAUTH_FACEBOOK)) out.push("facebook");
  if (truthy(import.meta.env.VITE_OAUTH_APPLE)) out.push("apple");
  return out;
}
