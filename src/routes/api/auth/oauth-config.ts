import { createFileRoute } from "@tanstack/react-router";
import { resolveAuthBaseUrl } from "@/lib/auth-urls";
import { listOAuthRedirectUris } from "@/lib/social-providers";

/** OAuth callback URL'lerini gösterir — Google Console ayarı için. Gizli bilgi içermez. */
export const Route = createFileRoute("/api/auth/oauth-config")({
  server: {
    handlers: {
      GET: () => {
        const baseURL = resolveAuthBaseUrl();
        const redirects = listOAuthRedirectUris();
        return Response.json({
          baseURL,
          redirects,
          googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
          hint:
            "Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs listesine yukarıdaki google URL'ini AYNEN ekleyin.",
        });
      },
    },
  },
});
