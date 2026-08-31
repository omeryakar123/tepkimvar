import { Link } from "@tanstack/react-router";
import { Eye, Flame, MessageSquare, TrendingUp, Users } from "lucide-react";
import { BrandListLogo } from "@/components/cards";
import {
  TREND_BADGE_LABEL,
  trendBadge,
  trendPrimaryReason,
  trendSecondaryDetail,
  type TrendBrand,
} from "@/lib/trend-brand";
import { formatCompactCount } from "@/lib/mock-data";

const BADGE_STYLE = {
  hot: "bg-danger/10 text-danger ring-danger/20",
  rising: "bg-brand-soft text-brand ring-brand/25",
  views: "bg-info-soft text-info ring-info/20",
  support: "bg-warning-soft text-warning ring-warning/25",
  active: "bg-surface text-navy-mid ring-rule",
} as const;

export function TrendBrandBadge({ brand, rank }: { brand: TrendBrand; rank: number }) {
  const badge = trendBadge(brand, rank);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${BADGE_STYLE[badge]}`}
    >
      {badge === "hot" ? <Flame className="size-3" /> : <TrendingUp className="size-3" />}
      {TREND_BADGE_LABEL[badge]}
    </span>
  );
}

export function TrendBrandMetrics({ brand, compact = false }: { brand: TrendBrand; compact?: boolean }) {
  const reason = trendPrimaryReason(brand);
  const detail = trendSecondaryDetail(brand);

  if (compact) {
    return (
      <div className="text-right min-w-0">
        <div className="text-[11px] font-semibold text-brand truncate">{reason}</div>
        {detail ? <div className="text-[10px] text-navy-mid truncate">{detail}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-navy-mid">
      {brand.recentComplaints > 0 ? (
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5 text-brand" />
          {formatCompactCount(brand.recentComplaints)} şikayet
        </span>
      ) : null}
      {brand.recentViews > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3.5" />
          {formatCompactCount(brand.recentViews)} okunma
        </span>
      ) : null}
      {brand.recentSupports > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" />
          {formatCompactCount(brand.recentSupports)} destek
        </span>
      ) : null}
      {!brand.recentComplaints && !brand.recentViews && !brand.recentSupports ? (
        <span>{reason}</span>
      ) : null}
    </div>
  );
}

export function TrendBrandRowInner({
  brand,
  rank,
  hideRank = false,
  showMetrics = true,
}: {
  brand: TrendBrand;
  rank: number;
  hideRank?: boolean;
  showMetrics?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
      {!hideRank ? (
        <span className="w-7 sm:w-8 text-[12px] sm:text-[13px] text-navy-mid font-bold tabular-nums shrink-0 text-center">
          {rank}.
        </span>
      ) : null}
      <BrandListLogo
        name={brand.name}
        slug={brand.slug}
        logoUrl={brand.logoUrl}
        website={brand.website}
        size={52}
        className="group-hover:scale-[1.02] transition-transform shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[13px] sm:text-[14px] text-ink truncate">{brand.name}</span>
          <TrendBrandBadge brand={brand} rank={rank} />
        </div>
        <div className="text-[10.5px] sm:text-[11px] text-navy-mid truncate mt-0.5">{brand.categoryName}</div>
        {showMetrics ? (
          <div className="mt-1.5 hidden sm:block">
            <TrendBrandMetrics brand={brand} />
          </div>
        ) : null}
      </div>
      <div className="shrink-0 md:hidden">
        <TrendBrandMetrics brand={brand} compact />
      </div>
    </div>
  );
}

export function TrendBrandRow({
  brand,
  rank,
  showMetrics = true,
  hideRank = false,
  className = "",
}: {
  brand: TrendBrand;
  rank: number;
  showMetrics?: boolean;
  hideRank?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/firma/$slug"
      params={{ slug: brand.slug }}
      className={`flex items-center gap-3 sm:gap-4 min-w-0 group ${className}`}
    >
      <TrendBrandRowInner brand={brand} rank={rank} hideRank={hideRank} showMetrics={showMetrics} />
    </Link>
  );
}
