import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LogoTone = "default" | "on-dark" | "on-light";

function textLogoClass(tone: LogoTone, size?: number) {
  const dark = tone === "on-dark";
  const compact = size != null && size <= 28;
  return cn(
    "font-display font-black tracking-tight leading-none shrink-0",
    compact ? "text-[18px]" : "text-[20px] sm:text-[22px]",
    dark ? "text-white" : "text-ink",
  );
}

function TextLogo({
  tone = "default",
  size,
  className,
}: {
  tone?: LogoTone;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn(textLogoClass(tone, size), className)}>
      tepkimvar<span className="text-brand">.</span>
    </span>
  );
}

/** Metin marka logosu — navbar, footer, formlar. */
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
  const logo = <TextLogo tone={tone} size={size} className={className} />;

  if (linked) {
    return (
      <Link to="/" className="inline-flex shrink-0" aria-label="Ana sayfa">
        {logo}
      </Link>
    );
  }
  return logo;
}

/** Metin içinde marka adı yerine (cümle başı / ortası). */
export function SiteLogoInline({
  className = "",
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: LogoTone;
}) {
  return (
    <TextLogo
      tone={tone}
      size={24}
      className={cn("inline align-middle", className)}
    />
  );
}

/** Başlık bloğu: logo + alt satır (ör. hero “nasıl çalışır?”). */
export function SiteLogoTitle({
  subtitle,
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
      <TextLogo tone={dark ? "on-dark" : "default"} />
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

/** Form / auth üstü. */
export function SiteLogoHeader({ badge }: { badge?: string }) {
  return (
    <Link to="/" className="flex flex-col items-center gap-2.5 mb-8" aria-label="Ana sayfa">
      <TextLogo tone="default" className="text-[26px] sm:text-[28px]" />
      {badge ? (
        <span className="text-[10px] uppercase tracking-wider font-bold bg-gradient-to-r from-brand/20 to-accent-purple/20 text-brand px-2.5 py-1 rounded-full ring-1 ring-brand/25">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Navbar logosu. */
export function SiteLogoNav({ size: _size = 34 }: { size?: number }) {
  return (
    <Link to="/" className="flex items-center shrink-0" aria-label="Ana sayfa">
      <TextLogo tone="on-light" />
    </Link>
  );
}
