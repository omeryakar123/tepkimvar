import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Anonim sayfa görüntüleme kaydı — admin panelinde grafikler için. */
export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/admin")) return;

    const key = `pv:${pathname}:${Math.floor(Date.now() / 30_000)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
