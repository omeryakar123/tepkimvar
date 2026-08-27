import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Eye, MessageSquare, ChevronRight, Clock, Star, Send, Building2 } from "lucide-react";
import type { Company, Complaint } from "@/lib/mock-data";
import { formatCompactCount, formatRating, formatResponseTime, statusClasses, statusLabel } from "@/lib/mock-data";
import { brandLogoUrl } from "@/lib/logo";
import { toast } from "sonner";

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
        params={{ id: complaint.id }}
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

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-rule text-[12px] text-navy-mid">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> {complaint.views.toLocaleString("tr-TR")}</span>
          <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {complaint.comments}</span>
        </div>
        <Link to="/sikayet/$id" params={{ id: complaint.id }} className="text-brand hover:underline text-[12px] font-medium">
          Detayı gör →
        </Link>
      </div>
    </article>
  );
}

export function BrandAvatar({
  name, slug, logoUrl, website, size = 48, rounded = "rounded-xl",
}: { name: string; slug: string; logoUrl?: string | null; website?: string | null; size?: number; rounded?: string }) {
  const src = brandLogoUrl({ logoUrl, website, size: size * 2 });
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className={`shrink-0 ${rounded} overflow-hidden ring-1 ring-rule bg-card grid place-items-center`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="w-full h-full object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className={`w-full h-full grid place-items-center font-bold text-[13px] ${avatarFor(slug)}`}>{initials}</span>
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
          <div className="font-bold text-lg leading-none text-ink">{formatRating(company.rating, company.ratingCount)}</div>
          <div className="text-[10px] uppercase tracking-wider text-navy-mid mt-1">
            {company.ratingCount > 0 ? `${company.ratingCount} oy` : "puan yok"}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-navy-mid">Çözüm</div>
          <div className="font-bold text-[13px] mt-0.5 text-brand tabular-nums">%{company.resolutionRate}</div>
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
      <Link
        to="/sikayet/$id"
        params={{ id: complaint.id }}
        className="group flex items-start gap-3 py-3 border-b border-rule last:border-0"
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
    );
  }
  return (
    <Link
      to="/sikayet/$id"
      params={{ id: complaint.id }}
      className="group flex flex-col rounded-2xl bg-paper border border-rule hover:border-brand/40 hover:shadow-pop transition-all p-5"
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
      <p className="text-[13px] text-navy line-clamp-2 leading-relaxed mb-5 flex-1">{complaint.body}</p>

      <div className="flex items-center justify-between pt-4 border-t border-rule text-[12px] text-navy-mid">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> {complaint.views.toLocaleString("tr-TR")}</span>
          <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {complaint.comments}</span>
          {complaint.rating ? (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <Star className="size-3.5 fill-amber-400" /> {complaint.rating}
            </span>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {complaint.createdAgo}</span>
      </div>
    </Link>
  );
}
