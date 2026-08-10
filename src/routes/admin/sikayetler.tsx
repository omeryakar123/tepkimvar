import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/data";

type Status = "pending" | "approved" | "in_review" | "answered" | "resolved" | "rejected" | "spam";
type Complaint = { id: string; title: string; status: Status; created_at: string; brand_id: string | null; user_id: string };

export const Route = createFileRoute("/admin/sikayetler")({
  component: AdminComplaintsPage,
});

const STATUSES: Status[] = ["pending", "approved", "in_review", "answered", "resolved", "rejected", "spam"];

function AdminComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = page) {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const data = await apiGet<{ items: Complaint[]; total: number }>(`/api/admin/complaints?${params}`);
    setItems(data?.items ?? []);
    setTotal(data?.total ?? 0);
  }
  useEffect(() => { setPage(1); load(1); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  async function setStatusFor(id: string, s: Status) {
    if (await apiSend("/api/admin/complaints", "PATCH", { id, status: s })) { toast.success("Güncellendi"); load(page); }
  }
  async function remove(id: string) {
    if (!confirm("Şikayet silinsin mi?")) return;
    if (await apiSend("/api/admin/complaints", "DELETE", { id })) { toast.success("Silindi"); load(page); }
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Moderasyon</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Şikayetler</h1>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} className="p-4 border-b border-rule flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık ara..." className="w-full h-10 rounded-lg ring-1 ring-rule pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm">
            <option value="">Tümü</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="h-10 rounded-lg bg-brand text-brand-foreground px-4 text-sm font-semibold">Filtrele</button>
          <div className="text-[12px] text-navy-mid ml-auto">{total.toLocaleString("tr-TR")} kayıt</div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Başlık</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-rule hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link to="/sikayet/$id" params={{ id: c.id }} className="hover:text-brand">{c.title}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <select value={c.status} onChange={(e) => setStatusFor(c.id, e.target.value as Status)} className="h-8 rounded ring-1 ring-rule px-2 text-[12px]">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-navy-mid">{new Date(c.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(c.id)} className="text-[12px] text-danger hover:underline">Sil</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-mid">Şikayet bulunamadı.</td></tr>}
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
