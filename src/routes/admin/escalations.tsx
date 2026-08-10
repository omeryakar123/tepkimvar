import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/escalations")({ component: EscalationsPage });

type Esc = {
  id: string; complaint_id: string; brand_id: string;
  reason: string; note: string | null; status: string; decision: string | null;
  created_at: string;
  brands?: { name: string; slug: string } | null;
  complaints?: { title: string; short_id: string | null } | null;
};

const ACTIONS: { v: string; label: string; tone: string }[] = [
  { v: "approve", label: "Onayla", tone: "bg-brand text-brand-foreground" },
  { v: "reject", label: "Reddet", tone: "bg-rule text-ink" },
  { v: "change_brand", label: "Firmayı değiştir", tone: "bg-blue-500 text-white" },
  { v: "delete", label: "Şikayeti sil", tone: "bg-red-500 text-white" },
  { v: "hide", label: "Şikayeti gizle", tone: "bg-navy text-white" },
  { v: "spam", label: "Spam yap", tone: "bg-orange-500 text-white" },
  { v: "warn_user", label: "Kullanıcıyı uyar", tone: "bg-yellow-500 text-white" },
  { v: "ban_user", label: "Kullanıcıyı banla", tone: "bg-red-700 text-white" },
  { v: "return", label: "Firmaya geri gönder", tone: "bg-surface text-ink ring-1 ring-rule" },
];

function EscalationsPage() {
  const [items, setItems] = useState<Esc[]>([]);
  const [active, setActive] = useState<Esc | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    const data = await apiGet<{ items: Esc[] }>("/api/admin/escalations");
    setItems(data?.items ?? []);
  }
  useEffect(() => { load(); }, []);

  // Karar + şikayet üzerindeki yan etkiler SUNUCUDA uygulanır (tek işlem).
  async function decide(action: string) {
    if (!active) return;
    if (!(await apiSend("/api/admin/escalations", "PATCH", { id: active.id, action, note }))) return;
    toast.success("Karar uygulandı");
    setActive(null); setNote(""); load();
  }

  return (
    <div className="px-6 lg:px-10 py-8 grid lg:grid-cols-[420px_1fr] gap-4">
      <aside className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-rule">
          <div className="eyebrow text-navy-mid">Super Admin</div>
          <h2 className="font-display text-xl font-bold text-ink mt-1">Escalation İncelemesi</h2>
          <p className="text-[12px] text-navy-mid mt-1">{items.length} kayıt</p>
        </div>
        <ul className="overflow-y-auto divide-y divide-rule">
          {items.map((it) => (
            <li key={it.id}>
              <button onClick={() => setActive(it)} className={`w-full text-left px-4 py-3 hover:bg-surface ${active?.id === it.id ? "bg-warning-soft/60" : ""}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span className="text-[11px] uppercase tracking-wider font-bold text-warning">{it.reason}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-navy-mid">{it.status}</span>
                </div>
                <div className="mt-1 text-[13.5px] font-semibold text-ink line-clamp-2">{it.complaints?.title ?? "—"}</div>
                <div className="text-[11px] text-navy-mid mt-0.5">
                  {it.brands?.name} · #{it.complaints?.short_id ?? "—"} · {new Date(it.created_at).toLocaleDateString("tr-TR")}
                </div>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="p-8 text-center text-navy-mid text-[13px]">Hiç escalation yok.</li>}
        </ul>
      </aside>

      <section className="bg-card rounded-2xl ring-1 ring-rule p-6">
        {active ? (
          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-warning font-bold">{active.reason}</div>
              <h1 className="mt-1 font-display text-2xl font-black text-ink">{active.complaints?.title}</h1>
              <div className="mt-1 text-[12px] text-navy-mid">
                <Link to="/firma/$slug" params={{ slug: active.brands?.slug ?? "" }} className="hover:text-brand">{active.brands?.name}</Link>
                {" · "}
                <Link to="/sikayet/$id" params={{ id: active.complaint_id }} className="text-brand inline-flex items-center gap-0.5">#{active.complaints?.short_id} <ExternalLink className="size-3" /></Link>
              </div>
            </div>
            {active.note && (
              <div className="bg-surface rounded-xl p-4 text-[13.5px] text-navy whitespace-pre-wrap">{active.note}</div>
            )}
            <div>
              <label className="text-[12px] font-medium text-navy-mid">Karar Notu (opsiyonel)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <button key={a.v} onClick={() => decide(a.v)} className={`h-9 px-4 rounded-lg text-[13px] font-semibold ${a.tone}`}>{a.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full grid place-items-center text-navy-mid">Soldan bir escalation seçin.</div>
        )}
      </section>
    </div>
  );
}
