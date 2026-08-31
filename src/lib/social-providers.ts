/** Sunucu tarafı OAuth sağlayıcı yapılandırması (Better Auth). */

type SocialProviderConfig = Record<string, { clientId: string; clientSecret: string; [key: string]: unknown }>;

export function buildSocialProviders(): SocialProviderConfig | undefined {
  const providers: SocialProviderConfig = {};

  if (process.env.GOOGLE_CLIENT_ID?.trim()) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    };
  }

  if (process.env.FACEBOOK_CLIENT_ID?.trim()) {
    providers.facebook = {
      clientId: process.env.FACEBOOK_CLIENT_ID.trim(),
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET?.trim() || "",
      scopes: ["email", "public_profile"],
    };
  }

  if (process.env.APPLE_CLIENT_ID?.trim() && process.env.APPLE_CLIENT_SECRET?.trim()) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID.trim(),
      clientSecret: process.env.APPLE_CLIENT_SECRET.trim(),
      ...(process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim()
        ? { appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER.trim() }
        : {}),
    };
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

export const OAUTH_CALLBACK_PATHS = {
  google: "/api/auth/callback/google",
  facebook: "/api/auth/callback/facebook",
  apple: "/api/auth/callback/apple",
} as const;
