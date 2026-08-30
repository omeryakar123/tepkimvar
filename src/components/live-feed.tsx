import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { Complaint } from "@/lib/mock-data";

type Props = {
  items: Complaint[];
  loading?: boolean;
  compact?: boolean;
  updatedAt?: Date;
  className?: string;
};

export function LiveFeed({ items, loading, compact, updatedAt, className = "" }: Props) {
  const list = items.slice(0, compact ? 3 : 4);

  return (
    <div
      className={`w-full max-w-full min-w-0 box-border overflow-hidden rounded-2xl bg-card ring-1 ring-rule ${
        compact ? "p-3 shadow-soft" : "card-surface shadow-lift p-3.5 sm:p-5"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-4 border-b border-rule min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand" />
          </span>
          <span className="text-[12px] sm:text-[13px] font-semibold text-ink truncate">Canlı akış</span>
          {updatedAt && (
            <span className="text-[10px] text-navy-mid tabular-nums shrink-0 sm:inline">
              {updatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <Link
          to="/sikayetler"
          className="text-[11px] sm:text-[12px] font-medium text-brand hover:underline shrink-0"
        >
          Tümü
        </Link>
      </div>

      <ul className="divide-y divide-rule min-w-0">
        {list.map((c) => (
          <li key={c.id} className={compact ? "py-2" : "py-3 sm:py-3.5"}>
            <Link
              to="/sikayet/$id"
              params={{ id: c.publicId ?? c.id }}
              className="group flex items-start gap-2.5 sm:gap-3 min-w-0 overflow-hidden"
            >
              <span
                className={`grid place-items-center shrink-0 rounded-full bg-brand-soft text-brand font-bold ${
                  compact ? "size-7 text-[9px]" : "size-8 sm:size-9 text-[10px] sm:text-[11px] mt-0.5"
                }`}
              >
                {c.userInitials}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="flex items-center gap-1 min-w-0 text-[10.5px] sm:text-[11.5px] text-navy-mid">
                  <span className="font-semibold text-brand truncate min-w-0">{c.companyName}</span>
                  <span className="shrink-0 text-navy-mid/80 text-[10px]">{c.createdAgo}</span>
                </span>
                <span
                  className={`mt-0.5 block font-medium text-ink group-hover:text-brand transition-colors leading-snug ${
                    compact
                      ? "text-[12px] line-clamp-2"
                      : "text-[12.5px] sm:text-[13.5px] truncate"
                  }`}
                >
                  {c.title}
                </span>
              </span>
              {c.companyReply && (
                <span
                  className={`shrink-0 self-center text-success ${
                    compact
                      ? "mt-0.5"
                      : "inline-flex items-center gap-1 rounded-full bg-success-soft px-2 h-6 text-[10.5px] font-bold"
                  }`}
                  title="Yanıtlandı"
                >
                  {compact ? (
                    <Check className="size-3.5" aria-label="Yanıt" />
                  ) : (
                    <>
                      <Check className="size-3" /> Yanıt
                    </>
                  )}
                </span>
              )}
            </Link>
          </li>
        ))}
        {loading &&
          list.length === 0 &&
          [0, 1, 2].map((i) => (
            <li key={i} className="py-2 flex gap-2.5 min-w-0">
              <span className="size-7 rounded-full skeleton shrink-0" />
              <span className="flex-1 min-w-0 space-y-2 py-0.5">
                <span className="block h-2.5 w-20 max-w-full skeleton" />
                <span className="block h-3 w-full skeleton" />
              </span>
            </li>
          ))}
        {!loading && list.length === 0 && (
          <li className="py-5 text-center text-[12px] sm:text-[13px] text-navy-mid">Henüz şikayet yok.</li>
        )}
      </ul>
    </div>
  );
}
