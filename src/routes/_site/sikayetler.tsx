import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Filter, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ComplaintCard } from "@/components/cards";
import { Pagination } from "@/components/pagination";
import type { Complaint } from "@/lib/mock-data";
import { fetchComplaintsPaged, fetchCategoriesWithCount, PAGE_SIZE } from "@/lib/data";
import { seoHead, breadcrumbLd, clamp } from "@/lib/seo";

type SP = { kategori?: string; durum?: string; q?: string; sirala?: "recent" | "trending" };

export const Route = createFileRoute("/_site/sikayetler")({
  validateSearch: (s: Record<string, unknown>): SP => ({
    kategori: typeof s.kategori === "string" ? s.kategori : undefined,
    durum: typeof s.durum === "string" ? s.durum : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    // Varsayılanı yazmıyoruz; aksi halde /sikayetler her istekte
    // ?sirala=recent adresine 307 ile yönleniyor (SEO için gereksiz).
    sirala: s.sirala === "trending" ? "trending" : undefined,
  }),
  loader: async () => {
    const first = await fetchComplaintsPaged({ page: 1, pageSize: PAGE_SIZE }).catch(() => ({
      items: [] as Complaint[], total: 0, page: 1, pageSize: PAGE_SIZE,
    }));
    return { first };
  },
  head: ({ loaderData }) => {
    const total = loaderData?.first?.total ?? 0;
    const title = "Şikayetler — Güncel Müşteri Şikayetleri | itirazvar";
    const description = clamp(
      `Türkiye'nin en güncel ${total > 0 ? total + " " : ""}müşteri şikayeti. Kategoriye, duruma ve markaya göre filtreleyin; marka yanıtlarını ve çözüm süreçlerini takip edin.`,
      155,
    );
    return {
      ...seoHead({ title, description, path: "/sikayetler" }),
      scripts: [
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Şikayetler", path: "/sikayetler" },
        ]),
      ],
    };
  },
  component: SikayetlerPage,
});

function SikayetlerPage() {
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const [items, setItems] = useState<Complaint[]>(loaded?.first?.items ?? []);
  const [total, setTotal] = useState(loaded?.first?.total ?? 0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]);
  const [search, setSearch] = useState(sp.q ?? "");

  useEffect(() => { fetchCategoriesWithCount().then((c) => setCats(c.map((x) => ({ slug: x.slug, name: x.name })))); }, []);
  useEffect(() => { setPage(1); }, [sp.kategori, sp.durum, sp.sirala, sp.q]);

  useEffect(() => {
    setLoading(true);
    fetchComplaintsPaged({
      page, pageSize: PAGE_SIZE,
      categorySlug: sp.kategori || undefined,
      sortBy: sp.sirala ?? "recent",
      search: sp.q || undefined,
    })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [page, sp.kategori, sp.durum, sp.sirala, sp.q]);

  const filtered = useMemo(() => {
    if (!sp.durum) return items;
    return items.filter((c) => c.status === sp.durum);
  }, [items, sp.durum]);

  const setParam = (patch: Partial<SP>) => nav({ search: (prev: SP) => ({ ...prev, ...patch }) });

  const durumChips: { key: SP["durum"]; label: string; icon: typeof CheckCircle2 }[] = [
    { key: undefined, label: "Tümü", icon: Filter },
    { key: "cozuldu", label: "Çözüldü", icon: CheckCircle2 },
    { key: "inceleniyor", label: "İnceleniyor", icon: Clock },
    { key: "beklemede", label: "Beklemede", icon: AlertCircle },
  ];

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6 sm:p-8 mb-6">
          <p className="eyebrow text-brand mb-1">Şikayetler</p>
          <h1 className="font-display text-3xl font-black tracking-tight">Tüm şikayetler</h1>
          <p className="text-sm text-navy-mid mt-1">{total.toLocaleString("tr-TR")} şikayet listeleniyor.</p>

          <form
            onSubmit={(e) => { e.preventDefault(); setParam({ q: search || undefined }); }}
            className="mt-6 flex flex-wrap gap-3"
          >
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Şikayet ara…"
                className="w-full h-11 rounded-full ring-1 ring-rule pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <select
              value={sp.kategori ?? ""}
              onChange={(e) => setParam({ kategori: e.target.value || undefined })}
              className="h-11 rounded-full ring-1 ring-rule px-4 text-sm bg-card"
            >
              <option value="">Tüm kategoriler</option>
              {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select
              value={sp.sirala ?? "recent"}
              onChange={(e) => setParam({ sirala: (e.target.value as "recent" | "trending") })}
              className="h-11 rounded-full ring-1 ring-rule px-4 text-sm bg-card"
            >
              <option value="recent">En yeni</option>
              <option value="trending">Trend</option>
            </select>
            <button className="h-11 rounded-full bg-brand text-brand-foreground px-5 text-sm font-semibold">Ara</button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {durumChips.map((d) => {
              const active = (sp.durum ?? undefined) === d.key;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setParam({ durum: d.key })}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium ring-1 transition ${
                    active ? "bg-brand text-brand-foreground ring-brand" : "bg-card text-navy ring-rule hover:ring-brand/40"
                  }`}
                >
                  <d.icon className="size-3.5" /> {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading && filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Sonuç bulunamadı.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
