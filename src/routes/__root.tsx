import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SITE_URL } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme";
import { AuthProvider } from "../hooks/use-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-dark">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-dark">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-navy-mid">
          Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:brightness-110"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-dark">Bu sayfa yüklenemedi</h1>
        <p className="mt-2 text-sm text-navy-mid">
          Bir şeyler ters gitti. Yenilemeyi veya ana sayfaya dönmeyi deneyebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:brightness-110"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-rule bg-card px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-surface"
          >
            Ana sayfa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "itirazvar.com — Sesinizi Duyurun, Çözümü Takip Edin" },
      {
        name: "description",
        content:
          "Türkiye'nin güvenilir şikayet ve çözüm platformu. Firmaları araştırın, sorunlarınızı paylaşın, çözüm süreçlerini takip edin.",
      },
      { name: "author", content: "itirazvar" },
      { property: "og:site_name", content: "itirazvar." },
      { property: "og:title", content: "itirazvar.com — Sesinizi Duyurun, Çözümü Takip Edin" },
      {
        property: "og:description",
        content:
          "Sesinizi duyurun, çözümü takip edin. Firmaların yanıtlarını ve çözüm oranlarını gerçek zamanlı görün.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "tr_TR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "itirazvar.com — Sesinizi Duyurun, Çözümü Takip Edin" },
      { name: "twitter:description", content: "Türkiye'nin güvenilir şikayet ve çözüm platformu." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "itirazvar.",
          url: SITE_URL,
          inLanguage: "tr-TR",
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/arama?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "itirazvar.",
          url: SITE_URL,
          description: "Türkiye'nin bağımsız müşteri deneyimi ve şikayet çözüm platformu.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* React'ten ÖNCE çalışır: koyu temada açılışta beyaz parlamayı önler. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Bildirimler seçili temaya uyar. */
function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster position="top-right" richColors theme={theme} />;
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <ThemedToaster />
    </AuthProvider>
  );
}
