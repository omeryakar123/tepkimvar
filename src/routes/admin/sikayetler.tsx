import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Search, User } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/data";

type Status = "pending" | "approved" | "in_review" | "answered" | "resolved" | "rejected" | "spam";
type Source = "organic" | "bot";
type Complaint = {
  id: string;
  title: string;
  status: Status;
  created_at: string;
  brand_id: string | null;
  user_id: string | null;
  is_synthetic: boolean;
  brand_name: string | null;
};

type SourceStats = {
  total: number;
  today: number;
  pending: number;
  approved: number;
  resolved: number;
  spam: number;
};

export const Route = createFileRoute("/admin/sikayetler")({
  component: AdminComplaintsPage,
});

const STATUSES: Status[] = ["pending", "approved", "in_review", "answered", "resolved", "rejected", "spam"];

function AdminComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<Source>("organic");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ organic: SourceStats; bot: SourceStats } | null>(null);

  async function loadStats() {
    const data = await apiGet<{ complaints_by_source: { organic: SourceStats; bot: SourceStats } }>(
      "/api/admin/stats",
    );
    if (data?.complaints_by_source) setStats(data.complaints_by_source);
  }

  async function load(p = page) {
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
      source,
    });
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const data = await apiGet<{ items: Complaint[]; total: number }>(`/api/admin/complaints?${params}`);
    setItems(data?.items ?? []);
    setTotal(data?.total ?? 0);
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
    /* eslint-disable-next-line */
  }, [status, source]);

  useEffect(() => {
    load(page);
    /* eslint-disable-next-line */
  }, [page]);

  async function setStatusFor(id: string, s: Status) {
    if (await apiSend("/api/admin/complaints", "PATCH", { id, status: s })) {
      toast.success("Güncellendi");
      load(page);
      loadStats();
    }
  }

  async function remove(id: string) {
    if (!confirm("Şikayet silinsin mi?")) return;
    if (await apiSend("/api/admin/complaints", "DELETE", { id })) {
      toast.success("Silindi");
      load(page);
      loadStats();
    }
  }

  const activeStats = stats?.[source];

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Moderasyon</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Şikayetler</h1>
        <p className="mt-1 text-[14px] text-navy-mid">
          Organik kullanıcı şikayetleri ile bot üretimi içerik ayrı listelenir.
        </p>
      </div>

      {/* Kaynak sekmeleri + özet istatistikler */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-4">
        <div className="flex rounded-xl ring-1 ring-rule p-1 bg-surface self-start">
          <button
            type="button"
            onClick={() => setSource("organic")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition ${
              source === "organic" ? "bg-card text-brand shadow-sm ring-1 ring-rule" : "text-navy-mid hover:text-ink"
            }`}
          >
            <User className="size-4" />
            Organik
            {stats && (
              <span className="tabular-nums text-[11px] font-bold bg-brand-soft text-brand px-1.5 py-0.5 rounded">
                {stats.organic.total.toLocaleString("tr-TR")}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSource("bot")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition ${
              source === "bot" ? "bg-card text-brand shadow-sm ring-1 ring-rule" : "text-navy-mid hover:text-ink"
            }`}
          >
            <Bot className="size-4" />
            Bot
            {stats && (
              <span className="tabular-nums text-[11px] font-bold bg-surface text-navy-mid px-1.5 py-0.5 rounded ring-1 ring-rule">
                {stats.bot.total.toLocaleString("tr-TR")}
              </span>
            )}
          </button>
        </div>

        {activeStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <MiniStat label="Toplam" value={activeStats.total} />
            <MiniStat label="Bugün" value={activeStats.today} highlight />
            <MiniStat label="Bekleyen" value={activeStats.pending} warn />
            <MiniStat label="Onaylı" value={activeStats.approved} />
            <MiniStat label="Çözülen" value={activeStats.resolved} />
            <MiniStat label="Spam" value={activeStats.spam} danger />
          </div>
        )}
      </div>

      {source === "bot" && (
        <div className="rounded-xl bg-brand-soft/50 ring-1 ring-brand/20 px-4 py-3 text-[13px] text-navy">
          Bot şikayetlerinin detaylı yönetimi için{" "}
          <Link to="/admin/bot" className="font-semibold text-brand hover:underline">
            Complaint Bot
          </Link>{" "}
          sayfasını kullanabilirsiniz.
        </div>
      )}

      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(1);
          }}
          className="p-4 border-b border-rule flex items-center gap-3 flex-wrap"
        >
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Başlık ara..."
              className="w-full h-10 rounded-lg ring-1 ring-rule pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm"
          >
            <option value="">Tüm durumlar</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-lg bg-brand text-brand-foreground px-4 text-sm font-semibold">Filtrele</button>
          <div className="text-[12px] text-navy-mid ml-auto">
            {total.toLocaleString("tr-TR")} kayıt · {source === "organic" ? "Organik" : "Bot"}
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Başlık</th>
                <th className="px-4 py-3 font-semibold">Firma</th>
                <th className="px-4 py-3 font-semibold">Kaynak</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-rule hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium text-ink max-w-[280px]">
                    <Link to="/sikayet/$id" params={{ id: c.id }} className="hover:text-brand line-clamp-2">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-navy-mid whitespace-nowrap">{c.brand_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.is_synthetic ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded">
                        <Bot className="size-3" /> Bot
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand bg-brand-soft px-2 py-0.5 rounded">
                        <User className="size-3" /> Organik
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.status}
                      onChange={(e) => setStatusFor(c.id, e.target.value as Status)}
                      className="h-8 rounded ring-1 ring-rule px-2 text-[12px]"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-navy-mid whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(c.id)} className="text-[12px] text-danger hover:underline">
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-navy-mid">
                    {source === "organic" ? "Organik şikayet bulunamadı." : "Bot şikayeti bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-rule">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
  warn,
  danger,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  const tone = danger ? "text-danger" : warn ? "text-warning" : highlight ? "text-brand" : "text-ink";
  return (
    <div className="bg-card rounded-xl ring-1 ring-rule px-3 py-2.5">
      <div className="text-[11px] text-navy-mid font-medium">{label}</div>
      <div className={`mt-0.5 font-display text-lg font-black tabular-nums ${tone}`}>
        {value.toLocaleString("tr-TR")}
      </div>
    </div>
  );
}
