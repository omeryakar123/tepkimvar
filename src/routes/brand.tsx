import { createFileRoute, Outlet, Link, useNavigate, redirect, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, MessageSquare, Building2, LogOut, MessagesSquare, Menu, X } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { fetchMe } from "@/lib/me";

export const Route = createFileRoute("/brand")({
  // UX guard; gerçek yetki /api/brand/* uçlarında marka üyeliğiyle doğrulanır.
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/brand/login") return;
    const { user, roles } = await fetchMe();
    if (!user) throw redirect({ to: "/brand/login" });
    const ok = (["brand", "admin", "super_admin"] as AppRole[]).some((r) => roles.includes(r));
    if (!ok) throw redirect({ to: "/brand/login" });
  },
  component: BrandLayout,
});

export type BrandMembership = { brand_id: string; name: string; slug: string };

function BrandLayout() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  const [memberships, setMemberships] = useState<BrandMembership[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && path !== "/brand/login") navigate({ to: "/brand/login" });
  }, [loading, user, navigate, path]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/brand/memberships", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((j: { memberships?: BrandMembership[] }) => setMemberships(j.memberships ?? []))
      .catch(() => setMemberships([]));
  }, [user]);

  if (path === "/brand/login") return <Outlet />;

  const sidebar = (
    <>
      <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-rule" onClick={() => setMenuOpen(false)}>
        <img src="/site-logo.png" alt="tepkimvar" className="size-9 rounded-full object-cover shrink-0" />
        <span className="font-display font-black text-[18px] tracking-tight">tepkimvar<span className="text-brand">.</span></span>
        <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-brand text-brand-foreground px-1.5 py-0.5 rounded">Brand</span>
      </Link>
      <div className="px-5 py-3 border-b border-rule">
        <div className="text-[10px] uppercase tracking-wider text-navy-mid font-semibold">Firma</div>
        <div className="mt-1 text-[13.5px] font-semibold text-ink truncate">
          {memberships[0]?.name ?? "Bağlı firma yok"}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 text-[13.5px]">
        <NavItem to="/brand" icon={LayoutDashboard} label="Dashboard" exact onNavigate={() => setMenuOpen(false)} />
        <NavItem to="/brand/sikayetler" icon={MessageSquare} label="Şikayetler" onNavigate={() => setMenuOpen(false)} />
        <NavItem to="/brand/mesajlar" icon={MessagesSquare} label="Mesajlar" onNavigate={() => setMenuOpen(false)} />
        <NavItem to="/brand/profil" icon={Building2} label="Profil" onNavigate={() => setMenuOpen(false)} />
      </nav>
      <div className="border-t border-rule p-3">
        <button onClick={async () => { await signOut(); navigate({ to: "/brand/login" }); }} className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-navy hover:bg-surface">
          <LogOut className="size-4" /> Çıkış
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row">
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card border-b border-rule">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="size-10 grid place-items-center rounded-lg ring-1 ring-rule"
          aria-label="Menü"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link to="/brand" className="flex items-center gap-2 min-w-0">
          <img src="/site-logo.png" alt="" className="size-8 rounded-full object-cover shrink-0" />
          <span className="font-display font-black text-[16px] tracking-tight truncate">tepkimvar<span className="text-brand">.</span></span>
        </Link>
        <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-brand text-brand-foreground px-1.5 py-0.5 rounded shrink-0">Brand</span>
      </header>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-ink/40" onClick={() => setMenuOpen(false)}>
          <aside
            className="absolute left-0 top-14 bottom-0 w-[min(100%,280px)] bg-card border-r border-rule flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-card border-r border-rule sticky top-0 h-screen">
        {sidebar}
      </aside>
      <main className="flex-1 min-w-0"><Outlet /></main>
    </div>
  );
}

function NavItem({
  to, icon: Icon, label, exact, onNavigate,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeOptions={{ exact: !!exact }}
      activeProps={{ className: "bg-brand-soft text-brand" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-navy hover:bg-surface transition"
    >
      <Icon className="size-4" />{label}
    </Link>
  );
}
