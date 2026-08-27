import { useRef, useState, useEffect, Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Tek slayt genişliği (mobil). */
  slideClassName?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Mobilde yatay kaydırmalı carousel (scroll-snap).
 * md+ ekranda children olduğu gibi grid'e bırakılır — wrapper dışarıda kontrol edilir.
 */
export function MobileCarousel({
  children,
  slideClassName = "w-[85vw] max-w-[300px] snap-start shrink-0",
  className = "",
  ariaLabel = "Kaydırılabilir liste",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [children]);

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-end gap-2 mb-3 md:hidden">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={!canPrev}
          aria-label="Önceki"
          className="size-9 rounded-full bg-card ring-1 ring-rule text-navy grid place-items-center hover:bg-surface disabled:opacity-40 transition"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={!canNext}
          aria-label="Sonraki"
          className="size-9 rounded-full bg-card ring-1 ring-rule text-navy grid place-items-center hover:bg-surface disabled:opacity-40 transition"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div
        ref={trackRef}
        role="region"
        aria-label={ariaLabel}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.toArray(children).map((child, i) => (
          <div key={i} className={slideClassName}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
