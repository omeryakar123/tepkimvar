import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Filter, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/moderasyon")({ component: ModerationPage });

type Item = {
  id: string;
  kind: "escalation" | "report" | "sensitive" | "verification" | "adult" | "duplicate" | "other";
  state: "open" | "reviewing" | "resolved" | "dismissed";
  priority: number;
  target_type: string | null;
  target_id: string | null;
  related_table: string | null;
  related_id: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const KIND_LABEL: Record<Item["kind"], string> = {
  escalation: "Escalate", report: "Rapor", sensitive: "Hassas",
  verification: "Doğrulama", adult: "18+", duplicate: "Tekrar", other: "Diğer",
};

function ModerationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | Item["kind"]>("all");
  const [state, setState] = useState<"open" | "all">("open");

  async function load() {
    const params = new URLSearchParams({ kind: filter, state });
    const data = await apiGet<{ items: Item[] }>(`/api/admin/moderation?${params}`);
    setItems(data?.items ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, state]);

  async function resolve(id: string, target: "resolved" | "dismissed") {
    if (!(await apiSend("/api/admin/moderation", "PATCH", { id, state: target }))) return;
    toast.success(target === "resolved" ? "Çözüldü" : "Yok sayıldı");
    load();
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Süper Admin</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Moderasyon Merkezi</h1>
        <p className="text-[13.5px] text-navy-mid mt-1">Escalate, rapor, doğrulama ve hassas içerikler aynı kuyrukta.</p>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <div className="p-4 border-b border-rule flex items-center gap-3 flex-wrap">
          <Filter className="size-4 text-navy-mid" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as never)} className="h-9 rounded-lg ring-1 ring-rule px-3 text-sm">
            <option value="all">Tüm türler</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value as never)} className="h-9 rounded-lg ring-1 ring-rule px-3 text-sm">
            <option value="open">Aktif</option>
            <option value="all">Tümü</option>
          </select>
          <div className="ml-auto text-[12px] text-navy-mid">{items.length} kayıt</div>
        </div>
        <ul className="divide-y divide-rule">
          {items.map((it) => (
            <li key={it.id} className="p-4 hover:bg-surface/40 flex items-start gap-3">
              <div className={`mt-0.5 size-8 rounded-lg grid place-items-center ${badgeKind(it.kind)}`}>
                {it.kind === "verification" ? <ShieldCheck className="size-4" /> : <AlertTriangle className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${badgeKind(it.kind)}`}>{KIND_LABEL[it.kind]}</span>
                  <span className="text-[10px] text-navy-mid uppercase tracking-wider">{it.state}</span>
                  <span className="text-[11px] text-navy-mid">{new Date(it.created_at).toLocaleString("tr-TR")}</span>
                </div>
                <div className="mt-1 text-[14px] font-medium text-ink truncate">{it.summary ?? "—"}</div>
                <div className="text-[12px] text-navy-mid">
                  {it.target_type} · {String(it.target_id ?? "").slice(0, 8)}
                  {it.target_type === "complaint" && it.target_id && (
                    <Link to="/sikayet/$id" params={{ id: it.target_id }} className="ml-2 text-brand hover:underline inline-flex items-center gap-0.5">aç <ExternalLink className="size-3" /></Link>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => resolve(it.id, "resolved")} className="h-8 px-3 rounded-lg bg-brand text-brand-foreground text-[12px] font-semibold hover:brightness-110">Çözüldü</button>
                <button onClick={() => resolve(it.id, "dismissed")} className="h-8 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold hover:bg-surface">Yok say</button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="p-10 text-center text-navy-mid">Kuyruk boş.</li>}
        </ul>
      </div>
    </div>
  );
}

function badgeKind(k: Item["kind"]) {
  switch (k) {
    case "escalation": return "bg-warning-soft text-warning";
    case "verification": return "bg-info-soft text-info";
    case "report": return "bg-danger-soft text-danger";
    case "adult": return "bg-danger-soft text-danger";
    case "sensitive": return "bg-warning-soft text-warning";
    default: return "bg-surface text-navy-mid";
  }
}
