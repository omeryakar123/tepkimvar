import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { TawkChat } from "@/components/tawk-chat";

/**
 * Genel site düzeni (pathless layout).
 *
 * Navigasyon ve footer TEK yerde duruyor; alt sayfalar sadece kendi içeriğini
 * render eder. Önceden 21 sayfa SiteNav'ı ayrı ayrı import edip 26 kez
 * çiziyordu (profile.tsx üç kez) — her düzen değişikliği 21 dosyaya dokunmayı
 * gerektiriyordu.
 *
 * Not: /admin, /brand ve (auth) sayfaları bu düzenin DIŞINDA; kendi
 * kabuklarını kullanıyorlar.
 */
export const Route = createFileRoute("/_site")({
  component: SiteLayout,
});

function SiteLayout() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col overflow-x-hidden">
      <SiteNav />
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
      <TawkChat />
    </div>
  );
}
