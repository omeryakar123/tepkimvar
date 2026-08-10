import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Clock, CheckCircle2, Eye, Reply, Activity, TrendingUp, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { BrandMembership } from "@/routes/brand";

export const Route = createFileRoute("/brand/")({
  component: BrandDashboard,
});

type Stats = { today: number; pending: number; review: number; answered: number; resolved: number; resolutionRate: number; weekly?: { day: string; count: number }[] };

function BrandDashboard() {
  const { user } = useAuth();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const mres = await fetch("/api/brand/memberships", { credentials: "include" });
      const mj = mres.ok
        ? ((await mres.json()) as { memberships?: BrandMembership[] })
        : { memberships: [] };
      const id = mj.memberships?.[0]?.brand_id ?? null;
      if (cancelled) return;
      if (!id) {
        setS({ today: 0, pending: 0, review: 0, answered: 0, resolved: 0, resolutionRate: 0 });
        return;
      }
      setBrandId(id);

      const res = await fetch(`/api/brand/stats?brandId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const j = (await res.json()) as Stats;
      if (!cancelled) setS(j);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="px-6 lg:px-10 py-8 space-y-8">
      <div>
        <div className="eyebrow text-navy-mid">Brand Panel</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-[14px] text-navy-mid">{brandId ? "Firmanızın anlık metrikleri." : "Hesabınız henüz bir firmaya bağlı değil. Admin tarafından bağlanması gerekir."}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat icon={Clock} label="Bugün" v={s?.today} tone="brand" />
        <Stat icon={MessageSquare} label="Bekleyen" v={s?.pending} tone="warn" />
        <Stat icon={Eye} label="İncelenen" v={s?.review} tone="ink" />
        <Stat icon={Reply} label="Yanıtlanan" v={s?.answered} tone="ink" />
        <Stat icon={CheckCircle2} label="Çözülen" v={s?.resolved} tone="brand" />
        <Stat icon={TrendingUp} label="Çözüm Oranı" v={s?.resolutionRate} suffix="%" tone="brand" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl ring-1 ring-rule p-6">
          <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2"><Activity className="size-4 text-brand" /> Haftalık Yanıt Trafiği</h2>
          <div className="mt-6 h-40 grid grid-cols-7 items-end gap-3">
            {(() => {
              const w = s?.weekly ?? [];
              const max = Math.max(1, ...w.map((d) => d.count));
              return (w.length ? w : Array.from({ length: 7 }, () => ({ day: "", count: 0 }))).map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full rounded-md bg-brand-soft relative flex-1">
                    <div className="absolute inset-x-0 bottom-0 rounded-md bg-brand transition-all" style={{ height: `${Math.round((d.count / max) * 100)}%` }} title={`${d.count} şikayet`} />
                  </div>
                  <span className="text-[10px] text-navy-mid">{d.day}</span>
                </div>
              ));
            })()}
          </div>
        </div>
        {brandId ? <PremiumCard brandId={brandId} /> : <div className="bg-card rounded-2xl ring-1 ring-rule p-6" />}
      </div>
    </div>
  );
}

type PremiumInfo = {
  premium: boolean;
  tier: string;
  requests: { id: string; plan: string; status: string; created_at: string }[];
};

function PremiumCard({ brandId }: { brandId: string }) {
  const [info, setInfo] = useState<PremiumInfo | null>(null);
  const [plan, setPlan] = useState("pro");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/brand/premium?brandId=${encodeURIComponent(brandId)}`, { credentials: "include" });
    if (res.ok) setInfo((await res.json()) as PremiumInfo);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [brandId]);

  const pending = info?.requests.find((r) => r.status === "pending");

  async function apply() {
    setBusy(true);
    const res = await fetch("/api/brand/premium", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, plan }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Başvuru gönderilemedi");
      return;
    }
    toast.success("Başvurunuz alındı");
    load();
  }

  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
      <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
        <Crown className="size-4 text-warning" /> Premium
      </h2>

      {info?.premium ? (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand px-3 h-8 text-[13px] font-semibold">
            <CheckCircle2 className="size-4" /> Firmanız premium ({info.tier})
          </span>
          <p className="mt-3 text-[13px] text-navy-mid">Öne çıkan listeleme ve öncelikli destek aktif.</p>
        </div>
      ) : pending ? (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft text-warning px-3 h-8 text-[13px] font-semibold">
            <Clock className="size-4" /> Başvurunuz inceleniyor
          </span>
          <p className="mt-3 text-[13px] text-navy-mid">Plan: {pending.plan} · {new Date(pending.created_at).toLocaleDateString("tr-TR")}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-navy-mid">Öne çıkan listeleme, rozet ve öncelikli destek için premium'a geçin.</p>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card">
            <option value="pro">Pro</option>
            <option value="kurumsal">Kurumsal</option>
          </select>
          <button disabled={busy} onClick={apply} className="w-full h-10 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold disabled:opacity-60">
            Premium Başvurusu Yap
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, v, tone, suffix }: { icon: typeof MessageSquare; label: string; v: number | undefined; tone: "brand" | "ink" | "warn"; suffix?: string }) {
  const map = { brand: "bg-brand-soft text-brand", ink: "bg-surface text-ink", warn: "bg-warning-soft text-warning" } as const;
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
      <div className={`size-9 rounded-lg grid place-items-center ${map[tone]}`}><Icon className="size-4.5" /></div>
      <div className="mt-3 text-[12px] text-navy-mid font-medium">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-ink tabular-nums">
        {v === undefined ? "—" : `${v.toLocaleString("tr-TR")}${suffix ?? ""}`}
      </div>
    </div>
  );
}
