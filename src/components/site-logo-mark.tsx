import { Link } from "@tanstack/react-router";

/** Marka ikonu — favicon ile aynı görsel (login, register, başvuru formları). */
export function SiteLogoMark({
  size = 36,
  linked = false,
  className = "",
}: {
  size?: number;
  linked?: boolean;
  className?: string;
}) {
  const img = (
    <img
      src="/site-logo.png"
      alt="tepkimvar"
      width={size}
      height={size}
      className={`rounded-full object-cover ring-1 ring-brand/30 shadow-soft ${className}`}
      style={{ width: size, height: size }}
    />
  );

  if (linked) {
    return (
      <Link to="/" className="inline-flex shrink-0">
        {img}
      </Link>
    );
  }
  return img;
}

export function SiteLogoHeader({ badge }: { badge?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
      <SiteLogoMark size={40} />
      <span className="font-display font-black text-[22px] tracking-tight text-ink">
        tepkimvar<span className="text-brand">.</span>
      </span>
      {badge ? (
        <span className="ml-1 text-[10px] uppercase tracking-wider font-bold bg-gradient-to-r from-brand/20 to-accent-purple/20 text-brand px-2 py-0.5 rounded-full ring-1 ring-brand/25">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
