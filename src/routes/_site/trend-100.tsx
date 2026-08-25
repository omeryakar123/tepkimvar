import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Star } from "lucide-react";
import { BrandAvatar } from "@/components/cards";
import { formatRating, type Company } from "@/lib/mock-data";
import { fetchBrandsList, fetchCategoriesWithCount } from "@/lib/data";

type Search = { kategori?: string };

export const Route = createFileRoute("/_site/trend-100")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    kategori: typeof s.kategori === "string" ? s.kategori : undefined,
  }),
  head: () => {
    const title = "Trend 100 — En Çok Konuşulan Markalar | tepkimvar.";
    const description = "Türkiye'nin en çok şikayet alan ve gündemde olan 100 markası. Kategoriye göre filtreleyin.";
    const url = "https://tepkimvar.lovable.app/trend-100";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Trend100Page,
});

function Trend100Page() {
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const [brands, setBrands] = useState<Company[]>([]);
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCategoriesWithCount().then((c) => setCats(c.map((x) => ({ slug: x.slug, name: x.name })))); }, []);

  useEffect(() => {
    setLoading(true);
    fetchBrandsList({ limit: 100, sortBy: "complaints", categorySlug: sp.kategori || undefined })
      .then(setBrands)
      .finally(() => setLoading(false));
  }, [sp.kategori]);

  return (
    <div>

      <section className="bg-gradient-to-br from-[oklch(0.22_0.02_262)] via-[oklch(0.3_0.04_265)] to-brand/40 text-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 h-7 rounded-full bg-card/10 backdrop-blur text-[11px] font-semibold uppercase tracking-widest">
            <TrendingUp className="size-3.5" /> Gündem sıralaması
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-display font-black tracking-tight">Trend 100</h1>
          <p className="mt-2 text-white/70 max-w-2xl">Son 30 günün en çok şikayet alan, en çok konuşulan markaları. Otomatik olarak güncellenir.</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav({ search: {} })}
              className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition ${
                !sp.kategori ? "bg-card text-ink ring-white" : "bg-card/5 text-white/80 ring-white/20 hover:bg-card/10"
              }`}
            >
              Genel
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
          <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Bu kategoride sıralanacak marka yok.</div>
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
                    className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-brand-soft/40 transition"
                  >
                    <div className={`shrink-0 grid place-items-center size-10 rounded-xl font-black text-sm tabular-nums ${
                      rank === 1 ? "bg-warning-soft text-warning" :
                      rank === 2 ? "bg-surface text-navy" :
                      rank === 3 ? "bg-warning-soft text-warning" :
                      "bg-canvas text-navy-mid"
                    }`}>
                      {podium ? <Trophy className="size-4" /> : rank}
                    </div>
                    <BrandAvatar name={b.name} slug={b.slug} logoUrl={b.logoUrl} website={b.website} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink truncate">{b.name}</div>
                      <div className="text-xs text-navy-mid truncate">{b.category} · {b.totalComplaints.toLocaleString("tr-TR")} şikayet</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-sm font-semibold text-ink">
                      <Star className="size-4 text-amber-500 fill-amber-500" /> {formatRating(b.rating, b.ratingCount)}
                    </div>
                    <div className="hidden md:block text-xs text-navy-mid w-20 text-right">%{b.resolutionRate} çözüm</div>
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
