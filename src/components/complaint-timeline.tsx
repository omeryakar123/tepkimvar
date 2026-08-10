import { useEffect, useState } from "react";
import { Check, Clock, MessageSquare, Reply, Shield, AlertTriangle, X, Archive } from "lucide-react";

export type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_role: string | null;
  note: string | null;
  created_at: string;
};

const META: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: "Yeni", icon: Clock, color: "bg-warning-soft text-warning" },
  approved: { label: "Onaylandı", icon: Check, color: "bg-info-soft text-info" },
  in_review: { label: "İncelemede", icon: Clock, color: "bg-info-soft text-info" },
  answered: { label: "Firma Yanıtladı", icon: Reply, color: "bg-success-soft text-success" },
  user_replied: { label: "Kullanıcı Yanıtladı", icon: MessageSquare, color: "bg-info-soft text-info" },
  resolved: { label: "Çözüldü", icon: Check, color: "bg-success-soft text-success" },
  escalated: { label: "Yükseltildi", icon: AlertTriangle, color: "bg-warning-soft text-warning" },
  super_admin_review: { label: "Hakemlikte", icon: Shield, color: "bg-brand-soft text-accent-purple" },
  rejected: { label: "Reddedildi", icon: X, color: "bg-danger-soft text-danger" },
  spam: { label: "Spam", icon: X, color: "bg-surface text-navy" },
  archived: { label: "Arşivlendi", icon: Archive, color: "bg-surface text-navy" },
};

const ROLE_LABEL: Record<string, string> = {
  user: "Kullanıcı", brand: "Marka", moderator: "Moderatör", admin: "Admin", super_admin: "Super Admin",
};

export function ComplaintTimeline({ complaintId }: { complaintId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/history?complaintId=${complaintId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d: HistoryRow[]) => { if (!cancelled) setRows(d ?? []); })
        .catch(() => {});
    load();

    // Canlı güncelleme: durum değişince akıştan haber gelir, geçmişi tazeleriz.
    const es = new EventSource(`/api/events/${complaintId}`);
    es.addEventListener("complaint", load);
    return () => { cancelled = true; es.close(); };
  }, [complaintId]);

  if (rows.length === 0) {
    return <div className="text-[13px] text-navy-mid">Henüz durum kaydı yok.</div>;
  }

  return (
    <ol className="relative border-l-2 border-rule ml-3 space-y-4">
      {rows.map((r) => {
        const m = META[r.to_status] ?? { label: r.to_status, icon: Clock, color: "bg-surface text-navy" };
        const Icon = m.icon;
        return (
          <li key={r.id} className="ml-4">
            <span className={`absolute -left-[13px] grid place-items-center size-6 rounded-full ${m.color} ring-4 ring-white`}>
              <Icon className="size-3" />
            </span>
            <div className="bg-card rounded-xl ring-1 ring-rule p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.color}`}>{m.label}</span>
                <span className="text-[11.5px] text-navy-mid">{new Date(r.created_at).toLocaleString("tr-TR")}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-navy">
                {r.actor_role && <span className="font-medium">{ROLE_LABEL[r.actor_role] ?? r.actor_role}</span>}
                {r.note && <span className="text-navy-mid"> — {r.note}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
