import { createFileRoute, Outlet, Link, useNavigate, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Building2, MessageSquare, Users, FileText, ImageIcon, Layers, Settings, LogOut, ShieldCheck, ShieldAlert, BadgeCheck, AlertTriangle, Crown, Tags } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { fetchMe } from "@/lib/me";

export const Route = createFileRoute("/admin")({
  // NOT: Bu guard yalnızca UX içindir (boş panel iskeletini göstermemek için).
  // Gerçek yetkilendirme her /api/admin/* ucunda requireStaff ile yapılır.
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

function AdminLayout() {
  const { user, roles, signOut, loading } = useAuth();
  const navigate = useNavigate();
  // Router konumu: SSR'da da doğru, gezinmede tepki verir.
  const path = useLocation({ select: (l) => l.pathname });

  useEffect(() => {
    if (!loading && !user && path !== "/admin/login") navigate({ to: "/admin/login" });
  }, [loading, user, navigate, path]);

  if (path === "/admin/login") return <Outlet />;

  const isSuper = roles.includes("super_admin");

  return (
    <div className="min-h-screen bg-canvas flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-card border-r border-rule sticky top-0 h-screen">
        <Link to="/" className="flex items-center px-5 h-16 border-b border-rule">
          <span className="font-display font-black text-[18px] tracking-tight">itirazvar<span className="text-brand">.</span></span>
          <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-ink text-paper dark:bg-surface dark:text-ink px-1.5 py-0.5 rounded">Admin</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1 text-[13.5px]">
          <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" exact />
          <NavItem to="/admin/firmalar" icon={Building2} label="Firmalar" />
          <NavItem to="/admin/kategoriler" icon={Tags} label="Kategoriler" />
          <NavItem to="/admin/sikayetler" icon={MessageSquare} label="Şikayetler" />
          <NavItem to="/admin/kullanicilar" icon={Users} label="Kullanıcılar" />
          <NavItem to="/admin/moderasyon" icon={ShieldAlert} label="Moderasyon" />
          <NavItem to="/admin/escalations" icon={AlertTriangle} label="Escalation" />
          <NavItem to="/admin/dogrulama" icon={BadgeCheck} label="Doğrulama" />
          <NavItem to="/admin/premium" icon={Crown} label="Premium" />
          <NavItem to="/admin/blog" icon={FileText} label="Blog" />
          <NavItem to="/admin/medya" icon={ImageIcon} label="Medya" />
          <NavItem to="/admin/cms" icon={Layers} label="CMS" />
          {isSuper && <NavItem to="/admin/ayarlar" icon={Settings} label="Sistem" />}
        </nav>
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
          <button onClick={async () => { await signOut(); navigate({ to: "/admin/login" }); }} className="mt-1 w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-navy hover:bg-surface">
            <LogOut className="size-4" /> Çıkış
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      activeProps={{ className: "bg-brand-soft text-brand" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-navy hover:bg-surface transition"
    >
      <Icon className="size-4" />{label}
    </Link>
  );
}
