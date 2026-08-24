import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ComplaintCard } from "@/components/cards";
import { Pagination } from "@/components/pagination";
import type { Complaint } from "@/lib/mock-data";
import { fetchComplaintsPaged, PAGE_SIZE } from "@/lib/data";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/trendler")({
  head: () => ({
    ...seoHead({
      title: "Trend Şikayetler — Gündemdeki Müşteri Şikayetleri | itirazvar",
      description: "Şu an en çok konuşulan müşteri şikayetleri: en çok görüntülenen ve desteklenen güncel şikayetleri takip edin.",
      path: "/trendler",
    }),
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchComplaintsPaged({ sortBy: "trending", page, pageSize: PAGE_SIZE })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6 sm:p-8 mb-6">
          <p className="eyebrow text-brand mb-1 inline-flex items-center gap-1"><TrendingUp className="size-3" /> Gündemde</p>
          <h1 className="font-display text-3xl font-black tracking-tight">Trend şikayetler</h1>
          <p className="text-sm text-navy-mid mt-1">{total.toLocaleString("tr-TR")} şikayet — en çok okunan ve etkileşim alanlar.</p>
        </div>
        {loading && items.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Henüz trend şikayet yok.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
