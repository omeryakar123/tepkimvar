import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  MessageSquare,
  AlertOctagon,
  Crown,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MousePointerClick,
} from "lucide-react";
import { apiGet } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type FlowDay = {
  day: string;
  pending: number;
  approved: number;
  answered: number;
  resolved: number;
  total: number;
};

type Stats = {
  brands: number;
  users: number;
  complaints: number;
  today: number;
  pending: number;
  spam: number;
  resolved: number;
  premium: number;
  verified: number;
  complaint_flow: FlowDay[];
  page_views: { total: number; today: number; week: number; daily: { day: string; views: number }[] };
};

function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const data = await apiGet<Stats>("/api/admin/stats");
      if (data) setS(data);
    })();
  }, []);

  const flow = s?.complaint_flow ?? [];
  const maxFlow = Math.max(1, ...flow.map((d) => d.total));
  const pvDaily = s?.page_views?.daily ?? [];
  const maxPv = Math.max(1, ...pvDaily.map((d) => d.views));

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
        <Stat icon={MousePointerClick} label="Sayfa görüntüleme (7g)" value={s?.page_views?.week} tone="ink" />
        <Stat icon={MousePointerClick} label="Bugünkü tıklama" value={s?.page_views?.today} tone="brand" />
        <Stat icon={CheckCircle2} label="Çözülen" value={s?.resolved} tone="brand" />
        <Stat icon={Crown} label="Premium Firma" value={s?.premium} tone="warn" />
        <Stat icon={ShieldCheck} label="Doğrulanmış Firma" value={s?.verified} tone="brand" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
          <h2 className="font-display text-lg font-bold text-ink">Şikayet Akışı</h2>
          <p className="text-[13px] text-navy-mid mt-1">Son 7 günde durum dağılımı (canlı veri).</p>
          {flow.length === 0 ? (
            <p className="mt-8 text-center text-navy-mid text-sm">Henüz veri yok.</p>
          ) : (
            <div className="mt-6 flex items-end gap-2 h-44">
              {flow.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex flex-col justify-end h-36 gap-0.5">
                    {d.resolved > 0 && (
                      <div
                        className="w-full rounded-t bg-brand"
                        style={{ height: `${(d.resolved / maxFlow) * 100}%`, minHeight: d.resolved ? 4 : 0 }}
                        title={`Çözülen: ${d.resolved}`}
                      />
                    )}
                    {d.answered > 0 && (
                      <div
                        className="w-full bg-accent-purple/70"
                        style={{ height: `${(d.answered / maxFlow) * 100}%`, minHeight: d.answered ? 4 : 0 }}
                        title={`Yanıtlanan: ${d.answered}`}
                      />
                    )}
                    {d.approved > 0 && (
                      <div
                        className="w-full bg-success/70"
                        style={{ height: `${(d.approved / maxFlow) * 100}%`, minHeight: d.approved ? 4 : 0 }}
                        title={`Onaylı: ${d.approved}`}
                      />
                    )}
                    {d.pending > 0 && (
                      <div
                        className="w-full rounded-b bg-warning/80"
                        style={{ height: `${(d.pending / maxFlow) * 100}%`, minHeight: d.pending ? 4 : 0 }}
                        title={`Bekleyen: ${d.pending}`}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-navy-mid truncate w-full text-center">
                    {d.day.slice(5)}
                  </span>
                  <span className="text-[10px] font-semibold text-ink">{d.total}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-navy-mid">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-warning/80" /> Bekleyen</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-success/70" /> Onaylı</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-accent-purple/70" /> Yanıtlı</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-brand" /> Çözülen</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
          <h2 className="font-display text-lg font-bold text-ink">Site Ziyaretleri</h2>
          <p className="text-[13px] text-navy-mid mt-1">Son 7 gün sayfa görüntüleme.</p>
          {pvDaily.length === 0 ? (
            <p className="mt-8 text-center text-navy-mid text-sm">Henüz izleme verisi yok — deploy sonrası birikir.</p>
          ) : (
            <div className="mt-6 flex items-end gap-2 h-44">
              {pvDaily.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-brand/80 min-h-[4px]"
                    style={{ height: `${(d.views / maxPv) * 144}px` }}
                  />
                  <span className="text-[10px] text-navy-mid">{d.day.slice(5)}</span>
                  <span className="text-[10px] font-semibold text-ink">{d.views}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-[12px] text-navy-mid">
            Toplam: <b className="text-ink">{s?.page_views?.total?.toLocaleString("tr-TR") ?? "—"}</b>
            {" · "}Bu hafta: <b className="text-ink">{s?.page_views?.week?.toLocaleString("tr-TR") ?? "—"}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: number | undefined;
  tone: "brand" | "ink" | "warn" | "danger";
}) {
  const map = {
    brand: "bg-brand-soft text-brand",
    ink: "bg-surface text-ink",
    warn: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
      <div className={`size-9 rounded-lg grid place-items-center ${map[tone]}`}>
        <Icon className="size-4.5" />
      </div>
      <div className="mt-3 text-[12px] text-navy-mid font-medium">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-ink tabular-nums">
        {value === undefined ? "—" : value.toLocaleString("tr-TR")}
      </div>
    </div>
  );
}
