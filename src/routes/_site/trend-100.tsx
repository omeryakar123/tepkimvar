import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import { fetchBrandsTrend, fetchCategoriesWithCount } from "@/lib/data";
import type { TrendBrand } from "@/lib/trend-brand";
import { TrendBrandMetrics, TrendBrandRowInner } from "@/components/trend-brand-row";
import { seoHead } from "@/lib/seo";

type Search = { kategori?: string };

export const Route = createFileRoute("/_site/trend-100")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    kategori: typeof s.kategori === "string" ? s.kategori : undefined,
  }),
  loader: async ({ location }) => {
    const kategori = new URLSearchParams(location.searchStr).get("kategori") ?? undefined;
    const brands = await fetchBrandsTrend({ limit: 100, categorySlug: kategori }).catch(() => [] as TrendBrand[]);
    return { brands };
  },
  head: () =>
    seoHead({
      title: "Trend 100 — Son 7 Günün En Çok Konuşulan Markaları | tepkimvar",
      description:
        "Son 7 günde en çok yeni şikayet, okunma ve topluluk desteği alan markalar. Gerçek veriden hesaplanan gündem sıralaması.",
      path: "/trend-100",
    }),
  component: Trend100Page,
});

function Trend100Page() {
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const loaderBrands = Route.useLoaderData().brands;
  const [brands, setBrands] = useState<TrendBrand[]>(loaderBrands);
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategoriesWithCount().then((c) => setCats(c.map((x) => ({ slug: x.slug, name: x.name }))));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBrandsTrend({ limit: 100, categorySlug: sp.kategori || undefined })
      .then(setBrands)
      .finally(() => setLoading(false));
  }, [sp.kategori]);

  return (
    <div>
      <section className="bg-gradient-to-br from-[oklch(0.22_0.02_262)] via-[oklch(0.3_0.04_265)] to-brand/40 text-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 h-7 rounded-full bg-card/10 backdrop-blur text-[11px] font-semibold uppercase tracking-widest">
            <TrendingUp className="size-3.5" /> Son 7 gün · gerçek veri
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-display font-black tracking-tight">Trend 100</h1>
          <p className="mt-2 text-white/70 max-w-2xl leading-relaxed">
            Sıralama; yeni şikayet sayısı, okunma ve topluluk desteğine göre hesaplanır. Geçen haftaya göre
            artış gösteren markalar &quot;Yükselişte&quot; rozeti alır.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav({ search: {} })}
              className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition ${
                !sp.kategori ? "bg-card text-ink ring-white" : "bg-card/5 text-white/80 ring-white/20 hover:bg-card/10"
              }`}
            >
              Tümü
            </button>
            {cats.map((c) => {
              const active = sp.kategori === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => nav({ search: { kategori: c.slug } })}
                  className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition ${
                    active ? "bg-card text-ink ring-white" : "bg-card/5 text-white/80 ring-white/20 hover:bg-card/10"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        {loading ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Yükleniyor…</div>
        ) : brands.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">
            Bu kategoride son 7 günde yeterli aktivite yok.
          </div>
        ) : (
          <ol className="bg-card rounded-2xl ring-1 ring-rule divide-y divide-rule overflow-hidden">
            {brands.map((b, i) => {
              const rank = i + 1;
              const podium = rank <= 3;
              return (
                <li key={b.slug}>
                  <Link
                    to="/firma/$slug"
                    params={{ slug: b.slug }}
                    className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-brand-soft/40 transition group ${podium ? "bg-brand-soft/15" : ""}`}
                  >
                    <div
                      className={`shrink-0 grid place-items-center size-10 rounded-xl font-black text-sm tabular-nums ${
                        rank === 1
                          ? "bg-warning-soft text-warning"
                          : rank === 2
                            ? "bg-surface text-navy"
                            : rank === 3
                              ? "bg-warning-soft text-warning"
                              : "bg-canvas text-navy-mid"
                      }`}
                    >
                      {podium ? <Trophy className="size-4" /> : rank}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <TrendBrandRowInner brand={b} rank={rank} hideRank showMetrics />
                    </div>
                    <div className="hidden md:block shrink-0 w-44">
                      <TrendBrandMetrics brand={b} compact />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
