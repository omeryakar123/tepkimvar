import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Users, MessageSquare, AlertOctagon, Crown, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { apiGet } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Stats = {
  brands: number; users: number; complaints: number; today: number;
  pending: number; spam: number; resolved: number; premium: number; verified: number;
};

function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const data = await apiGet<Stats>("/api/admin/stats");
      if (data) setS(data);
    })();
  }, []);

  return (
    <div className="px-6 lg:px-10 py-8 space-y-8">
      <div>
        <div className="eyebrow text-navy-mid">Genel Bakış</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Yönetim Paneli</h1>
        <p className="mt-1 text-[14px] text-navy-mid">Platformun anlık durumu — gerçek zamanlı veriler.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Stat icon={Building2} label="Toplam Firma" value={s?.brands} tone="brand" />
        <Stat icon={Users} label="Toplam Kullanıcı" value={s?.users} tone="ink" />
        <Stat icon={MessageSquare} label="Toplam Şikayet" value={s?.complaints} tone="ink" />
        <Stat icon={Clock} label="Bugünkü Şikayet" value={s?.today} tone="brand" />
        <Stat icon={AlertOctagon} label="Bekleyen Onay" value={s?.pending} tone="warn" />
        <Stat icon={AlertOctagon} label="Spam" value={s?.spam} tone="danger" />
        <Stat icon={CheckCircle2} label="Çözülen" value={s?.resolved} tone="brand" />
        <Stat icon={Crown} label="Premium Firma" value={s?.premium} tone="warn" />
        <Stat icon={ShieldCheck} label="Doğrulanmış Firma" value={s?.verified} tone="brand" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl ring-1 ring-rule p-6">
          <h2 className="font-display text-lg font-bold text-ink">Şikayet Akışı</h2>
          <p className="text-[13px] text-navy-mid mt-1">Son 7 günde durum dağılımı.</p>
          <div className="mt-6 h-40 grid grid-cols-7 items-end gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-md bg-brand-soft relative">
                <div className="absolute inset-x-0 bottom-0 rounded-md bg-brand" style={{ height: `${20 + ((i * 13) % 75)}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
          <h2 className="font-display text-lg font-bold text-ink">Son Aktiviteler</h2>
          <ul className="mt-4 space-y-3 text-[13px] text-navy">
            <li className="flex items-start gap-2"><span className="size-1.5 rounded-full bg-brand mt-1.5" /> Yeni şikayet onay bekliyor</li>
            <li className="flex items-start gap-2"><span className="size-1.5 rounded-full bg-warn mt-1.5" /> 3 firma doğrulama talep etti</li>
            <li className="flex items-start gap-2"><span className="size-1.5 rounded-full bg-ink mt-1.5" /> Sistem ayarları güncellendi</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: number | undefined; tone: "brand" | "ink" | "warn" | "danger" }) {
  const map = {
    brand: "bg-brand-soft text-brand",
    ink: "bg-surface text-ink",
    warn: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
      <div className={`size-9 rounded-lg grid place-items-center ${map[tone]}`}><Icon className="size-4.5" /></div>
      <div className="mt-3 text-[12px] text-navy-mid font-medium">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-ink tabular-nums">
        {value === undefined ? "—" : value.toLocaleString("tr-TR")}
      </div>
    </div>
  );
}
