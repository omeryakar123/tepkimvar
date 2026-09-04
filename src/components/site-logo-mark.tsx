import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LogoTone = "default" | "on-dark" | "on-light";

const toneClass: Record<LogoTone, string> = {
  default: "ring-brand/30 shadow-soft",
  "on-dark": "ring-white/15 shadow-lg shadow-black/20",
  "on-light": "ring-rule shadow-soft",
};

/** Yuvarlak marka ikonu — favicon ile aynı görsel. */
export function SiteLogoMark({
  size = 36,
  linked = false,
  className = "",
  tone = "default",
}: {
  size?: number;
  linked?: boolean;
  className?: string;
  tone?: LogoTone;
}) {
  const img = (
    <img
      src="/site-logo.png"
      alt="tepkimvar"
      width={size}
      height={size}
      className={cn("rounded-full object-cover ring-1 shrink-0", toneClass[tone], className)}
      style={{ width: size, height: size }}
    />
  );

  if (linked) {
    return (
      <Link to="/" className="inline-flex shrink-0" aria-label="Ana sayfa">
        {img}
      </Link>
    );
  }
  return img;
}

/** Metin içinde marka adı yerine (cümle başı / ortası). */
export function SiteLogoInline({
  size = 24,
  className = "",
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: LogoTone;
}) {
  return (
    <SiteLogoMark
      size={size}
      tone={tone}
      className={cn("inline-block align-middle -translate-y-px", className)}
    />
  );
}

/** Başlık bloğu: logo + alt satır (ör. hero “nasıl çalışır?”). */
export function SiteLogoTitle({
  subtitle,
  logoSize = 56,
  dark = false,
  className = "",
  subtitleClassName = "",
}: {
  subtitle?: ReactNode;
  logoSize?: number;
  dark?: boolean;
  className?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-4 sm:gap-5", className)}>
      <SiteLogoMark size={logoSize} tone={dark ? "on-dark" : "default"} />
      {subtitle ? (
        <div
          className={cn(
            "font-display font-black text-[34px] sm:text-[48px] lg:text-[52px] leading-[1.05] tracking-[-0.03em]",
            dark ? "text-white" : "text-ink",
            subtitleClassName,
          )}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

/** Form / auth üstü — yalnızca logo (yazılı marka adı yok). */
export function SiteLogoHeader({ badge }: { badge?: string }) {
  return (
    <Link to="/" className="flex flex-col items-center gap-2.5 mb-8" aria-label="Ana sayfa">
      <SiteLogoMark size={48} linked={false} />
      {badge ? (
        <span className="text-[10px] uppercase tracking-wider font-bold bg-gradient-to-r from-brand/20 to-accent-purple/20 text-brand px-2.5 py-1 rounded-full ring-1 ring-brand/25">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Navbar — yalnızca logo. */
export function SiteLogoNav({ size = 34 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex shrink-0" aria-label="Ana sayfa">
      <SiteLogoMark size={size} tone="on-light" />
    </Link>
  );
}
