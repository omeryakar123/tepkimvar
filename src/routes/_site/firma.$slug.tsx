import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Building2,
  Clock,
  Globe,
  Pencil,
  Plus,
  Sparkles,
  Star,
  MessageSquare,
} from "lucide-react";
import { BrandProfileComplaintCard, BrandAvatar } from "@/components/cards";
import {
  formatRating,
  formatResponseTime,
  type Company,
  type Complaint,
} from "@/lib/mock-data";
import {
  fetchBrandBySlug,
  fetchComplaintsPaged,
  BRAND_PROFILE_COMPLAINTS_LIMIT,
  type DbBrand,
} from "@/lib/data";
import { displayResolutionRate, displayResponseMinutes } from "@/lib/display-brand-metrics";
import { proxyImage } from "@/lib/img";
import { Pagination } from "@/components/pagination";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { BrandVerifyModal } from "@/components/brand-verify-modal";
import { seoHead, jsonLd, breadcrumbLd, clamp, absUrl } from "@/lib/seo";

export const Route = createFileRoute("/_site/firma/$slug")({
  // SSR: marka verisi sunucuda yüklenir (arama motorları gerçek içeriği görür).
  loader: async ({ params }) => {
    const [brand, complaints] = await Promise.all([
      fetchBrandBySlug(params.slug).catch(() => null),
      fetchComplaintsPaged({
        brandSlug: params.slug,
        page: 1,
        pageSize: BRAND_PROFILE_COMPLAINTS_LIMIT,
      }).catch(() => ({
        items: [] as Complaint[],
        total: 0,
        page: 1,
        pageSize: BRAND_PROFILE_COMPLAINTS_LIMIT,
      })),
    ]);
    return { brand, complaints };
  },
  head: ({ loaderData, params }) => {
    const b = loaderData?.brand;
    const path = `/firma/${params.slug}`;
    if (!b) {
      return seoHead({
        title: "Firma bulunamadı — tepkimvar",
        description: "Aradığınız firma bulunamadı.",
        path,
        noindex: true,
      });
    }
    const c = b.company;
    const title = `${c.name} Şikayetleri ve Çözümleri — tepkimvar`;
    const description = clamp(
      b.raw.seo_description ??
        (c.about
          ? c.about
          : `${c.name} hakkında ${c.totalComplaints} müşteri şikayeti, marka yanıtları ve %${c.resolutionRate} çözüm oranı.`),
      155,
    );

    return {
      ...seoHead({ title, description, path, image: c.logoUrl ?? undefined }),
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: c.name,
          url: absUrl(path),
          ...(c.logoUrl
            ? {
                logo: c.logoUrl.startsWith("http")
                  ? c.logoUrl
                  : absUrl(c.logoUrl),
              }
            : {}),
          ...(c.website ? { sameAs: [c.website] } : {}),
          ...(c.about ? { description: clamp(c.about, 300) } : {}),
          // aggregateRating yalnızca GERÇEK oy varsa yayınlanır. Oy sayısı
          // şikayet sayısından türetilmez; ikisi farklı şeylerdir.
          ...((b.raw.rating_count ?? 0) > 0 && c.rating > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: c.rating,
                  bestRating: 5,
                  worstRating: 1,
                  ratingCount: b.raw.rating_count,
                },
              }
            : {}),
        }),
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Markalar", path: "/markalar" },
          { name: c.name, path },
        ]),
      ],
    };
  },
  component: CompanyPage,
});

const tabs = ["Hakkında", "Şikayetler", "Galeri", "İletişim"] as const;

function CompanyPage() {
  const { slug } = Route.useParams();
  const loaded = Route.useLoaderData();
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");
  const [company, setCompany] = useState<Company | null>(
    loaded?.brand?.company ?? null,
  );
  const [raw, setRaw] = useState<DbBrand | null>(loaded?.brand?.raw ?? null);
  const [complaints, setComplaints] = useState<Complaint[]>(
    loaded?.complaints?.items ?? [],
  );
  const [tab, setTab] = useState<(typeof tabs)[number]>("Şikayetler");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(loaded?.complaints?.total ?? 0);
  const [canReplyAsBrand, setCanReplyAsBrand] = useState(false);
  const resolutionDisplay = raw
    ? displayResolutionRate(
        raw.slug,
        raw.resolution_rate,
        raw.total_complaints,
        raw.complaints_resolved,
      )
    : company
      ? displayResolutionRate(company.slug, company.resolutionRate, company.totalComplaints, undefined)
      : 0;
  const responseDisplay = raw
    ? displayResponseMinutes(raw.slug, raw.avg_response_minutes)
    : 0;
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetchBrandBySlug(slug);
    if (!r) return;
    setCompany(r.company);
    setRaw(r.raw);
  }
  useEffect(() => {
    setPage(1);
    load(); /* eslint-disable-next-line */
  }, [slug, user?.id]);

  useEffect(() => {
    if (!user || !raw?.id) {
      setCanReplyAsBrand(false);
      return;
    }
    fetch("/api/brand/memberships", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((j: { memberships?: { brand_id: string }[] }) => {
        setCanReplyAsBrand(!!j.memberships?.some((m) => m.brand_id === raw.id));
      })
      .catch(() => setCanReplyAsBrand(false));
  }, [user?.id, raw?.id]);

  const reloadComplaints = () => {
    fetchComplaintsPaged({
      brandSlug: slug,
      page,
      pageSize: BRAND_PROFILE_COMPLAINTS_LIMIT,
    }).then((r) => {
      setComplaints(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    reloadComplaints(); /* eslint-disable-next-line */
  }, [slug, page]);

  async function messageBrand() {
    if (!user) { toast.error("Mesaj için giriş yapın"); navigate({ to: "/login" }); return; }
    if (!raw) return;
    const res = await fetch("/api/conversations", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: raw.id }),
    });
    if (!res.ok) { toast.error("Yazışma başlatılamadı"); return; }
    navigate({ to: "/profile", search: { sekme: "mesajlar" } });
  }

  async function uploadBrandImage(file: File, kind: "logo" | "cover") {
    if (!raw) return;
    if (!isAdmin) {
      toast.error("Yetkiniz yok");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece görsel yükleyin");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Maks. 8 MB");
      return;
    }
    const folder = kind === "logo" ? "brand-logos" : "brand-covers";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    fd.append("brandId", raw.id);
    const up = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const uj = (await up.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!up.ok || !uj.url) return toast.error(uj.error ?? "Yükleme başarısız");

    const field = kind === "logo" ? "logo_url" : "cover_url";
    const res = await fetch(`/api/admin/brands/${raw.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: uj.url }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(j.error ?? "Güncellenemedi");
    }
    toast.success(`${kind === "logo" ? "Logo" : "Kapak"} güncellendi`);
    load();
  }

  if (!company || !raw) {
    return (
      <div>
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-navy-mid">
          Yükleniyor…
        </div>
      </div>
    );
  }

  const resolved = raw.complaints_resolved ?? 0;
  const pending = raw.complaints_pending ?? 0;
  const gallery: string[] = Array.isArray(raw.gallery) ? raw.gallery : [];

  return (
    <div>
      <div className="h-40 sm:h-56 bg-gradient-to-br from-brand/80 via-brand to-dark/70 relative overflow-hidden">
        {raw.cover_url && (
          <img
            src={proxyImage(raw.cover_url) ?? raw.cover_url}
            alt=""
            className="absolute inset-0 size-full object-cover "
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20" />
        {isAdmin && (
          <>
            <button
              onClick={() => coverInput.current?.click()}
              aria-label="Kapak görselini değiştir"
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-card/90 backdrop-blur text-ink text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-card shadow"
            >
              <Pencil className="size-3.5" /> Kapağı değiştir
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files?.[0] &&
                uploadBrandImage(e.target.files[0], "cover")
              }
            />
          </>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-5 sm:p-6 mt-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative shrink-0">
              <BrandAvatar
                name={company.name}
                slug={raw.slug}
                logoUrl={raw.logo_url}
                website={raw.website}
                size={104}
                className="ring-4 ring-white outline outline-1 -outline-offset-1 outline-black/5 shadow-sm"
              />
              {isAdmin && (
                <>
                  <button
                    onClick={() => logoInput.current?.click()}
                    aria-label="Logoyu değiştir"
                    className="absolute -bottom-1 -right-1 bg-brand text-brand-foreground rounded-full p-1.5 shadow ring-2 ring-white hover:brightness-110"
                    title="Logoyu değiştir"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      uploadBrandImage(e.target.files[0], "logo")
                    }
                  />
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {company.name}{" "}
                  <span className="text-navy-mid font-normal text-lg">
                    — Şikayet ve Çözümleri
                  </span>
                </h1>
                {company.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info-soft text-[11px] font-medium text-info ring-1 ring-inset ring-info/10">
                    <BadgeCheck className="size-3" /> Doğrulanmış
                  </span>
                )}
                {company.premium && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-soft text-[11px] font-medium text-warning ring-1 ring-inset ring-warning/10">
                    <Sparkles className="size-3" /> Premium
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-mid">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3" /> {company.categoryName}
                </span>
                {company.website && (
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-brand"
                  >
                    <Globe className="size-3" /> {company.website}
                  </a>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(raw.rating_count ?? 0) > 0 ? (
                  <>
                    <div className="flex items-center gap-0.5" aria-label="Şikayet bazlı ortalama puan">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`size-5 ${Math.round(raw.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-navy-mid/40"}`}
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-navy-mid">
                      {formatRating(raw.rating, raw.rating_count)} / 5 · {raw.rating_count} şikayet puanı
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-navy-mid">
                    Henüz şikayet bazlı puan yok — puanlar yalnızca şikayet sonuçlarından hesaplanır
                  </span>
                )}
                {!company.verified && (
                  <span className="text-[11px] text-warning">Doğrulanmamış</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isAdmin && (
                <Link
                  to="/admin/firma/$id"
                  params={{ id: raw.id }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink px-3 py-2 rounded-lg ring-1 ring-rule hover:bg-surface"
                >
                  <Pencil className="size-4" /> Yönet
                </Link>
              )}
              {!company.verified && (
                <button
                  onClick={() => setVerifyOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-info px-3 py-2 rounded-lg ring-1 ring-info/30 hover:bg-info-soft transition-colors"
                >
                  <BadgeCheck className="size-4" /> Doğrulanmış Firma Başvurusu
                </button>
              )}
              <button
                onClick={() => toast.success("Takip edildi")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-navy px-3 py-2 rounded-lg ring-1 ring-rule hover:bg-surface transition-colors"
              >
                <Bell className="size-4" /> Takip Et
              </button>
              <Link
                to="/sikayet-yaz"
                search={{ brand: slug } as never}
                className="inline-flex items-center gap-1.5 bg-brand text-brand-foreground text-sm font-medium px-3 py-2 rounded-lg ring-1 ring-brand/20 hover:ring-brand/40 transition-all"
              >
                <Plus className="size-4" strokeWidth={2.5} /> Şikayet Oluştur
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                label: "Puan",
                value: formatRating(raw.rating, raw.rating_count),
                tone: "text-brand",
              },
              {
                label: "Toplam",
                value: (raw.total_complaints ?? 0).toLocaleString("tr-TR"),
              },
              {
                label: "Çözüldü",
                value: resolved.toLocaleString("tr-TR"),
                tone: "text-success",
              },
              {
                label: "Bekleyen",
                value: pending.toLocaleString("tr-TR"),
                tone: "text-warning",
              },
              {
                label: "Ort. Yanıt",
                value: formatResponseTime(raw.avg_response_minutes),
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface/60 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-navy-mid font-semibold">
                  {s.label}
                </p>
                <p className={`text-base font-semibold ${s.tone ?? ""}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-b border-rule flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t ? "border-brand text-dark" : "border-transparent text-navy-mid hover:text-dark"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 pb-12">
          <div className="lg:col-span-2 space-y-4">
            {tab === "Hakkında" && (
              <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
                <h2 className="text-base font-semibold mb-3">Hakkında</h2>
                <p className="text-sm text-navy leading-relaxed whitespace-pre-line">
                  {raw.about || "Bu firma henüz hakkında bilgisi eklemedi."}
                </p>
              </div>
            )}
            {tab === "Şikayetler" &&
              (complaints.length > 0 ? (
                <>
                  <p className="text-[13px] text-navy-mid mb-2">
                    Son {Math.min(BRAND_PROFILE_COMPLAINTS_LIMIT, complaints.length)} şikayet
                    {total > BRAND_PROFILE_COMPLAINTS_LIMIT
                      ? ` (${total.toLocaleString("tr-TR")} toplam)`
                      : ""}
                  </p>
                  {complaints.map((c) => (
                    <BrandProfileComplaintCard
                      key={c.id}
                      complaint={c}
                      canReply={canReplyAsBrand}
                      onReplied={reloadComplaints}
                    />
                  ))}
                  {total > BRAND_PROFILE_COMPLAINTS_LIMIT && (
                    <Pagination
                      page={page}
                      pageSize={BRAND_PROFILE_COMPLAINTS_LIMIT}
                      total={total}
                      onChange={setPage}
                    />
                  )}
                </>
              ) : (
                <div className="bg-card rounded-2xl ring-1 ring-rule p-8 text-center text-sm text-navy-mid">
                  Henüz şikayet yok.
                </div>
              ))}
            {tab === "Galeri" &&
              (gallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gallery.map((g, i) => (
                    <img
                      key={i}
                      src={g}
                      alt=""
                      className="w-full aspect-square object-cover rounded-2xl"
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-2xl ring-1 ring-rule p-8 text-center text-sm text-navy-mid">
                  Henüz galeri içeriği yok.
                </div>
              ))}
            {tab === "İletişim" && (
              <div className="bg-card rounded-2xl ring-1 ring-rule p-6 space-y-3 text-sm">
                <button
                  onClick={messageBrand}
                  className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:bg-brand-hover transition"
                >
                  <MessageSquare className="size-4" /> Firmaya Mesaj Gönder
                </button>
                <div className="h-px bg-rule my-1" />
                {raw.phone && (
                  <div>
                    <span className="text-navy-mid">Telefon: </span>
                    {raw.phone}
                  </div>
                )}
                {raw.email && (
                  <div>
                    <span className="text-navy-mid">E-posta: </span>
                    {raw.email}
                  </div>
                )}
                {raw.address && (
                  <div>
                    <span className="text-navy-mid">Adres: </span>
                    {raw.address}
                  </div>
                )}
                {raw.socials && Object.keys(raw.socials).length > 0 && (
                  <div className="flex gap-3 pt-2">
                    {Object.entries(raw.socials).map(([k, v]) => (
                      <a
                        key={k}
                        href={String(v)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        {k}
                      </a>
                    ))}
                  </div>
                )}
                {!raw.phone && !raw.email && !raw.address && (
                  <div className="text-navy-mid">
                    İletişim bilgisi eklenmemiş.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                <Clock className="size-4 text-navy-mid" /> Performans
              </h2>
              <div className="space-y-3 text-sm">
                <Row
                  label="Çözüm oranı"
                  value={`%${resolutionDisplay}`}
                  tone="brand"
                />
                <Row
                  label="Ortalama yanıt süresi"
                  value={formatResponseTime(responseDisplay)}
                />
                <Row
                  label="Toplam şikayet"
                  value={(raw.total_complaints ?? 0).toLocaleString("tr-TR")}
                />
                <Row
                  label="Toplam oy"
                  value={(raw.rating_count ?? 0).toLocaleString("tr-TR")}
                />
              </div>
            </div>

            <Link
              to="/kategori/$slug"
              params={{ slug: company.category }}
              className="block bg-ink text-paper dark:bg-surface dark:text-ink rounded-2xl p-5 hover:brightness-110 transition-all"
            >
              <h2 className="text-sm font-semibold mb-1">
                {company.categoryName} kategorisini keşfet
              </h2>
              <p className="text-xs text-navy-mid">
                Aynı sektördeki diğer firmaları karşılaştırın.
              </p>
            </Link>
          </div>
        </div>
      </div>

      <BrandVerifyModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        brandId={raw.id}
        defaultCompanyName={company.name}
      />
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-mid text-xs">{label}</span>
      <span
        className={`font-semibold ${tone === "brand" ? "text-brand" : "text-dark"}`}
      >
        {value}
      </span>
    </div>
  );
}
