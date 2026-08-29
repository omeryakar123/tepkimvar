/**
 * Auth / SEO URL çözümlemesi.
 * Coolify env eksik veya bozuk olsa bile (https//domain:3000) prod'da giriş çalışsın.
 */

/** Coolify bazen `https//domain:3000` gibi bozuk URL enjekte eder. */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  s = s.replace(/^https\/\//i, "https://").replace(/^http\/\//i, "http://");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    // Tarayıcı origin'i reverse proxy portu olmadan gelir.
    if (u.port === "3000" || u.port === "8080") u.port = "";
    return u.origin;
  } catch {
    return null;
  }
}

/** www ↔ apex varyantlarını trusted listesine ekler. */
export function expandTrustedOrigins(values: string[]): string[] {
  const out = new Set(values);
  for (const raw of values) {
    try {
      const u = new URL(raw);
      const host = u.hostname;
      const port = u.port ? `:${u.port}` : "";
      if (host.startsWith("www.")) {
        out.add(`${u.protocol}//${host.slice(4)}${port}`);
      } else {
        out.add(`${u.protocol}//www.${host}${port}`);
      }
    } catch {
      // Geçersiz URL — atla.
    }
  }
  return [...out];
}

const PROD_ORIGINS = ["https://tepkimvar.com", "https://www.tepkimvar.com"];

/** BetterAuth baseURL — cookie/redirect için public site adresi. */
export function resolveAuthBaseUrl(): string {
  for (const v of [
    process.env.BETTER_AUTH_URL,
    process.env.SITE_URL,
    process.env.COOLIFY_URL,
    process.env.COOLIFY_FQDN,
    process.env.DOMAIN,
  ]) {
    const o = normalizeSiteUrl(v);
    if (o) return o;
  }
  if (process.env.NODE_ENV === "production") return PROD_ORIGINS[0];
  return "http://localhost:8080";
}

/** BetterAuth trustedOrigins — giriş/kayıt origin doğrulaması. */
export function collectTrustedOrigins(): string[] {
  const raw = [
    process.env.TRUSTED_ORIGINS,
    process.env.BETTER_AUTH_URL,
    process.env.SITE_URL,
    process.env.VITE_SITE_URL,
    process.env.COOLIFY_URL,
    process.env.COOLIFY_FQDN,
    process.env.DOMAIN,
  ]
    .flatMap((v) => (v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = new Set<string>();
  for (const p of raw) {
    const o = normalizeSiteUrl(p);
    if (o) origins.add(o);
  }

  if (process.env.NODE_ENV === "production") {
    for (const o of PROD_ORIGINS) origins.add(o);
  }

  origins.add("http://localhost:8080");
  return expandTrustedOrigins([...origins]);
}
