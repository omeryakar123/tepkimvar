import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { z } from "zod";
import { CompanyCard, ComplaintCard } from "@/components/cards";
import { Pagination } from "@/components/pagination";
import type { Company, Complaint } from "@/lib/mock-data";
import { fetchBrandsPaged, fetchComplaintsPaged, PAGE_SIZE } from "@/lib/data";
import { seoHead } from "@/lib/seo";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_site/arama")({
  validateSearch: searchSchema,
  head: () => ({
    ...seoHead({
      title: "Arama — tepkimvar",
      description: "Marka, şikayet veya şikayet kodu arayın; sonuçlara hızla ulaşın.",
      path: "/arama",
    }),
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const [term, setTerm] = useState(q);
  const [brands, setBrands] = useState<Company[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [brandsTotal, setBrandsTotal] = useState(0);
  const [complaintsTotal, setComplaintsTotal] = useState(0);
  const [brandPage, setBrandPage] = useState(1);
  const [complaintPage, setComplaintPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "brands" | "complaints">("all");

  async function run(qs: string, bp = brandPage, cp = complaintPage) {
    if (!qs.trim()) { setBrands([]); setComplaints([]); setBrandsTotal(0); setComplaintsTotal(0); return; }
    setLoading(true);
    const [b, c] = await Promise.all([
      fetchBrandsPaged({ search: qs, page: bp, pageSize: PAGE_SIZE, sortBy: "rating" }),
      fetchComplaintsPaged({ search: qs, page: cp, pageSize: PAGE_SIZE }),
    ]);
    setBrands(b.items); setBrandsTotal(b.total);
    setComplaints(c.items); setComplaintsTotal(c.total);
    setLoading(false);
  }
  useEffect(() => { setTerm(q); setBrandPage(1); setComplaintPage(1); run(q, 1, 1); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => { if (q) run(q, brandPage, complaintPage); /* eslint-disable-next-line */ }, [brandPage, complaintPage]);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <form onSubmit={(e) => { e.preventDefault(); window.history.replaceState(null, "", `/arama?q=${encodeURIComponent(term)}`); setBrandPage(1); setComplaintPage(1); run(term, 1, 1); }}
          className="bg-card rounded-2xl ring-1 ring-rule p-5 flex gap-3 items-center">
          <Search className="size-5 text-navy-mid" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} autoFocus placeholder="Marka veya şikayet ara…"
            className="flex-1 h-11 text-[15px] focus:outline-none" />
          <button className="h-11 rounded-full bg-brand text-brand-foreground px-5 text-sm font-semibold">Ara</button>
        </form>

        <div className="mt-6 flex items-center gap-2 text-sm">
          {(["all", "brands", "complaints"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 h-8 rounded-full ring-1 ${tab === t ? "bg-ink text-paper ring-ink" : "bg-card ring-rule text-navy-mid hover:text-ink"}`}>
              {t === "all" ? "Tümü" : t === "brands" ? `Markalar (${brandsTotal})` : `Şikayetler (${complaintsTotal})`}
            </button>
          ))}
          {loading && <span className="text-navy-mid">Aranıyor…</span>}
        </div>

        {(tab === "all" || tab === "brands") && brands.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display font-bold text-[18px] mb-3">Markalar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {brands.map((b) => <CompanyCard key={b.slug} company={b} />)}
            </div>
            {tab === "brands" && <Pagination page={brandPage} pageSize={PAGE_SIZE} total={brandsTotal} onChange={setBrandPage} />}
          </section>
        )}

        {(tab === "all" || tab === "complaints") && complaints.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display font-bold text-[18px] mb-3">Şikayetler</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complaints.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
            </div>
            {tab === "complaints" && <Pagination page={complaintPage} pageSize={PAGE_SIZE} total={complaintsTotal} onChange={setComplaintPage} />}
          </section>
        )}

        {!loading && q && brands.length === 0 && complaints.length === 0 && (
          <div className="mt-10 bg-card rounded-2xl ring-1 ring-rule p-12 text-center text-navy-mid">
            "{q}" için sonuç bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
