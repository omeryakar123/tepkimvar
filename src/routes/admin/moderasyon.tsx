import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  Filter,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminComplaintModal } from "@/components/admin-complaint-modal";

export const Route = createFileRoute("/admin/moderasyon")({ component: ModerationPage });

type Item = {
  id: string;
  kind: "escalation" | "report" | "sensitive" | "verification" | "adult" | "duplicate" | "other";
  state: "open" | "reviewing" | "resolved" | "dismissed";
  priority: number;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const KIND_LABEL: Record<Item["kind"], string> = {
  escalation: "Escalate",
  report: "Rapor",
  sensitive: "Hassas",
  verification: "Doğrulama",
  adult: "18+",
  duplicate: "Tekrar",
  other: "Şikayet onayı",
};

function ModerationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | Item["kind"]>("all");
  const [state, setState] = useState<"open" | "all">("open");
  const [previewComplaintId, setPreviewComplaintId] = useState<string | null>(null);
  const [previewModerationId, setPreviewModerationId] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams({ kind: filter, state });
    const data = await apiGet<{ items: Item[] }>(`/api/admin/moderation?${params}`);
    setItems(data?.items ?? []);
  }
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [filter, state]);

  async function complaintAction(id: string, action: "approve" | "reject") {
    if (!(await apiSend("/api/admin/moderation", "PATCH", { id, complaintAction: action })))
      return false;
    toast.success(action === "approve" ? "Şikayet onaylandı ve yayına alındı" : "Şikayet reddedildi");
    load();
    return true;
  }

  function openPreview(it: Item) {
    if (!it.target_id) return;
    setPreviewComplaintId(it.target_id);
    setPreviewModerationId(it.target_type === "complaint" ? it.id : null);
  }

  function closePreview() {
    setPreviewComplaintId(null);
    setPreviewModerationId(null);
  }

  async function resolve(id: string, target: "resolved" | "dismissed") {
    if (!(await apiSend("/api/admin/moderation", "PATCH", { id, state: target }))) return;
    toast.success(target === "resolved" ? "Çözüldü" : "Yok sayıldı");
    load();
  }

  const openCount = items.filter((i) => i.state === "open" || i.state === "reviewing").length;
  const complaintCount = items.filter((i) => i.target_type === "complaint").length;

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Süper Admin</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">
          Moderasyon Merkezi
        </h1>
        <p className="text-[13.5px] text-navy-mid mt-1">
          Tüm şikayetler firma paneline yansımadan önce buradan onaylanır. Sorular için{" "}
          <a href="mailto:info@tepkimvar.com" className="text-brand hover:underline">
            info@tepkimvar.com
          </a>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Açık kayıt" value={openCount} />
        <MiniStat label="Şikayet incelemesi" value={complaintCount} />
        <MiniStat label="Toplam liste" value={items.length} />
        <MiniStat label="Öncelikli" value={items.filter((i) => i.priority >= 2).length} />
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <div className="p-4 border-b border-rule flex items-center gap-3 flex-wrap">
          <Filter className="size-4 text-navy-mid" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as never)}
            className="h-9 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="all">Tüm türler</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as never)}
            className="h-9 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="open">Aktif</option>
            <option value="all">Tümü</option>
          </select>
        </div>

        <ul className="divide-y divide-rule">
          {items.map((it) => (
            <li key={it.id} className="p-4 hover:bg-surface/40">
              <div className="flex items-start gap-3 flex-wrap">
                <div
                  className={`mt-0.5 size-9 rounded-lg grid place-items-center shrink-0 ${badgeKind(it.kind)}`}
                >
                  {it.kind === "verification" ? (
                    <ShieldCheck className="size-4" />
                  ) : it.target_type === "complaint" ? (
                    <MessageSquare className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${badgeKind(it.kind)}`}
                    >
                      {it.target_type === "complaint" ? "Şikayet onayı" : KIND_LABEL[it.kind]}
                    </span>
                    <span className="text-[10px] text-navy-mid uppercase">{it.state}</span>
                    {it.priority >= 2 && (
                      <span className="text-[10px] font-bold text-danger uppercase">Öncelikli</span>
                    )}
                    <span className="text-[11px] text-navy-mid ml-auto">
                      {new Date(it.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="mt-1 text-[14px] font-medium text-ink">{it.summary ?? "—"}</div>
                  {it.payload?.platformUsername != null && (
                    <div className="text-[12px] text-navy-mid mt-0.5">
                      Platform kullanıcı adı:{" "}
                      <span className="text-ink font-medium">
                        {String(it.payload.platformUsername)}
                      </span>
                    </div>
                  )}
                  {it.target_type === "complaint" && it.target_id && (
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openPreview(it)}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                      >
                        <Eye className="size-3.5" /> Önizle & düzenle
                      </button>
                      <Link
                        to="/sikayet/$id"
                        params={{ id: it.target_id }}
                        target="_blank"
                        className="inline-flex items-center gap-0.5 text-[12px] text-navy-mid hover:text-brand hover:underline"
                      >
                        Sayfayı aç <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {it.target_type === "complaint" && it.target_id && (
                    <button
                      type="button"
                      onClick={() => openPreview(it)}
                      className="h-8 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-surface"
                    >
                      <Eye className="size-3.5" /> Önizle
                    </button>
                  )}
                  {it.target_type === "complaint" &&
                    (it.state === "open" || it.state === "reviewing") && (
                      <>
                        <button
                          onClick={() => complaintAction(it.id, "approve")}
                          className="h-8 px-3 rounded-lg bg-brand text-brand-foreground text-[12px] font-semibold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="size-3.5" /> Onayla
                        </button>
                        <button
                          onClick={() => complaintAction(it.id, "reject")}
                          className="h-8 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-danger-soft/40 text-danger"
                        >
                          <XCircle className="size-3.5" /> Reddet
                        </button>
                      </>
                    )}
                  {it.target_type !== "complaint" && (
                    <>
                      <button
                        onClick={() => resolve(it.id, "resolved")}
                        className="h-8 px-3 rounded-lg bg-brand text-brand-foreground text-[12px] font-semibold"
                      >
                        Çözüldü
                      </button>
                      <button
                        onClick={() => resolve(it.id, "dismissed")}
                        className="h-8 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold hover:bg-surface"
                      >
                        Yok say
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="p-10 text-center text-navy-mid">Kuyruk boş — bekleyen inceleme yok.</li>
          )}
        </ul>
      </div>

      <AdminComplaintModal
        open={!!previewComplaintId}
        complaintId={previewComplaintId}
        moderationItemId={previewModerationId}
        onClose={closePreview}
        onUpdated={load}
        onModerationAction={
          previewModerationId
            ? (action) => complaintAction(previewModerationId, action)
            : undefined
        }
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-xl ring-1 ring-rule p-4">
      <div className="text-[11px] uppercase tracking-wider text-navy-mid font-semibold">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-ink tabular-nums">{value}</div>
    </div>
  );
}

function badgeKind(k: Item["kind"]) {
  switch (k) {
    case "escalation":
      return "bg-warning-soft text-warning";
    case "verification":
      return "bg-info-soft text-info";
    case "report":
    case "adult":
      return "bg-danger-soft text-danger";
    case "sensitive":
      return "bg-warning-soft text-warning";
    default:
      return "bg-surface text-navy-mid";
  }
}
