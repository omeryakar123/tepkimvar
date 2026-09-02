import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;

export const BRAND_LOGOS = [
  "matbet", "betist", "pinbahis", "bahsegel", "betsat", "restbet", "gobahis",
  "casinometropol", "betpark", "kingbetting", "betovis", "ganyanbet", "sonbahis",
  "livebahis", "medusabahis", "eyfelcasino", "betboo", "betebet", "efesbet",
  "rotabet", "suratbet", "sohobet", "casinoas", "casifix", "betcool", "betlivo",
  "betkare", "betverse", "gallerbahis", "casinowon", "etrobet",
] as const;

export function fadeUp(reduceMotion: boolean, delay = 0): Variants {
  return {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: EASE, delay },
    },
  };
}

export function stagger(reduceMotion: boolean): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } },
  };
}

export function HeroBackground({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return (
      <>
        <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand/18 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-accent-purple/18 blur-3xl" aria-hidden />
      </>
    );
  }
  return (
    <>
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand/18 blur-3xl"
        aria-hidden
      />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-accent-purple/18 blur-3xl"
        aria-hidden
      />
      <div className="site-cta-panel-shine pointer-events-none absolute inset-0" aria-hidden />
    </>
  );
}

export function LogoMarquee() {
  const logos = [...BRAND_LOGOS, ...BRAND_LOGOS];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-surface to-transparent z-10" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-surface to-transparent z-10" aria-hidden />
      <div className="flex w-max animate-ticker hover:[animation-play-state:paused]">
        {logos.map((slug, i) => (
          <Link
            key={`${slug}-${i}`}
            to="/firma/$slug"
            params={{ slug }}
            className="mx-3 sm:mx-5 relative z-[1] flex items-center justify-center h-14 sm:h-16 w-28 sm:w-32 shrink-0 rounded-xl bg-card ring-1 ring-rule px-4 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 hover:ring-brand/40 hover:shadow-soft transition-all duration-300"
            title={slug}
          >
            <img
              src={`/brand-logos/${slug}.png`}
              alt={slug}
              className="max-h-8 sm:max-h-9 w-auto object-contain pointer-events-none"
              loading="lazy"
              draggable={false}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
