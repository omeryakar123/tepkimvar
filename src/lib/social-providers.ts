/** Sunucu tarafı OAuth sağlayıcı yapılandırması (Better Auth). */

import { resolveAuthBaseUrl } from "@/lib/auth-urls";

type SocialProviderConfig = Record<string, { clientId: string; clientSecret: string; [key: string]: unknown }>;

export const OAUTH_CALLBACK_PATHS = {
  google: "/api/auth/callback/google",
  facebook: "/api/auth/callback/facebook",
  apple: "/api/auth/callback/apple",
} as const;

function oauthRedirectUri(path: string): string {
  return `${resolveAuthBaseUrl()}${path}`;
}

export function buildSocialProviders(): SocialProviderConfig | undefined {
  const providers: SocialProviderConfig = {};

  if (process.env.GOOGLE_CLIENT_ID?.trim()) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
      prompt: "select_account",
      redirectURI: oauthRedirectUri(OAUTH_CALLBACK_PATHS.google),
    };
  }

  if (process.env.FACEBOOK_CLIENT_ID?.trim()) {
    providers.facebook = {
      clientId: process.env.FACEBOOK_CLIENT_ID.trim(),
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET?.trim() || "",
      scopes: ["email", "public_profile"],
      redirectURI: oauthRedirectUri(OAUTH_CALLBACK_PATHS.facebook),
    };
  }

  if (process.env.APPLE_CLIENT_ID?.trim() && process.env.APPLE_CLIENT_SECRET?.trim()) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID.trim(),
      clientSecret: process.env.APPLE_CLIENT_SECRET.trim(),
      redirectURI: oauthRedirectUri(OAUTH_CALLBACK_PATHS.apple),
      ...(process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim()
        ? { appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER.trim() }
        : {}),
    };
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

/** Google Cloud Console'a eklenecek redirect URI listesi (debug / dokümantasyon). */
export function listOAuthRedirectUris(): Record<string, string> {
  const base = resolveAuthBaseUrl();
  return {
    google: `${base}${OAUTH_CALLBACK_PATHS.google}`,
    facebook: `${base}${OAUTH_CALLBACK_PATHS.facebook}`,
    apple: `${base}/api/auth/callback/apple`,
  };
}
