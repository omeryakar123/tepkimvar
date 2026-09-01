import { useEffect } from "react";

const TAWK_EMBED = "https://embed.tawk.to/6a96f7677f8a133446a1e919/1k1ercrcu";

declare global {
  interface Window {
    Tawk_API?: Record<string, unknown>;
    Tawk_LoadStart?: Date;
  }
}

/** Tawk.to canlı destek — yalnızca genel site düzeninde yüklenir. */
export function TawkChat() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.querySelector(`script[src="${TAWK_EMBED}"]`)) return;

    window.Tawk_API = window.Tawk_API ?? {};
    window.Tawk_LoadStart = new Date();

    const script = document.createElement("script");
    script.async = true;
    script.src = TAWK_EMBED;
    script.charset = "UTF-8";
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);
  }, []);

  return null;
}
