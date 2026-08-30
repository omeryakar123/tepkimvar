import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PenLine, User, Menu, X, LogOut, LayoutDashboard, UserCircle2, Building2 } from "lucide-react";
import { useAuth, highestRoleRedirect } from "@/hooks/use-auth";
import { PRIORITY_BRAND_LINKS } from "@/lib/featured-brands";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

export function SiteNav() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const panelHref = highestRoleRedirect(roles);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate({ to: "/" });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  const navLinks = [
    { to: "/sikayetler" as const, label: "Şikayetler" },
    { to: "/markalar" as const, label: "Markalar" },
    { to: "/trendler" as const, label: "Trend 100" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="flex items-center shrink-0">
            <span className="font-display font-black text-[20px] sm:text-[22px] tracking-tight text-ink leading-none">
              tepkimvar<span className="text-brand">.</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-navy">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-brand transition-colors">
                {l.label}
                {l.to === "/trendler" && (
                  <span className="ml-1 inline-flex items-center justify-center text-[10px] font-bold bg-brand-soft text-brand rounded-full px-1.5 py-px">100</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex-1 flex justify-center min-w-0">
            <GlobalSearchTrigger className="hidden md:inline-flex items-center gap-2 rounded-full ring-1 ring-rule bg-card/70 backdrop-blur px-3 h-9 text-[13px] text-navy-mid hover:ring-brand/40 transition w-full max-w-xs" />
          </div>

          <NotificationBell />
          <ThemeToggle compact />

          {user ? (
            <div className="hidden sm:flex items-center gap-3">
              {panelHref !== "/" && (
                <Link to={panelHref} className="inline-flex items-center gap-2 text-[13px] font-medium text-navy hover:text-brand">
                  <LayoutDashboard className="size-4" /> Panel
                </Link>
              )}
              <Link to="/profile" className="inline-flex items-center gap-2 text-[13px] font-medium text-navy hover:text-brand">
                <UserCircle2 className="size-4" /> Profilim
              </Link>
              <button onClick={handleSignOut} className="inline-flex items-center gap-2 text-[13px] font-medium text-navy hover:text-ink">
                <LogOut className="size-4" /> Çıkış
              </button>
            </div>
          ) : (
            <Link to="/login" className="hidden sm:inline-flex items-center gap-2 text-[13px] font-medium text-navy hover:text-ink">
              <User className="size-4" /> Giriş / Üye Ol
            </Link>
          )}

          <Link to="/sikayet-yaz" className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-3 sm:px-5 h-9 sm:h-10 text-[12px] sm:text-[13px] font-semibold shadow-soft hover:brightness-105 active:brightness-95 transition shrink-0">
            <PenLine className="size-4" />
            <span className="hidden min-[400px]:inline">Şikayet Yaz</span>
            <span className="min-[400px]:hidden">Yaz</span>
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden grid place-items-center size-10 rounded-lg border border-rule shrink-0"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeMenu}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[min(100vw-3rem,320px)] bg-paper border-l border-rule shadow-lift lg:hidden flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-rule">
              <span className="font-display font-black text-lg text-ink">Menü</span>
              <button type="button" onClick={closeMenu} className="grid place-items-center size-9 rounded-lg hover:bg-surface">
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={closeMenu}
                  className="flex items-center h-11 px-3 rounded-lg text-[14px] font-medium text-ink hover:bg-surface"
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/sikayet-yaz" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-semibold text-brand hover:bg-brand-soft">
                <PenLine className="size-4" /> Şikayet Yaz
              </Link>
              <Link to="/register/marka-basvuru" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-navy hover:bg-surface">
                <Building2 className="size-4" /> Marka Başvurusu
              </Link>
              <Link to="/register/kurumsal" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-navy hover:bg-surface">
                <Building2 className="size-4" /> Kurumsal Kayıt
              </Link>
              <div className="pt-3 mt-3 border-t border-rule md:hidden">
                <GlobalSearchTrigger className="w-full inline-flex items-center gap-2 rounded-lg ring-1 ring-rule bg-card px-3 h-10 text-[13px] text-navy-mid" />
              </div>
            </nav>

            <div className="p-4 border-t border-rule space-y-1">
              {user ? (
                <>
                  {panelHref !== "/" && (
                    <Link to={panelHref} onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-ink hover:bg-surface">
                      <LayoutDashboard className="size-4" /> Panel
                    </Link>
                  )}
                  <Link to="/profile" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-ink hover:bg-surface">
                    <UserCircle2 className="size-4" /> Profilim
                  </Link>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-ink hover:bg-surface">
                    <LogOut className="size-4" /> Çıkış
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-medium text-ink hover:bg-surface">
                    <User className="size-4" /> Giriş Yap
                  </Link>
                  <Link to="/register" onClick={closeMenu} className="flex items-center gap-2 h-11 px-3 rounded-lg text-[14px] font-semibold text-brand hover:bg-brand-soft">
                    Üye Ol
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function SiteFooter() {
  const columns = [
    { t: "Şikayetler", l: [
      ["Son Şikayetler", "/sikayetler"],
      ["Trend Şikayetler", "/trendler"],
      ["Çözülen Şikayetler", "/sikayetler", { durum: "cozuldu" }],
      ["Anonim Şikayet", "/sikayet-yaz"],
      ["Yardım", "/yardim"],
      ["SSS", "/yardim"],
    ] },
    { t: "Markalar", l: [
      ["Tüm Markalar", "/markalar"],
      ["Doğrulanmış Markalar", "/markalar", { dogrulanmis: true }],
      ["Premium Markalar", "/markalar", { premium: true }],
      ["Marka Başvurusu", "/register/marka-basvuru"],
      ["Marka Yönetim", "/brand"],
    ] },
    { t: "Çok Aranan", l: PRIORITY_BRAND_LINKS.map((b) => [
      b.name,
      "/firma/$slug" as const,
      undefined,
      { slug: b.slug },
    ]) },
    { t: "Trend 100", l: [
      ["Genel", "/trend-100"],
      ["Bankacılık", "/trend-100", { kategori: "bankacilik" }],
      ["E-Ticaret", "/trend-100", { kategori: "e-ticaret" }],
      ["Telekom", "/trend-100", { kategori: "telekom" }],
      ["Kargo", "/trend-100", { kategori: "kargo" }],
      ["Ulaşım", "/trend-100", { kategori: "ulasim" }],
    ] },
    { t: "Konular", l: [
      ["Bankacılık", "/sikayetler", { kategori: "bankacilik" }],
      ["Sigorta", "/sikayetler", { kategori: "sigorta" }],
      ["Kripto", "/sikayetler", { kategori: "kripto" }],
      ["Kargo", "/sikayetler", { kategori: "kargo" }],
      ["Yemek", "/sikayetler", { kategori: "yemek" }],
      ["Telefon", "/sikayetler", { kategori: "telefon" }],
    ] },
  ] as const;
  const topLinks = [
    ["Hakkımızda", "/hakkimizda"],
    ["Markalar İçin", "/reklam-cozumleri"],
    ["Blog", "/blog"],
    ["Şeffaflık Raporu", "/seffaflik-raporu"],
    ["İletişim", "/iletisim"],
  ] as const;
  return (
    <footer className="mt-0 bg-ink text-paper/80 dark:bg-surface dark:text-navy border-t border-transparent dark:border-rule">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="font-display font-black text-[22px] tracking-tight text-paper dark:text-ink">
            tepkimvar<span className="text-brand">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-[13px]">
            {topLinks.map(([t, to]) => (
              <Link key={t} to={to} className="hover:text-paper dark:hover:text-ink">{t}</Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {columns.map((g) => (
            <div key={g.t}>
              <h4 className="text-paper dark:text-ink font-semibold text-[13px] mb-3">{g.t}</h4>
              <ul className="space-y-2 text-[12.5px]">
                {g.l.map(([label, to, search, params]) => (
                  <li key={label}>
                    <Link
                      to={to}
                      search={search as never}
                      params={params as never}
                      className="text-paper/60 dark:text-navy-mid hover:text-paper dark:hover:text-ink transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-paper/10 dark:border-rule flex flex-col md:flex-row gap-3 justify-between text-[12px] text-paper/60 dark:text-navy-mid">
          <span>© 2026 tepkimvar — Tüm hakları saklıdır</span>
          <div className="flex gap-6">
            <Link to="/kullanim-kosullari" className="hover:text-paper dark:hover:text-ink">Kullanım Koşulları</Link>
            <Link to="/gizlilik" className="hover:text-paper dark:hover:text-ink">Gizlilik</Link>
            <Link to="/kvkk" className="hover:text-paper dark:hover:text-ink">KVKK</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}