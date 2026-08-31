import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ShieldAlert } from "lucide-react";

type Stats = { pending: number; open: number };

function playAdminNotifySound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.44);
    void ctx.close();
  } catch {
    /* sessiz */
  }
}

/** Admin panel: bekleyen moderasyon sayacı + yeni şikayet ses bildirimi. */
export function AdminModerationAlert() {
  const [stats, setStats] = useState<Stats>({ pending: 0, open: 0 });
  const prevPending = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/moderation-stats", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as Stats;
        if (cancelled) return;

        if (prevPending.current !== null && j.pending > prevPending.current) {
          playAdminNotifySound();
        }
        prevPending.current = j.pending;
        setStats(j);
      } catch {
        /* ignore */
      }
    }

    poll();
    const t = window.setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (stats.pending === 0 && stats.open === 0) return null;

  return (
    <Link
      to="/admin/moderasyon"
      className="mx-4 mt-3 lg:mx-0 lg:mb-3 flex items-center gap-3 rounded-xl bg-warning-soft ring-1 ring-warning/25 px-4 py-3 text-[13px] font-medium text-warning hover:brightness-[0.98] transition"
    >
      <span className="relative grid place-items-center size-9 rounded-full bg-warning/15 shrink-0">
        <Bell className="size-4" />
        {stats.pending > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center tabular-nums">
            {stats.pending > 99 ? "99+" : stats.pending}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <ShieldAlert className="size-3.5 text-warning shrink-0" />
          Moderasyon bekliyor
        </span>
        <span className="block text-[12px] text-navy-mid mt-0.5">
          {stats.pending > 0
            ? `${stats.pending} yeni şikayet onay bekliyor`
            : `${stats.open} açık moderasyon kaydı`}
        </span>
      </span>
    </Link>
  );
}
