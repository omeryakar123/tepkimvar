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
  Star,
  FileText,
  Eye,
  Users,
} from "lucide-react";
import { formatRating, type Company, type Complaint } from "@/lib/mock-data";
import {
  fetchBrandsList,
  fetchCategoriesWithCount,
  fetchHomeAgenda,
  fetchHomeTalked,
  fetchLiveFeed,
  fetchPlatformStats,
} from "@/lib/data";
import { publicPlatformStats } from "@/lib/public-stats";
import { BrandAvatar } from "@/components/cards";
import { LiveFeed } from "@/components/live-feed";
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
        fetchBrandsList({ limit: 10, sortBy: "complaints" }).catch(() => [] as Company[]),
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
          logo: absUrl("/tepkim1.jpg"),
          sameAs: ["https://t.me/tepkimvarplus"],
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
  const [trend100, setTrend100] = useState<Company[]>(loaderData.trendBrands ?? []);
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
        fetchBrandsList({ limit: 10, sortBy: "complaints" }),
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
    <div className="min-h-screen bg-paper">
      {/* Top announcement bar */}
      <div className="bg-ink text-paper/85 dark:bg-surface dark:text-navy text-[12.5px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-9 flex items-center justify-between">
          <span>
            Toplam çözülen şikayet:{" "}
            <b className="text-brand tabular-nums">
              {stats.resolvedComplaints.toLocaleString("tr-TR")}
            </b>
          </span>
          <Link
            to="/markalar"
            className="text-paper/55 dark:text-navy-mid hover:text-brand transition-colors text-[12px] sm:text-[12.5px]"
          >
            Alışverişten önce marka skorunu sorgula →
          </Link>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden md:hero-glow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16 lg:py-24 grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-16 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-3 h-7 text-[12px] font-semibold ring-1 ring-brand/15">
              <ShieldCheck className="size-3.5" />
              Bağımsız şikayet platformu
            </span>

            <h1 className="mt-5 font-display font-black text-[32px] sm:text-[58px] lg:text-[64px] leading-[1.02] tracking-[-0.03em] text-ink">
              Sesini duyur,
              <br />
              <span className="text-gradient-brand">çözümü takip et.</span>
            </h1>

            <p className="mt-5 text-[16px] leading-relaxed text-navy max-w-lg">
              Markalar hakkındaki gerçek deneyimleri keşfet, şikayetini paylaş,
              firmalardan resmi yanıt al. Her adım şeffaf ve takip edilebilir.
            </p>

            <form onSubmit={doSearch} className="mt-6 sm:mt-8 max-w-xl">
              <div className="flex items-center bg-card rounded-full shadow-pop ring-1 ring-rule pl-4 sm:pl-5 pr-1.5 h-12 sm:h-14 focus-within:ring-2 focus-within:ring-brand/40 transition">
                <Search className="size-5 text-navy-mid shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Marka, model, ürün ara…"
                  className="flex-1 bg-transparent border-0 px-2 sm:px-3 text-[14px] sm:text-[15px] text-ink placeholder:text-navy-mid focus:outline-none min-w-0"
                />
                <button className="shrink-0 rounded-full bg-brand text-brand-foreground px-5 sm:px-8 h-9 sm:h-11 text-[13px] sm:text-[14px] font-semibold hover:bg-brand-hover transition">
                  Ara
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[12.5px] text-navy">
              <span className="font-semibold text-navy-mid">Popüler:</span>
              {["Trendyol", "Turkcell", "Papara", "Getir", "Migros"].map(
                (t) => (
                  <a
                    key={t}
                    href={`/arama?q=${encodeURIComponent(t)}`}
                    className="hover:text-brand transition-colors"
                  >
                    {t}
                  </a>
                ),
              )}
            </div>

            {/* Gerçek verilerden güven şeridi */}
            <dl className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              {[
                { v: stats.totalComplaints, l: "şikayet" },
                { v: stats.totalCompanies, l: "marka" },
                {
                  v: Math.round(stats.resolutionRate),
                  l: "% çözüm oranı",
                  raw: true,
                },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="font-display text-[26px] font-black text-ink tabular-nums leading-none">
                    {s.raw ? `%${s.v}` : s.v.toLocaleString("tr-TR")}
                  </dt>
                  <dd className="mt-1 text-[12px] text-navy-mid">
                    {s.raw ? "çözüm oranı" : s.l}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Mobil canlı akış — masaüstünde sağ kolonda */}
            <div className="mt-8 lg:hidden">
              <LiveFeed items={featured} loading={feedLoading} compact updatedAt={lastFeedAt} />
            </div>
          </div>

          {/* Canlı akış — masaüstü */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 rounded-[32px] bg-brand/5 blur-2xl" aria-hidden />
            <LiveFeed items={featured} loading={feedLoading} updatedAt={lastFeedAt} />
          </div>
        </div>
      </section>

      {/* GÜNDEMDEKİ ŞİKAYETLER */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
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
                <Link
                  key={c.id}
                  to="/sikayet/$id"
                  params={{ id: c.id }}
                  className="block h-full bg-card rounded-2xl p-4 ring-1 ring-rule/50"
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
              ))}
            </MobileCarousel>
          </div>

          {/* Masaüstü: grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
            {agenda.map((c) => (
              <Link
                key={c.id}
                to="/sikayet/$id"
                params={{ id: c.id }}
                className="bg-card rounded-2xl p-5 hover:shadow-pop transition ring-1 ring-rule/50 flex gap-3"
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
            ))}
          </div>
        </div>
      </section>

      {/* ÇOK KONUŞULANLAR */}
      <section className="relative bg-surface border-y border-rule overflow-hidden">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-card/10" />
        <div className="absolute -left-24 bottom-0 size-48 rounded-full bg-brand/30" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16 relative">
          <h2 className="font-display font-bold text-[20px] sm:text-[22px] text-ink mb-5 sm:mb-6">
            Çok Konuşulanlar
          </h2>

          <div className="md:hidden">
            <MobileCarousel slideClassName="w-[88vw] max-w-[340px] snap-start shrink-0" ariaLabel="Çok konuşulan şikayetler">
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
      <section className="bg-ink text-paper dark:bg-surface dark:text-ink">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="font-display font-bold text-[26px]">
              Çözüm Başarısı
            </h2>
            <p className="mt-2 text-paper/60 dark:text-navy-mid text-[13px]">
              Şikayet çözüm oranı en yüksek markaların güncel listesi.
            </p>
          </div>
          <div className="max-w-3xl mx-auto bg-card text-ink rounded-2xl overflow-hidden">
            {top.map((b, i) => (
              <Link
                key={b.slug}
                to="/firma/$slug"
                params={{ slug: b.slug }}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-surface transition ${i > 0 ? "border-t border-rule" : ""}`}
              >
                <span className="grid place-items-center size-8 rounded-full bg-surface text-navy font-bold text-[13px] tabular-nums">
                  {i + 1}
                </span>
                <BrandAvatar name={b.name} slug={b.slug} logoUrl={b.logoUrl} website={b.website} size={40} rounded="rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate">
                    {b.name}
                  </div>
                  <div className="text-[11.5px] text-navy-mid">
                    {b.categoryName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-brand tabular-nums">
                    %{b.resolutionRate.toFixed(0)}
                  </div>
                  <div className="text-[10.5px] text-navy-mid">çözüm</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ÖDÜLLER — split banner */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-brand mb-3">
              <Award className="size-4" /> tepkimvar Ödülleri
            </div>
            <h2 className="font-display font-black text-[32px] text-ink leading-tight tracking-tight">
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
          <div className="relative h-56 sm:h-64 md:h-72">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent-purple to-brand overflow-hidden p-3 sm:p-4">
              <img
                src="/dogrulama-rozeti.jpg"
                alt="Doğrulanmış marka rozeti — QR kod ile firma inceleme, müşteri memnuniyeti puanı"
                className="w-full h-full object-contain rounded-2xl shadow-lift"
                loading="lazy"
              />
            </div>
            <div className="absolute -top-6 -right-6 size-24 rounded-full bg-accent-yellow pointer-events-none" aria-hidden />
            <div className="absolute -bottom-4 -left-4 size-16 rounded-full bg-brand pointer-events-none" aria-hidden />
          </div>
        </div>
      </section>

      {/* SAYILARLA */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="text-center font-display font-bold text-[24px] text-ink mb-10">
            Sayılarla tepkimvar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  className="bg-card rounded-2xl p-6 ring-1 ring-rule"
                >
                  <span className="grid place-items-center size-10 rounded-xl bg-brand-soft text-brand mb-4">
                    <Icon className="size-5" />
                  </span>
                  <div className="font-display font-black text-[26px] text-ink tabular-nums">
                    {s.v.toLocaleString("tr-TR")}
                  </div>
                  <div className="text-[12px] text-navy-mid mt-1">{s.k}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TREND 100 */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="font-display font-black text-[24px] sm:text-[28px] text-ink inline-flex items-center gap-2">
              Trend<span className="text-brand">100</span>
            </h2>
            <p className="mt-1 text-[13px] text-navy-mid">Son 7 günün en çok konuşulan markaları.</p>
          </div>

          {/* Mobil: swiper — tam liste yerine kaydırmalı */}
          <div className="md:hidden">
            <MobileCarousel slideClassName="w-[78vw] max-w-[320px] snap-start shrink-0" ariaLabel="Trend 100 markalar">
              {trend100.map((b, i) => (
                <Link
                  key={b.slug}
                  to="/firma/$slug"
                  params={{ slug: b.slug }}
                  className="block h-full bg-card rounded-2xl ring-1 ring-rule p-4 hover:shadow-pop transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-[13px] text-navy-mid font-bold tabular-nums shrink-0">{i + 1}.</span>
                    <BrandAvatar name={b.name} slug={b.slug} logoUrl={b.logoUrl} website={b.website} size={40} rounded="rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-ink leading-snug break-words">{b.name}</div>
                      <div className="text-[11px] text-navy-mid mt-0.5">{b.categoryName}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <TrendingUp className="inline size-4 text-brand mb-0.5" />
                      <div className="text-[13px] font-bold text-ink tabular-nums inline-flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {formatRating(b.rating, b.ratingCount)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </MobileCarousel>
          </div>

          {/* Masaüstü: tablo */}
          <div className="hidden md:block bg-card rounded-2xl overflow-hidden ring-1 ring-rule">
            <div className="grid grid-cols-[48px_1fr_120px_80px] gap-4 px-5 py-3 border-b border-rule text-[11px] uppercase tracking-wider text-navy-mid font-semibold">
              <span>#</span>
              <span>Marka</span>
              <span className="text-right">Trend</span>
              <span className="text-right">Puan</span>
            </div>
            {trend100.map((b, i) => (
              <Link
                key={b.slug}
                to="/firma/$slug"
                params={{ slug: b.slug }}
                className="grid grid-cols-[48px_1fr_120px_80px] items-center gap-4 px-5 py-3.5 border-b border-rule hover:bg-surface transition"
              >
                <span className="text-[13px] text-navy-mid tabular-nums">{i + 1}.</span>
                <div className="flex items-center gap-3 min-w-0">
                  <BrandAvatar name={b.name} slug={b.slug} logoUrl={b.logoUrl} website={b.website} size={32} rounded="rounded-md" />
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-ink truncate">{b.name}</div>
                    <div className="text-[11px] text-navy-mid truncate">{b.categoryName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <TrendingUp className="inline size-4 text-brand" />
                </div>
                <div className="text-right text-[13px] font-bold text-ink tabular-nums">
                  {formatRating(b.rating, b.ratingCount)}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 text-center">
            <Link
              to="/trendler"
              className="inline-flex items-center gap-2 rounded-full ring-1 ring-brand text-brand px-5 h-10 text-[13px] font-semibold hover:bg-brand-soft transition"
            >
              Devamını Gör
            </Link>
          </div>
        </div>
      </section>

      {/* PURPLE CTA — Tüketici deneyimi */}
      <section className="bg-ink text-paper dark:bg-surface dark:text-ink">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
          <h2 className="font-display font-bold text-[24px] leading-snug">
            Tüketici deneyimi, sizin markanız.
          </h2>
          <p className="mt-3 text-[13.5px] text-paper/85 dark:text-navy leading-relaxed">
            Müşteri geri bildirimlerini şeffafça yönetin, çözüm hızınızı artırın
            ve marka itibarınızı güçlendirin.
          </p>
          <Link
            to="/reklam-cozumleri"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-card text-accent-purple px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition"
          >
            Detaylı Bilgi Al
          </Link>
        </div>
      </section>

      {/* TEREDDÜT YOK — md ve üzerinde bölümün tamamını kaplayan görsel banner.
          Başlık/açıklama/buton görselin İÇİNDE yazılı; telefonda o yazılar
          okunamayacak kadar küçüldüğü için küçük ekranda metin sürümü gösterilir
          (metin DOM'da kaldığı için arama motorları her iki durumda da görür). */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="md:hidden">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-brand mb-2">
              <ShieldCheck className="size-4" /> Alışverişten Önce
            </div>
            <h2 className="font-display font-black text-[30px] text-ink leading-tight">
              Markanın skorunu sorgula.
            </h2>
            <p className="mt-3 text-[13.5px] text-navy leading-relaxed max-w-md">
              Satın alma kararından önce markanın çözüm oranını, yanıt hızını ve
              gerçek kullanıcı deneyimlerini görün.
            </p>
            <Link
              to="/markalar"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-11 text-[13px] font-semibold"
            >
              Tereddüt Yok, Sorgula <ArrowRight className="size-4" />
            </Link>
          </div>
          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.97 }
            }
            whileInView={
              reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: "spring", damping: 22, stiffness: 110 }}
            className="relative hidden md:block"
          >
            {/* Arka ışıma */}
            <div
              className="absolute inset-x-16 inset-y-6 rounded-full bg-brand/10 blur-3xl"
              aria-hidden
            />
            <Link
              to="/markalar"
              aria-label="Markanın skorunu sorgula — marka listesini aç"
              className="group relative block overflow-hidden rounded-3xl ring-1 ring-rule shadow-lift focus-visible:ring-2 focus-visible:ring-brand"
            >
              <img
                src="/tepkim1.jpg"
                alt="Alışverişten önce markanın skorunu sorgula: çözüm oranı, yanıt hızı ve gerçek kullanıcı deneyimleri"
                width={1024}
                height={504}
                className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
