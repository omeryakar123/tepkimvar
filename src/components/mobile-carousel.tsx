import { useRef, useState, useEffect, Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Tek slayt genişliği (mobil). */
  slideClassName?: string;
  className?: string;
  ariaLabel?: string;
  /** Bölüm padding'ini aşarak kenardan kenara kaydırma (taşmayı önler). */
  edgeBleed?: boolean;
};

const DEFAULT_SLIDE =
  "w-[min(calc(100vw-2rem),320px)] snap-start shrink-0";

/**
 * Mobilde yatay kaydırmalı carousel (scroll-snap).
 * edgeBleed: ana sayfa gibi px-4'lü konteynerlerde yatay scroll taşmasını önler.
 */
export function MobileCarousel({
  children,
  slideClassName = DEFAULT_SLIDE,
  className = "",
  ariaLabel = "Kaydırılabilir liste",
  edgeBleed = true,
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
    const step = el.clientWidth * 0.88;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const track = (
    <div
      ref={trackRef}
      role="region"
      aria-label={ariaLabel}
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-px-4 sm:scroll-px-6 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x overscroll-x-contain"
    >
      {Children.toArray(children).map((child, i) => (
        <div key={i} className={slideClassName}>
          {child}
        </div>
      ))}
    </div>
  );

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
      {edgeBleed ? (
        <div className="-mx-4 sm:-mx-6 overflow-hidden">
          {track}
        </div>
      ) : (
        track
      )}
    </div>
  );
}
