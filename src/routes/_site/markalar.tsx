import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CompanyCard } from "@/components/cards";
import { Pagination } from "@/components/pagination";
import type { Company } from "@/lib/mock-data";
import { fetchBrandsPaged, fetchCategoriesWithCount, PAGE_SIZE } from "@/lib/data";
import { seoHead, breadcrumbLd, clamp } from "@/lib/seo";

type BrandSearch = { dogrulanmis?: true; premium?: true; sayfa?: number };

function parseSayfa(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export const Route = createFileRoute("/_site/markalar")({
  validateSearch: (s: Record<string, unknown>): BrandSearch => ({
    dogrulanmis: s.dogrulanmis === true || s.dogrulanmis === "1" ? true : undefined,
    premium: s.premium === true || s.premium === "1" ? true : undefined,
    sayfa: parseSayfa(s.sayfa),
  }),
  loaderDeps: ({ search }) => ({
    dogrulanmis: search.dogrulanmis,
    premium: search.premium,
    sayfa: search.sayfa ?? 1,
  }),
  loader: async ({ deps }) => {
    const page = deps.sayfa ?? 1;
    const first = await fetchBrandsPaged({
      page,
      pageSize: PAGE_SIZE,
      verified: deps.dogrulanmis === true,
      premium: deps.premium === true,
    }).catch(() => ({
      items: [] as Company[], total: 0, page: 1, pageSize: PAGE_SIZE,
    }));
    return { first, page };
  },
  head: ({ loaderData }) => {
    const total = loaderData?.first?.total ?? 0;
    const title = "Markalar Dizini — Firma Şikayetleri ve Puanları | tepkimvar";
    const description = clamp(
      `${total > 0 ? total + " marka" : "Markalar"}: müşteri şikayetleri, çözüm oranları ve puanlar. Kategoriye göre filtreleyin, puana göre sıralayın.`,
      155,
    );
    return {
      ...seoHead({ title, description, path: "/markalar" }),
      scripts: [
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Markalar", path: "/markalar" },
        ]),
      ],
    };
  },
  component: BrandsPage,
});

type SortKey = "rating" | "resolution" | "recent" | "complaints";

function BrandsPage() {
  const loaded = Route.useLoaderData();
  const sp = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = sp.sayfa ?? 1;
  const [brands, setBrands] = useState<Company[]>(loaded?.first?.items ?? []);
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [total, setTotal] = useState(loaded?.first?.total ?? 0);
  const [loading, setLoading] = useState(true);

  function goToPage(p: number) {
    navigate({
      search: (prev) => ({
        ...prev,
        sayfa: p > 1 ? p : undefined,
      }),
    });
  }

  function resetPage() {
    if (page !== 1) {
      navigate({
        search: (prev) => ({ ...prev, sayfa: undefined }),
      });
    }
  }

  async function load(p = page) {
    setLoading(true);
    try {
      const r = await fetchBrandsPaged({
        search: search || undefined,
        categorySlug: cat || undefined,
        sortBy: sort,
        page: p,
        pageSize: PAGE_SIZE,
        verified: sp.dogrulanmis === true,
        premium: sp.premium === true,
      });
      setBrands(r.items);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategoriesWithCount().then((c) => setCats(c.map((x) => ({ slug: x.slug, name: x.name }))));
  }, []);

  useEffect(() => {
    load(page);
    /* eslint-disable-next-line */
  }, [cat, sort, page, sp.dogrulanmis, sp.premium]);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6 sm:p-8 mb-6">
          <p className="eyebrow text-brand mb-1">Markalar</p>
          <h1 className="font-display text-3xl font-black tracking-tight">Tüm markalar</h1>
          <p className="text-sm text-navy-mid mt-1">{total.toLocaleString("tr-TR")} firma listeleniyor.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetPage();
              load(1);
            }}
            className="mt-6 flex flex-wrap gap-3"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Firma ara…"
                className="w-full h-11 rounded-full ring-1 ring-rule pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <select
              value={cat}
              onChange={(e) => {
                setCat(e.target.value);
                resetPage();
              }}
              className="h-11 rounded-full ring-1 ring-rule px-4 text-sm bg-card"
            >
              <option value="">Tüm kategoriler</option>
              {cats.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                resetPage();
              }}
              className="h-11 rounded-full ring-1 ring-rule px-4 text-sm bg-card"
            >
              <option value="rating">Puan</option>
              <option value="resolution">Çözüm oranı</option>
              <option value="complaints">Şikayet sayısı</option>
              <option value="recent">Yeni eklenen</option>
            </select>
            <button className="h-11 rounded-full bg-brand text-brand-foreground px-5 text-sm font-semibold">
              Ara
            </button>
          </form>
        </div>

        {loading && brands.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Yükleniyor…</div>
        ) : brands.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Sonuç bulunamadı.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {brands.map((b) => (
                <CompanyCard key={b.slug} company={b} />
              ))}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={goToPage} />
          </>
        )}
      </div>
    </div>
  );
}
