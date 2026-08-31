import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { seoHead, jsonLd, absUrl } from "@/lib/seo";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Search,
  TrendingUp,
  MessageCircle,
  Award,
  ShieldCheck,
  FileText,
  Eye,
  Users,
} from "lucide-react";
import { formatRating, type Company, type Complaint } from "@/lib/mock-data";
import { formatResolutionRate } from "@/lib/display-brand-metrics";
import {
  fetchBrandsList,
  fetchBrandsTrend,
  fetchCategoriesWithCount,
  fetchHomeAgenda,
  fetchHomeTalked,
  fetchLiveFeed,
  fetchPlatformStats,
} from "@/lib/data";
import type { TrendBrand } from "@/lib/trend-brand";
import { TrendBrandMetrics, TrendBrandMobileCard, TrendBrandRowInner } from "@/components/trend-brand-row";
import { PRIORITY_BRAND_LINKS } from "@/lib/featured-brands";
import { publicPlatformStats } from "@/lib/public-stats";
import { SITE_CONTACT_EMAIL, siteContactMailto } from "@/lib/contact";
import { BrandRankLogo } from "@/components/cards";
import { LiveFeed } from "@/components/live-feed";
import { ComplaintSupportButton } from "@/components/complaint-support-button";
import { MobileCarousel } from "@/components/mobile-carousel";

/** Canlı akış yenileme aralığı (30 dk). */
const HOME_REFRESH_MS = 30 * 60 * 1000;

const FALLBACK_STATS = publicPlatformStats({
  totalUsers: 0,
  totalCompanies: 0,
  totalComplaints: 0,
  resolvedComplaints: 0,
  resolutionRate: 0,
});

export const Route = createFileRoute("/_site/")({
  loader: async () => {
    const [liveFeed, agenda, talked, categories, platformStats, topBrands, trendBrands] =
      await Promise.all([
        fetchLiveFeed({ limit: 6 }).catch(() => [] as Complaint[]),
        fetchHomeAgenda({ limit: 6 }).catch(() => [] as Complaint[]),
        fetchHomeTalked({ limit: 4 }).catch(() => [] as Complaint[]),
        fetchCategoriesWithCount().catch(() => []),
        fetchPlatformStats().catch(() => FALLBACK_STATS),
        fetchBrandsList({ limit: 5, sortBy: "resolution" }).catch(() => [] as Company[]),
        fetchBrandsTrend({ limit: 10 }).catch(() => [] as TrendBrand[]),
      ]);
    return { latest: liveFeed, agenda, talked, categories, stats: platformStats, topBrands, trendBrands };
  },
  head: () => {
    const base = seoHead({
      title: "tepkimvar — Şikayetini Yaz, Firmadan Resmi Yanıt Al",
      description:
        "Türkiye'nin bağımsız şikayet platformu. Marka ve hizmetler hakkındaki gerçek deneyimleri keşfet, şikayetini paylaş, firmalardan resmi yanıt ve çözüm al.",
      path: "/",
    });
    return {
      ...base,
      scripts: [
        // Organization + WebSite şemaları: Google'da site adı/logo ve
        // sitelinks arama kutusu için.
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "tepkimvar",
          url: absUrl("/"),
          logo: absUrl("/tepkim-hero.png"),
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: SITE_CONTACT_EMAIL,
          },
        }),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "tepkimvar",
          url: absUrl("/"),
          potentialAction: {
            "@type": "SearchAction",
            target: `${absUrl("/arama")}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      ],
    };
  },
  component: Home,
});

function Home() {
  const loaderData = Route.useLoaderData();
  const [featured, setFeatured] = useState<Complaint[]>(loaderData.latest ?? []);
  const [agenda, setAgenda] = useState<Complaint[]>(loaderData.agenda ?? []);
  const [talked, setTalked] = useState<Complaint[]>(loaderData.talked ?? []);
  const [top, setTop] = useState<Company[]>(loaderData.topBrands ?? []);
  const [trend100, setTrend100] = useState<TrendBrand[]>(loaderData.trendBrands ?? []);
  const [stats, setStats] = useState(loaderData.stats ?? FALLBACK_STATS);
  const [feedLoading, setFeedLoading] = useState(false);
  const [lastFeedAt, setLastFeedAt] = useState<Date>(() => new Date());
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      setFeedLoading(true);
      const results = await Promise.allSettled([
        fetchLiveFeed({ limit: 6 }),
        fetchHomeAgenda({ limit: 6 }),
        fetchHomeTalked({ limit: 4 }),
        fetchBrandsList({ limit: 5, sortBy: "resolution" }),
        fetchBrandsTrend({ limit: 10 }),
        fetchPlatformStats(),
      ]);

      if (cancelled) return;

      const [recentR, agendaR, talkedR, topR, trendR, statsR] = results;
      if (recentR.status === "fulfilled") setFeatured(recentR.value);
      if (agendaR.status === "fulfilled") setAgenda(agendaR.value);
      if (talkedR.status === "fulfilled") setTalked(talkedR.value);
      if (topR.status === "fulfilled") setTop(topR.value);
      if (trendR.status === "fulfilled") setTrend100(trendR.value);
      if (statsR.status === "fulfilled") setStats(statsR.value);
      else setStats(FALLBACK_STATS);

      setLastFeedAt(new Date());
      if (!cancelled) setFeedLoading(false);
    }

    loadHomeData();
    const timer = window.setInterval(loadHomeData, HOME_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    // Router ile gezin: tam sayfa yenileme yok (SPA korunur).
    navigate({ to: "/arama", search: { q } });
  }

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* Top announcement bar */}
      <div className="bg-media text-media-foreground/85 text-[11px] sm:text-[12.5px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 min-h-9 py-1.5 sm:py-0 sm:h-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-3">
          <span className="leading-snug">
            Toplam çözülen şikayet:{" "}
            <b className="text-brand tabular-nums">
              {stats.resolvedComplaints.toLocaleString("tr-TR")}
            </b>
          </span>
          <Link
            to="/markalar"
            className="text-media-foreground/55 hover:text-brand transition-colors text-[11px] sm:text-[12.5px] leading-snug shrink-0"
          >
            <span className="sm:hidden">Marka skoru sorgula →</span>
            <span className="hidden sm:inline">Alışverişten önce marka skorunu sorgula →</span>
          </Link>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden md:hero-glow">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-16 lg:py-24 box-border">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6 sm:gap-8 lg:gap-16 items-start lg:items-center min-w-0 w-full">
          <div className="animate-fade-up min-w-0 w-full max-w-full">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand px-2.5 h-6 sm:h-7 text-[10px] sm:text-[12px] font-semibold ring-1 ring-brand/15 max-w-full">
              <ShieldCheck className="size-3 shrink-0" />
              <span className="truncate">Bağımsız şikayet platformu</span>
            </span>

            <h1 className="mt-3 sm:mt-5 font-display font-black text-[1.65rem] leading-[1.08] sm:text-[58px] lg:text-[64px] sm:leading-[1.02] tracking-[-0.03em] text-ink">
              Sesini duyur,
              <br />
              <span className="text-gradient-brand">çözümü takip et.</span>
            </h1>

            <p className="mt-3 sm:mt-5 text-[14px] sm:text-[16px] leading-relaxed text-navy max-w-lg">
              Markalar hakkındaki gerçek deneyimleri keşfet, şikayetini paylaş,
              firmalardan resmi yanıt al.
            </p>

            {/* Arama — mobil: dikey, tablet+: pill */}
            <form onSubmit={doSearch} className="mt-4 sm:mt-8 w-full max-w-full sm:max-w-xl box-border">
              <div className="sm:hidden w-full space-y-2">
                <div className="flex items-center gap-2 h-11 px-3 w-full rounded-xl bg-card ring-1 ring-rule box-border">
                  <Search className="size-4 text-navy-mid shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Marka veya ürün ara…"
                    className="flex-1 min-w-0 w-0 bg-transparent border-0 text-[14px] text-ink placeholder:text-navy-mid focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand-hover transition"
                >
                  Ara
                </button>
              </div>
              <div className="hidden sm:flex items-center w-full max-w-xl h-14 bg-card rounded-full shadow-pop ring-1 ring-rule pl-5 pr-1.5 focus-within:ring-2 focus-within:ring-brand/40 transition box-border">
                <Search className="size-5 text-navy-mid shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Marka, model, ürün ara…"
                  className="flex-1 min-w-0 bg-transparent border-0 px-3 text-[15px] text-ink placeholder:text-navy-mid focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-brand text-brand-foreground px-8 h-11 text-[14px] font-semibold hover:bg-brand-hover transition"
                >
                  Ara
                </button>
              </div>
            </form>

            {/* Popüler markalar — mobilde yatay kaydırma */}
            <div className="mt-3 sm:mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex sm:flex-wrap items-center gap-x-3 gap-y-1 w-max sm:w-auto text-[11px] sm:text-[12.5px] text-navy pb-0.5 sm:pb-0">
                <span className="font-semibold text-navy-mid shrink-0">Popüler:</span>
                {PRIORITY_BRAND_LINKS.slice(0, 6).map((b) => (
                  <Link
                    key={b.slug}
                    to="/firma/$slug"
                    params={{ slug: b.slug }}
                    className="hover:text-brand transition-colors whitespace-nowrap shrink-0"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>

            <dl className="mt-6 sm:mt-10 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
              {[
                { v: stats.totalComplaints, l: "şikayet" },
                { v: stats.totalCompanies, l: "marka" },
                {
                  v: Math.round(stats.resolutionRate),
                  l: "çözüm oranı",
                  raw: true,
                },
              ].map((s) => (
                <div key={s.l} className="min-w-0 text-center sm:text-left">
                  <dt className="font-display text-[18px] sm:text-[26px] font-black text-ink tabular-nums leading-none">
                    {s.raw ? `%${s.v}` : s.v.toLocaleString("tr-TR")}
                  </dt>
                  <dd className="mt-0.5 sm:mt-1 text-[10px] sm:text-[12px] text-navy-mid leading-tight">
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Mobil canlı akış */}
            <div className="mt-5 sm:mt-8 lg:hidden w-full max-w-full box-border">
              <LiveFeed items={featured} loading={feedLoading} compact updatedAt={lastFeedAt} />
            </div>
          </div>

          {/* Canlı akış — masaüstü */}
          <div className="relative hidden lg:block min-w-0">
            <div className="absolute -inset-6 rounded-[32px] bg-brand/5 blur-2xl pointer-events-none" aria-hidden />
            <LiveFeed items={featured} loading={feedLoading} updatedAt={lastFeedAt} />
          </div>
          </div>
        </div>
      </section>

      {/* GÜNDEMDEKİ ŞİKAYETLER */}
      <section className="bg-surface overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-14 min-w-0">
          <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
            <h2 className="font-display font-bold text-[20px] sm:text-[22px] text-ink">
              Gündemdeki Şikayetler
            </h2>
            <Link to="/sikayetler" className="text-[12px] font-semibold text-brand hover:underline shrink-0">
              Tümü
            </Link>
          </div>

          {/* Mobil: yatay carousel */}
          <div className="md:hidden">
            <MobileCarousel ariaLabel="Gündemdeki şikayetler">
              {agenda.map((c) => (
                <article
                  key={c.id}
                  className="h-full bg-card rounded-2xl p-4 ring-1 ring-rule/50 flex flex-col"
                >
                  <Link
                    to="/sikayet/$id"
                    params={{ id: c.id }}
                    className="block flex-1"
                  >
                    <div className="flex gap-3">
                      <div className="size-9 rounded-full bg-accent-purple text-paper grid place-items-center text-[12px] font-bold shrink-0">
                        {c.userInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] text-navy-mid">
                          <b className="text-ink">{c.userName}</b>
                          <span className="text-brand"> · {c.companyName}</span>
                        </div>
                        <p className="mt-1.5 text-[13px] text-navy line-clamp-3 leading-relaxed">{c.title}</p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3">
                    <ComplaintSupportButton
                      complaintId={c.id}
                      initialVotes={c.votes}
                      initialSupported={c.supported}
                      size="sm"
                    />
                  </div>
                </article>
              ))}
            </MobileCarousel>
          </div>

          {/* Masaüstü: grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
            {agenda.map((c) => (
              <article
                key={c.id}
                className="bg-card rounded-2xl p-5 ring-1 ring-rule/50 flex flex-col"
              >
                <Link
                  to="/sikayet/$id"
                  params={{ id: c.id }}
                  className="flex gap-3 flex-1 hover:opacity-95 transition"
                >
                  <div className="size-9 rounded-full bg-accent-purple text-paper grid place-items-center text-[12px] font-bold shrink-0">
                    {c.userInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] text-navy-mid">
                      <b className="text-ink">{c.userName}</b> ·{" "}
                      <span className="text-brand">{c.companyName}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-navy line-clamp-3 leading-relaxed">{c.title}</p>
                  </div>
                </Link>
                <div className="mt-4">
                  <ComplaintSupportButton
                    complaintId={c.id}
                    initialVotes={c.votes}
                    initialSupported={c.supported}
                    size="sm"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ÇOK KONUŞULANLAR */}
      <section className="relative bg-surface border-y border-rule overflow-hidden">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-card/10 pointer-events-none" aria-hidden />
        <div className="absolute -left-24 bottom-0 size-48 rounded-full bg-brand/30 pointer-events-none" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-16 relative min-w-0">
          <h2 className="font-display font-bold text-[20px] sm:text-[22px] text-ink mb-5 sm:mb-6">
            Çok Konuşulanlar
          </h2>

          <div className="md:hidden">
            <MobileCarousel ariaLabel="Çok konuşulan şikayetler">
              {talked.map((c) => (
                <Link
                  key={c.id}
                  to="/sikayet/$id"
                  params={{ id: c.id }}
                  className="block h-full bg-card rounded-2xl p-5 ring-1 ring-rule/40"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-10 rounded-full bg-accent-purple text-paper grid place-items-center font-bold text-[13px]">
                      {c.userInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] text-ink truncate">{c.userName}</div>
                      <div className="text-[11px] text-navy-mid">{c.createdAgo}</div>
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-[16px] text-ink mb-2 line-clamp-2">{c.title}</h3>
                  <p className="text-[13px] text-navy line-clamp-3 leading-relaxed">{c.body}</p>
                  {c.previewComments && c.previewComments.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-rule pt-3">
                      {c.previewComments.map((cm, i) => (
                        <li key={i} className="text-[12px] text-navy leading-snug">
                          <span className="font-semibold text-ink">{cm.userName}</span>
                          <span className="text-navy-mid"> · {cm.createdAgo}</span>
                          <p className="mt-0.5 line-clamp-2">{cm.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 text-[12px] font-semibold text-brand truncate">▸ {c.companyName}</div>
                </Link>
              ))}
            </MobileCarousel>
          </div>

          <div className="hidden md:grid grid-cols-2 gap-4">
            {talked.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                to="/sikayet/$id"
                params={{ id: c.id }}
                className="bg-card rounded-2xl p-6 hover:shadow-pop transition ring-1 ring-rule/40"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-full bg-accent-purple text-paper grid place-items-center font-bold text-[13px]">
                    {c.userInitials}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] text-ink">{c.userName}</div>
                    <div className="text-[11px] text-navy-mid">{c.createdAgo}</div>
                  </div>
                </div>
                <h3 className="font-display font-bold text-[17px] text-ink mb-2 line-clamp-2">{c.title}</h3>
                <p className="text-[13px] text-navy line-clamp-3 leading-relaxed">{c.body}</p>
                {c.previewComments && c.previewComments.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-rule pt-3">
                    {c.previewComments.map((cm, i) => (
                      <li key={i} className="text-[12px] text-navy leading-snug">
                        <span className="font-semibold text-ink">{cm.userName}</span>
                        <span className="text-navy-mid"> · {cm.createdAgo}</span>
                        <p className="mt-0.5 line-clamp-2">{cm.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-[12px] font-semibold text-brand">▸ {c.companyName}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ÇÖZÜM BAŞARISI */}
      <section className="bg-media text-media-foreground overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16 min-w-0">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="font-display font-bold text-[22px] sm:text-[26px]">
              Çözüm Başarısı
            </h2>
            <p className="mt-2 text-media-foreground/60 text-[12px] sm:text-[13px] px-2">
              Şikayet çözüm oranı en yüksek markaların güncel listesi.
            </p>
          </div>
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden bg-white/[0.05] ring-1 ring-white/10">
            {top.map((b, i) => (
              <Link
                key={b.slug}
                to="/firma/$slug"
                params={{ slug: b.slug }}
                className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3.5 sm:py-4 hover:bg-white/[0.06] transition ${i > 0 ? "border-t border-white/10" : ""}`}
              >
                <span className="grid place-items-center size-8 sm:size-9 rounded-full bg-white/10 text-media-foreground font-bold text-[12px] sm:text-[13px] tabular-nums shrink-0">
                  {i + 1}
                </span>
                <BrandRankLogo
                  name={b.name}
                  slug={b.slug}
                  logoUrl={b.logoUrl}
                  website={b.website}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] sm:text-[14px] truncate">
                    {b.name}
                  </div>
                  <div className="text-[10.5px] sm:text-[11.5px] text-media-foreground/55 truncate">
                    {b.categoryName}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] sm:text-[13px] font-bold text-brand tabular-nums">
                    {formatResolutionRate(b.resolutionRate, b.totalComplaints)}
                  </div>
                  <div className="text-[9.5px] sm:text-[10.5px] text-media-foreground/55">çözüm</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ÖDÜLLER — split banner */}
      <section className="bg-paper border-y border-rule overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-16 grid md:grid-cols-2 gap-6 sm:gap-10 items-center min-w-0">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-brand mb-3">
              <Award className="size-4 shrink-0" /> tepkimvar Ödülleri
            </div>
            <h2 className="font-display font-black text-[22px] sm:text-[32px] text-ink leading-tight tracking-tight">
              Çözüme değer verenler ödüllendirilir.
            </h2>
            <p className="mt-3 text-[14px] text-navy leading-relaxed max-w-md">
              Her yıl, en yüksek çözüm oranına sahip markaları ve en hızlı yanıt
              veren firmaları tepkimvar Ödülleri ile taçlandırıyoruz.
            </p>
            <Link
              to="/markalar"
              search={{ dogrulanmis: true }}
              className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-brand hover:gap-3 transition-all"
            >
              Detaylı incele <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="relative w-full max-w-[320px] sm:max-w-[380px] md:max-w-[420px] lg:max-w-[460px] mx-auto md:ml-auto md:mr-0 mt-4 md:mt-0">
            <div
              className="relative overflow-hidden rounded-2xl p-1.5 bg-gradient-to-br from-media via-[oklch(0.22_0.025_262)] to-brand/30 shadow-lift ring-1 ring-white/10 hero-glow"
            >
              <div className="overflow-hidden rounded-[14px] ring-1 ring-white/10">
                <img
                  src="/dogrulama-rozeti.jpg"
                  alt="Doğrulanmış marka rozeti — QR kod ile firma inceleme, müşteri memnuniyeti puanı"
                  width={1024}
                  height={494}
                  className="block w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 size-10 sm:size-14 rounded-full bg-brand/25 blur-sm pointer-events-none z-0" aria-hidden />
            <div className="absolute -bottom-2 -left-2 sm:-bottom-3 sm:-left-3 size-8 sm:size-11 rounded-full bg-accent-purple/25 blur-sm pointer-events-none z-0" aria-hidden />
          </div>
        </div>
      </section>

      {/* SAYILARLA */}
      <section className="overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16 min-w-0">
          <h2 className="text-center font-display font-bold text-[20px] sm:text-[24px] text-ink mb-6 sm:mb-10">
            Sayılarla tepkimvar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              // Hepsi gerçek veriden; uydurma sayı yok.
              { k: "Üye Sayısı", v: stats.totalUsers, i: Users },
              { k: "Şikayet Sayısı", v: stats.totalComplaints, i: FileText },
              { k: "Kayıtlı Marka", v: stats.totalCompanies, i: MessageCircle },
              { k: "Çözülen Şikayet", v: stats.resolvedComplaints, i: Eye },
            ].map((s) => {
              const Icon = s.i;
              return (
                <div
                  key={s.k}
                  className="bg-card rounded-2xl p-4 sm:p-6 ring-1 ring-rule min-w-0"
                >
                  <span className="grid place-items-center size-9 sm:size-10 rounded-xl bg-brand-soft text-brand mb-3 sm:mb-4">
                    <Icon className="size-4 sm:size-5" />
                  </span>
                  <div className="font-display font-black text-[20px] sm:text-[26px] text-ink tabular-nums break-all">
                    {s.v.toLocaleString("tr-TR")}
                  </div>
                  <div className="text-[11px] sm:text-[12px] text-navy-mid mt-1 leading-snug">{s.k}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TREND 100 */}
      <section className="bg-surface overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-16 min-w-0">
          <div className="text-center mb-5 sm:mb-8">
            <h2 className="font-display font-black text-[22px] sm:text-[28px] text-ink inline-flex items-center gap-2">
              Trend<span className="text-brand">100</span>
            </h2>
            <p className="mt-1 text-[12px] sm:text-[13px] text-navy-mid px-2 max-w-lg mx-auto">
              Son 7 günde en çok yeni şikayet, okunma ve topluluk desteği alan markalar — gerçek veriden hesaplanır.
            </p>
          </div>

          {/* Mobil: dikey liste — metinler üst üste binmez */}
          <div className="md:hidden space-y-2.5">
            {trend100.slice(0, 6).map((b, i) => (
              <TrendBrandMobileCard key={b.slug} brand={b} rank={i + 1} />
            ))}
          </div>

          {/* Masaüstü: tablo */}
          <div className="hidden md:block bg-card rounded-2xl overflow-hidden ring-1 ring-rule">
            <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(140px,200px)] gap-4 px-5 py-3 border-b border-rule text-[11px] uppercase tracking-wider text-navy-mid font-semibold">
              <span>#</span>
              <span>Marka</span>
              <span className="text-right">Son 7 gün</span>
            </div>
            {trend100.map((b, i) => (
              <Link
                key={b.slug}
                to="/firma/$slug"
                params={{ slug: b.slug }}
                className={`grid grid-cols-[40px_minmax(0,1fr)_minmax(140px,200px)] items-center gap-4 px-5 py-3.5 border-b border-rule last:border-0 hover:bg-surface/80 transition group ${i < 3 ? "bg-brand-soft/20" : ""}`}
              >
                <span className="text-[13px] text-navy-mid tabular-nums font-bold">{i + 1}.</span>
                <TrendBrandRowInner brand={b} rank={i + 1} hideRank showMetrics={false} />
                <TrendBrandMetrics brand={b} compact />
              </Link>
            ))}
          </div>

          <div className="mt-5 text-center">
            <Link
              to="/trend-100"
              className="inline-flex items-center gap-2 rounded-full ring-1 ring-brand text-brand px-5 h-10 text-[13px] font-semibold hover:bg-brand-soft transition"
            >
              Devamını Gör
            </Link>
          </div>
        </div>
      </section>

      {/* Pro + KEŞFET — site-cta-* sabit koyu gradyan (ink/paper yok) */}
      <section className="relative overflow-hidden site-cta-shell">
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-[min(520px,70vw)] rounded-full bg-brand/18 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 size-80 rounded-full bg-accent-purple/18 blur-3xl"
          aria-hidden
        />

        {/* Pro CTA */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-10 min-w-0">
          <div className="max-w-3xl mx-auto text-center">
            <span className="site-cta-badge mb-4 sm:mb-5 mx-auto">
              <ShieldCheck className="size-3.5 shrink-0" />
              tepkimvar Pro
            </span>
            <h2 className="font-display font-bold text-[20px] sm:text-[28px] leading-snug px-1 text-white">
              tepkimvar Pro ile müşteri tabanınızı büyütün
            </h2>
            <p className="mt-3 text-[13px] sm:text-[14px] site-cta-muted max-w-md mx-auto leading-relaxed px-1">
              Çözüm sunan markalar arasına katılın; Pro üyelik avantajlarından yararlanın.
            </p>
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center px-1">
              <a
                href={siteContactMailto("Pro üyelik")}
                className="site-cta-btn w-full sm:w-auto"
              >
                Pro üyelik için iletişim
              </a>
              <Link
                to="/register/marka-basvuru"
                className="site-cta-btn-ghost w-full sm:w-auto"
              >
                Marka başvurusu yap
              </Link>
            </div>
          </div>
        </div>

        {/* KEŞFET & PAYLAŞ */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-10 sm:pb-16 min-w-0">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="grid md:grid-cols-2 gap-4 sm:gap-5 md:items-stretch"
          >
            {/* Keşfet */}
            <div className="site-cta-panel flex flex-col h-full rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 lg:p-9 min-w-0">
              <div className="site-cta-panel-shine" aria-hidden />
              <div className="relative flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 mb-5 sm:mb-6">
                <span className="font-display font-black text-[18px] sm:text-[19px] tracking-tight text-white">
                  tepkimvar<span className="site-cta-accent">.</span>
                </span>
                <span className="hidden sm:block h-4 w-px site-cta-divider shrink-0" aria-hidden />
                <span className="text-[11px] sm:text-[12px] font-medium site-cta-muted leading-snug">
                  Web sitemizi keşfedin:{" "}
                  <span className="site-cta-accent font-semibold">tepkimvar.com</span>
                </span>
              </div>

              <h2 className="relative font-display font-black text-[24px] sm:text-[34px] lg:text-[38px] leading-[1.06] tracking-[-0.03em] text-white">
                Sesini duyur,
                <br />
                <span className="site-cta-gradient-text">çözümü takip et!</span>
              </h2>

              <p className="relative mt-3 sm:mt-4 text-[13px] sm:text-[14px] leading-relaxed site-cta-muted max-w-md">
                Alışverişten önce marka skorunu sorgula; çözüm oranı, yanıt hızı ve
                gerçek kullanıcı deneyimlerini gör.
              </p>

              <Link
                to="/markalar"
                className="relative mt-6 sm:mt-auto sm:pt-8 site-cta-btn w-full sm:w-fit"
              >
                Tereddüt yok, sorgula
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            </div>

            {/* Paylaş */}
            <div className="site-cta-panel flex flex-col h-full rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 lg:p-9 min-w-0">
              <div className="site-cta-panel-shine" aria-hidden />
              <div className="relative flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 mb-5 sm:mb-6">
                <span className="site-cta-badge w-fit">
                  <MessageCircle className="size-3.5 shrink-0" />
                  Topluluk
                </span>
                <span className="hidden sm:block h-4 w-px site-cta-divider shrink-0" aria-hidden />
                <span className="text-[11px] sm:text-[12px] font-medium site-cta-muted">
                  Deneyimini paylaş
                </span>
              </div>

              <h2 className="relative font-display font-black text-[24px] sm:text-[34px] lg:text-[38px] leading-[1.06] tracking-[-0.03em] text-white">
                Deneyimini
                <br />
                <span className="site-cta-gradient-text">paylaş!</span>
              </h2>

              <p className="relative mt-3 sm:mt-4 text-[13px] sm:text-[14px] leading-relaxed site-cta-muted max-w-md">
                Kullandığın siteler hakkında gerçek deneyimini anlat. Yorumunu bırak,
                başkalarının doğru karar vermesine yardımcı ol.
              </p>

              <Link
                to="/sikayet-yaz"
                className="relative mt-6 sm:mt-auto sm:pt-8 site-cta-btn w-full sm:w-fit"
              >
                Şikayetini yaz
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
