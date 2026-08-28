import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { Complaint } from "@/lib/mock-data";

type Props = {
  items: Complaint[];
  loading?: boolean;
  compact?: boolean;
  updatedAt?: Date;
};

export function LiveFeed({ items, loading, compact, updatedAt }: Props) {
  const list = items.slice(0, compact ? 3 : 4);

  return (
    <div className="card-surface shadow-lift p-4 sm:p-5">
      <div className="flex items-center justify-between px-1 pb-3 sm:pb-4 border-b border-rule">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand" />
          </span>
          <span className="text-[13px] font-semibold text-ink">Canlı akış</span>
          {updatedAt && (
            <span className="text-[10px] text-navy-mid tabular-nums">
              {updatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <Link to="/sikayetler" className="text-[12px] font-medium text-brand hover:underline">
          Tümü
        </Link>
      </div>

      <ul className="divide-y divide-rule">
        {list.map((c) => (
          <li key={c.id} className={compact ? "py-2.5" : "py-3.5"}>
            <Link
              to="/sikayet/$id"
              params={{ id: c.publicId ?? c.id }}
              className="group flex gap-3"
            >
              <span
                className={`grid place-items-center shrink-0 rounded-full bg-brand-soft text-brand font-bold ${
                  compact ? "size-8 text-[10px]" : "size-9 text-[11px] mt-0.5"
                }`}
              >
                {c.userInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11.5px] text-navy-mid">
                  <span className="font-semibold text-brand truncate">{c.companyName}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{c.createdAgo}</span>
                </span>
                <span
                  className={`mt-0.5 block font-medium text-ink truncate group-hover:text-brand transition-colors ${
                    compact ? "text-[13px]" : "text-[13.5px]"
                  }`}
                >
                  {c.title}
                </span>
              </span>
              {c.companyReply && (
                <span className="shrink-0 self-center inline-flex items-center gap-1 rounded-full bg-success-soft text-success px-2 h-6 text-[10.5px] font-bold">
                  <Check className="size-3" /> Yanıt
                </span>
              )}
            </Link>
          </li>
        ))}
        {loading &&
          list.length === 0 &&
          [0, 1, 2].map((i) => (
            <li key={i} className="py-2.5 flex gap-3">
              <span className="size-8 rounded-full skeleton shrink-0" />
              <span className="flex-1 space-y-2 py-1">
                <span className="block h-2.5 w-24 skeleton" />
                <span className="block h-3 w-full skeleton" />
              </span>
            </li>
          ))}
        {!loading && list.length === 0 && (
          <li className="py-6 text-center text-[13px] text-navy-mid">Henüz şikayet yok.</li>
        )}
      </ul>
    </div>
  );
}
