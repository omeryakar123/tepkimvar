import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const go = (p: number) => {
    const next = Math.min(totalPages, Math.max(1, p));
    if (next !== page) {
      onChange(next);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // build compact page list (max 7 entries with ellipsis)
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => pages.push(n);
  const window2 = 1;
  const start = Math.max(2, page - window2);
  const end = Math.min(totalPages - 1, page + window2);
  push(1);
  if (start > 2) push("…");
  for (let i = start; i <= end; i++) push(i);
  if (end < totalPages - 1) push("…");
  if (totalPages > 1) push(totalPages);

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3" aria-label="Sayfalama">
      <p className="text-[12px] text-navy-mid">
        {total.toLocaleString("tr-TR")} kayıttan <strong className="text-ink">{from.toLocaleString("tr-TR")}-{to.toLocaleString("tr-TR")}</strong> gösteriliyor
      </p>
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center justify-center size-9 rounded-lg ring-1 ring-rule bg-card text-navy disabled:opacity-40 disabled:cursor-not-allowed hover:ring-brand/40"
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-2 text-navy-mid">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-9 h-9 px-3 rounded-lg text-[13px] font-semibold transition ${
                p === page
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "ring-1 ring-rule bg-card text-navy hover:ring-brand/40"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center size-9 rounded-lg ring-1 ring-rule bg-card text-navy disabled:opacity-40 disabled:cursor-not-allowed hover:ring-brand/40"
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
