import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Check, X } from "lucide-react";
import { apiGet, apiSend } from "@/lib/admin-api";

type Req = {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  plan: string;
  status: string;
  note: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/premium")({
  component: AdminPremiumPage,
});

const TABS = [
  { k: "pending", l: "Bekleyen" },
  { k: "approved", l: "Onaylanan" },
  { k: "rejected", l: "Reddedilen" },
] as const;

function AdminPremiumPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("pending");
  const [items, setItems] = useState<Req[]>([]);

  async function load() {
    const d = await apiGet<{ items: Req[] }>(`/api/admin/premium?status=${tab}`);
    setItems(d?.items ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  async function decide(id: string, decision: "approved" | "rejected") {
    if (await apiSend("/api/admin/premium", "PATCH", { id, decision })) {
      toast.success(decision === "approved" ? "Onaylandı" : "Reddedildi");
      load();
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Premium</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink flex items-center gap-2">
          <Crown className="size-7 text-warning" /> Premium Başvuruları
        </h1>
      </div>

      <div className="flex gap-1 border-b border-rule">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 h-10 text-[13.5px] font-semibold border-b-2 -mb-px ${tab === t.k ? "border-brand text-brand" : "border-transparent text-navy-mid hover:text-ink"}`}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="bg-card rounded-2xl ring-1 ring-rule p-10 text-center text-sm text-navy-mid">
            Bu durumda başvuru yok.
          </div>
        )}
        {items.map((r) => (
          <div key={r.id} className="bg-card rounded-2xl ring-1 ring-rule p-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{r.brand_name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-semibold uppercase">{r.plan}</span>
              </div>
              {r.note && <p className="mt-1 text-[13px] text-navy">{r.note}</p>}
              <p className="mt-1 text-[12px] text-navy-mid">{new Date(r.created_at).toLocaleString("tr-TR")}</p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => decide(r.id, "approved")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold">
                  <Check className="size-4" /> Onayla
                </button>
                <button onClick={() => decide(r.id, "rejected")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg ring-1 ring-rule text-danger text-[13px] font-semibold hover:bg-danger-soft">
                  <X className="size-4" /> Reddet
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
