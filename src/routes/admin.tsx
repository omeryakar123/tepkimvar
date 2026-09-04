import { createFileRoute, Outlet, Link, useNavigate, redirect, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Building2, MessageSquare, Users, FileText, ImageIcon, Layers, Settings, LogOut, ShieldCheck, ShieldAlert, BadgeCheck, AlertTriangle, Crown, Tags, Bot, Menu, X, Sparkles } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { fetchMe } from "@/lib/me";
import { AdminModerationAlert } from "@/components/admin-moderation-alert";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return;
    const { user, roles } = await fetchMe();
    if (!user) throw redirect({ to: "/admin/login" });
    if (!roles.includes("admin" as AppRole) && !roles.includes("super_admin" as AppRole)) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/firmalar", icon: Building2, label: "Firmalar" },
  { to: "/admin/kategoriler", icon: Tags, label: "Kategoriler" },
  { to: "/admin/sikayetler", icon: MessageSquare, label: "Şikayetler" },
  { to: "/admin/sikayet-asistani", icon: Sparkles, label: "Şikayet Asistanı" },
  { to: "/admin/bot", icon: Bot, label: "Complaint Bot" },
  { to: "/admin/kullanicilar", icon: Users, label: "Kullanıcılar" },
  { to: "/admin/moderasyon", icon: ShieldAlert, label: "Moderasyon" },
  { to: "/admin/escalations", icon: AlertTriangle, label: "Escalation" },
  { to: "/admin/dogrulama", icon: BadgeCheck, label: "Doğrulama" },
  { to: "/admin/premium", icon: Crown, label: "Premium" },
  { to: "/admin/blog", icon: FileText, label: "Blog" },
  { to: "/admin/medya", icon: ImageIcon, label: "Medya" },
  { to: "/admin/cms", icon: Layers, label: "CMS" },
  { to: "/admin/ayarlar", icon: Settings, label: "Sistem", superOnly: true as boolean | undefined },
] as { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; superOnly?: boolean }[];

function AdminLayout() {
  const { user, roles, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && path !== "/admin/login") navigate({ to: "/admin/login" });
  }, [loading, user, navigate, path]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  if (path === "/admin/login") return <Outlet />;

  const isSuper = roles.includes("super_admin");

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row">
      {/* Mobil üst bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card border-b border-rule">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="size-10 grid place-items-center rounded-lg ring-1 ring-rule"
          aria-label="Menü"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link to="/" className="font-display font-black text-[17px] tracking-tight">
          tepkimvar<span className="text-brand">.</span>
        </Link>
        <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-ink text-paper px-1.5 py-0.5 rounded">Admin</span>
      </header>

      {/* Mobil menü */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-ink/40" onClick={() => setMenuOpen(false)}>
          <aside
            className="absolute left-0 top-14 bottom-0 w-[min(100%,280px)] bg-card border-r border-rule flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <AdminModerationAlert />
            <nav className="p-3 space-y-1 text-[13.5px] flex-1">
              {NAV.filter((n) => !n.superOnly || isSuper).map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
            </nav>
            <MobileUserFooter user={user} isSuper={isSuper} signOut={signOut} navigate={navigate} />
          </aside>
        </div>
      )}

      {/* Masaüstü sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-card border-r border-rule sticky top-0 h-screen">
        <Link to="/" className="flex items-center px-5 h-16 border-b border-rule">
          <span className="font-display font-black text-[18px] tracking-tight">tepkimvar<span className="text-brand">.</span></span>
          <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-ink text-paper dark:bg-surface dark:text-ink px-1.5 py-0.5 rounded">Admin</span>
        </Link>
        <AdminModerationAlert />
        <nav className="flex-1 p-3 space-y-1 text-[13.5px] overflow-y-auto">
          {NAV.filter((n) => !n.superOnly || isSuper).map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
        <MobileUserFooter user={user} isSuper={isSuper} signOut={signOut} navigate={navigate} />
      </aside>

      <main className="flex-1 min-w-0 pb-6 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
}

function MobileUserFooter({
  user, isSuper, signOut, navigate,
}: {
  user: { email?: string | null } | null;
  isSuper: boolean;
  signOut: () => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="border-t border-rule p-3">
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="grid place-items-center size-9 rounded-full bg-brand-soft text-brand text-sm font-bold">
          {user?.email?.[0]?.toUpperCase() ?? "A"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-ink truncate">{user?.email}</div>
          <div className="text-[11px] text-navy-mid flex items-center gap-1">
            <ShieldCheck className="size-3" />{isSuper ? "Super Admin" : "Admin"}
          </div>
        </div>
      </div>
      <button
        onClick={async () => { await signOut(); navigate({ to: "/admin/login" }); }}
        className="mt-1 w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-navy hover:bg-surface"
      >
        <LogOut className="size-4" /> Çıkış
      </button>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      activeProps={{ className: "bg-brand-soft text-brand" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-navy hover:bg-surface transition"
    >
      <Icon className="size-4 shrink-0" />{label}
    </Link>
  );
}
