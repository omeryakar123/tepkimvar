import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Eye, MessageSquare, ChevronRight, Clock, Star, Send, Building2 } from "lucide-react";
import type { Company, Complaint } from "@/lib/mock-data";
import { displayComplaintViews } from "@/lib/display-views";
import { formatCompactCount, formatRating, formatResponseTime, statusClasses, statusLabel } from "@/lib/mock-data";
import { formatResolutionRate } from "@/lib/display-brand-metrics";
import { proxyImage } from "@/lib/img";
import { brandLogoCandidates, logoFetchSize } from "@/lib/logo";
import { ComplaintSupportButton } from "@/components/complaint-support-button";
import { complaintLinkId } from "@/lib/complaint-link";

const avatarPalette = [
  "bg-[oklch(0.78_0.13_158)] text-white",
  "bg-[oklch(0.72_0.16_285)] text-white",
  "bg-[oklch(0.82_0.15_92)] text-ink",
  "bg-[oklch(0.72_0.15_30)] text-white",
  "bg-[oklch(0.7_0.13_220)] text-white",
  "bg-[oklch(0.78_0.13_340)] text-white",
];

function avatarFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}

/** Şikayet sonucu yıldızları (1–5). */
export function ComplaintStarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  const stars = Math.max(1, Math.min(5, Math.round(rating)));
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div className="inline-flex items-center gap-1.5" aria-label={`${stars} yıldız`}>
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${icon} ${n <= stars ? "fill-amber-400 text-amber-400" : "text-navy-mid/30"}`}
          />
        ))}
      </div>
      <span className={`font-semibold text-amber-600 ${size === "sm" ? "text-[12px]" : "text-[13px]"}`}>
        {stars}/5
      </span>
    </div>
  );
}

/** Firma profil sayfası: yıldız üstte, firma yanıtı ve (yetkili ise) yanıt alanı. */
export function BrandProfileComplaintCard({
  complaint,
  canReply,
  onReplied,
}: {
  complaint: Complaint;
  canReply?: boolean;
  onReplied?: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    const res = await fetch("/api/brand/complaints", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId: complaint.id, body: reply.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Yanıt gönderilemedi");
      return;
    }
    toast.success("Yanıt gönderildi");
    setReply("");
    onReplied?.();
  }

  return (
    <article className="flex flex-col rounded-2xl bg-paper border border-rule p-5">
      {complaint.rating != null && complaint.rating > 0 ? (
        <div className="mb-4 pb-3 border-b border-rule">
          <p className="text-[10px] uppercase tracking-wider text-navy-mid font-semibold mb-1.5">
            Şikayet sonucu puanı
          </p>
          <ComplaintStarRating rating={complaint.rating} />
        </div>
      ) : null}

      <div className="flex items-center gap-3 mb-3">
        <div className={`size-10 shrink-0 rounded-full grid place-items-center font-bold text-[12px] ${avatarFor(complaint.userInitials)}`}>
          {complaint.userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-ink truncate">{complaint.userName}</div>
          <div className="text-[11px] text-navy-mid">{complaint.createdAgo}</div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${statusClasses(complaint.status)}`}
        >
          {statusLabel[complaint.status]}
        </span>
      </div>

      <Link
        to="/sikayet/$id"
        params={{ id: complaintLinkId(complaint) }}
        className="group block"
      >
        <h4 className="font-semibold text-[16px] leading-snug text-ink mb-2 line-clamp-2 group-hover:text-brand transition-colors">
          {complaint.title}
        </h4>
        <p className="text-[13px] text-navy line-clamp-3 leading-relaxed">{complaint.body}</p>
      </Link>

      {complaint.companyReply ? (
        <div className="mt-4 rounded-xl bg-brand-soft/50 ring-1 ring-brand/15 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-brand mb-2">
            <Building2 className="size-3.5" />
            Firma yanıtı
            {complaint.companyReply.agoLabel ? (
              <span className="font-normal text-navy-mid">· {complaint.companyReply.agoLabel}</span>
            ) : null}
          </div>
          <p className="text-[13px] text-navy leading-relaxed whitespace-pre-wrap">
            {complaint.companyReply.body}
          </p>
        </div>
      ) : canReply ? (
        <form onSubmit={sendReply} className="mt-4 space-y-2">
          <label className="text-[11px] font-semibold text-navy-mid uppercase tracking-wider">
            Firma yanıtı yazın
          </label>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Müşteriye yanıtınız…"
            className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 h-9 text-[13px] font-semibold hover:brightness-105 disabled:opacity-60"
          >
            <Send className="size-3.5" /> Yanıtla
          </button>
        </form>
      ) : (
        <p className="mt-4 text-[12px] text-navy-mid italic">Henüz firma yanıtı yok.</p>
      )}

      <div className="mt-4">
        <ComplaintSupportButton
          complaintId={complaint.id}
          initialVotes={complaint.votes}
          initialSupported={complaint.supported}
          size="sm"
        />
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-rule text-[12px] text-navy-mid">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> {displayComplaintViews(complaint.id, complaint.views).toLocaleString("tr-TR")}</span>
          <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {complaint.comments}</span>
        </div>
        <Link to="/sikayet/$id" params={{ id: complaintLinkId(complaint) }} className="text-brand hover:underline text-[12px] font-medium">
          Detayı gör →
        </Link>
      </div>
    </article>
  );
}

export function BrandLogoImage({
  name,
  slug,
  logoUrl,
  website,
  size = 112,
  className = "",
}: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <BrandAvatar
      name={name}
      slug={slug}
      logoUrl={logoUrl}
      website={website}
      size={size}
      rounded="rounded-xl"
      className={className}
    />
  );
}

function listLogoCandidates(opts: BrandLogoOpts) {
  return brandLogoCandidates(opts);
}

function resolveLogoSrc(url: string) {
  if (url.startsWith("/")) return proxyImage(url) ?? url;
  if (url.startsWith("http")) return proxyImage(url) ?? url;
  return url;
}

type BrandLogoOpts = { logoUrl?: string | null; website?: string | null; slug?: string | null; size?: number };

/** Liste / tablo satırları — beyaz halka yok, kare-yuvarlak, logo tam oturur. */
export function BrandListLogo({
  name,
  slug,
  logoUrl,
  website,
  size = 52,
  className = "",
}: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
  className?: string;
}) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const px = logoFetchSize(size);
  const candidates = listLogoCandidates({ logoUrl, website, slug, size: px });
  const src = candidates[candidateIdx] ?? null;
  const initials = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    setCandidateIdx(0);
  }, [slug, logoUrl, website]);

  return (
    <div
      className={`relative shrink-0 rounded-xl overflow-hidden grid place-items-center ${src ? "" : "ring-1 ring-rule/60 bg-surface"} ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={resolveLogoSrc(src)}
          alt={name}
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-1"
          onError={() => setCandidateIdx((i) => i + 1)}
        />
      ) : (
        <span className={`size-full grid place-items-center font-bold text-[12px] ${avatarFor(slug)}`}>
          {initials}
        </span>
      )}
    </div>
  );
}

export function BrandRankLogo({
  name,
  slug,
  logoUrl,
  website,
  className = "",
}: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  className?: string;
}) {
  return (
    <BrandListLogo
      name={name}
      slug={slug}
      logoUrl={logoUrl}
      website={website}
      size={56}
      className={className}
    />
  );
}

export function BrandAvatar({
  name,
  slug,
  logoUrl,
  website,
  size = 48,
  rounded = "rounded-xl",
  tone = "light",
  className = "",
}: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
  rounded?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const px = logoFetchSize(size);
  const candidates = listLogoCandidates({ logoUrl, website, slug, size: px });
  const src = candidates[candidateIdx] ?? null;
  const initials = name.slice(0, 2).toUpperCase();
  const shell = src
    ? ""
    : tone === "dark"
      ? "ring-white/15 bg-white/[0.92]"
      : "ring-1 ring-rule/60 bg-surface";

  useEffect(() => {
    setCandidateIdx(0);
  }, [slug, logoUrl, website]);

  return (
    <div
      className={`relative shrink-0 aspect-square ${rounded} overflow-hidden ${shell} grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={resolveLogoSrc(src)}
          alt={name}
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-1"
          onError={() => setCandidateIdx((i) => i + 1)}
        />
      ) : (
        <span className={`w-full h-full grid place-items-center font-bold text-[13px] ${avatarFor(slug)}`}>
          {initials}
        </span>
      )}
    </div>
  );
}

export function CompanyCard({ company }: { company: Company }) {
  return (
    <Link
      to="/firma/$slug"
      params={{ slug: company.slug }}
      className="group block rounded-2xl bg-paper border border-rule hover:border-brand/40 hover:shadow-pop transition-all p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <BrandAvatar name={company.name} slug={company.slug} logoUrl={company.logoUrl} website={company.website} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-[15px] truncate text-ink">{company.name}</h3>
            {company.verified && <BadgeCheck className="size-4 text-brand shrink-0" />}
          </div>
          <p className="text-[12px] text-navy-mid">{company.categoryName}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-0.5 justify-end mb-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`size-3 ${n <= Math.round(company.rating) && company.ratingCount > 0 ? "fill-amber-400 text-amber-400" : "text-navy-mid/25"}`}
              />
            ))}
          </div>
          <div className="font-bold text-lg leading-none text-ink">{formatRating(company.rating, company.ratingCount)}</div>
          <div className="text-[10px] uppercase tracking-wider text-navy-mid mt-1">
            {company.ratingCount > 0 ? `${company.ratingCount} oy` : "puan yok"}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-navy-mid">Çözüm</div>
          <div className="font-bold text-[13px] mt-0.5 text-brand tabular-nums">
            {formatResolutionRate(company.resolutionRate, company.totalComplaints)}
          </div>
        </div>
        <div className="border-x border-rule">
          <div className="text-[10px] uppercase tracking-wider text-navy-mid">Şikayet</div>
          <div className="font-bold text-[13px] mt-0.5 tabular-nums">{formatCompactCount(company.totalComplaints)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-navy-mid">Yanıt</div>
          <div className="font-bold text-[13px] mt-0.5 tabular-nums">{formatResponseTime(company.avgResponseMinutes)}</div>
        </div>
      </div>
    </Link>
  );
}

export function ComplaintCard({ complaint, variant = "default" }: { complaint: Complaint; variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <article className="py-3 border-b border-rule last:border-0">
        <Link
          to="/sikayet/$id"
          params={{ id: complaintLinkId(complaint) }}
          className="group flex items-start gap-3"
        >
          <div className={`size-9 shrink-0 rounded-full grid place-items-center font-bold text-[11px] ${avatarFor(complaint.userInitials)}`}>
            {complaint.userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-navy-mid mb-0.5">
              <span className="font-semibold text-brand">{complaint.companyName}</span>
              <span>·</span>
              <span>{complaint.createdAgo}</span>
            </div>
            <p className="text-[13px] font-medium text-ink line-clamp-2 leading-snug group-hover:text-brand transition-colors">
              {complaint.title}
            </p>
          </div>
        </Link>
        <div className="mt-2 pl-12">
          <ComplaintSupportButton
            complaintId={complaint.id}
            initialVotes={complaint.votes}
            initialSupported={complaint.supported}
            size="sm"
          />
        </div>
      </article>
    );
  }
  return (
    <article className="flex flex-col rounded-2xl bg-paper border border-rule hover:border-brand/40 hover:shadow-pop transition-all">
      <Link
        to="/sikayet/$id"
        params={{ id: complaintLinkId(complaint) }}
        className="group flex flex-col flex-1 p-5 pb-3"
      >
      <div className="flex items-center gap-3 mb-4">
        <div className={`size-10 shrink-0 rounded-full grid place-items-center font-bold text-[12px] ${avatarFor(complaint.userInitials)}`}>
          {complaint.userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-ink truncate">{complaint.userName}</div>
          <div className="text-[11px] text-navy-mid">{complaint.createdAgo}</div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${statusClasses(complaint.status)}`}
        >
          {statusLabel[complaint.status]}
        </span>
      </div>

      <div className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full bg-brand-soft text-brand px-2.5 py-1 text-[11px] font-semibold">
        <ChevronRight className="size-3" />
        {complaint.companyName}
        <span className="text-brand/60">/</span>
        <span className="font-medium">{complaint.categoryName}</span>
      </div>

      <h4 className="font-semibold text-[16px] leading-snug text-ink mb-2 line-clamp-2 group-hover:text-brand transition-colors">
        {complaint.title}
      </h4>
      <p className="text-[13px] text-navy line-clamp-2 leading-relaxed mb-3 flex-1">{complaint.body}</p>

      {complaint.rating != null && complaint.rating > 0 ? (
        <div className="mb-3">
          <ComplaintStarRating rating={complaint.rating} size="sm" />
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-4 border-t border-rule text-[12px] text-navy-mid">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> {complaint.views.toLocaleString("tr-TR")}</span>
          <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {complaint.comments}</span>
        </div>
        <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {complaint.createdAgo}</span>
      </div>
      </Link>
      <div className="px-5 pb-5 pt-2">
        <ComplaintSupportButton
          complaintId={complaint.id}
          initialVotes={complaint.votes}
          initialSupported={complaint.supported}
        />
      </div>
    </article>
  );
}
