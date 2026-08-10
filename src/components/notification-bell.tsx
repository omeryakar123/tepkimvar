import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, MessageSquare, Reply, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, typeof Bell> = {
  brand_reply: Reply,
  comment: MessageSquare,
  status_change: RefreshCw,
  resolution: Check,
};

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.floor(h / 24)} gün`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?limit=15", { credentials: "include" });
      if (!res.ok) return;
      const d = (await res.json()) as { items: Notification[]; unread: number };
      setItems(d.items ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      /* sessiz geç */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    load();
    // Hafif yoklama: bildirim akışı kritik değil, 60 sn yeterli.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, load]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function markOne(id: string) {
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  if (!user) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={unread > 0 ? `${unread} okunmamış bildirim` : "Bildirimler"}
        className="relative grid place-items-center size-9 rounded-full text-navy hover:text-ink hover:bg-surface transition"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] card-surface shadow-lift z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
            <span className="text-[13px] font-semibold text-ink">Bildirimler</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[12px] font-medium text-brand hover:underline">
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-navy-mid">Henüz bildirimin yok.</p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto divide-y divide-rule">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const unreadItem = !n.read_at;
                const content = (
                  <div className={`flex gap-3 px-4 py-3 ${unreadItem ? "bg-brand-soft/40" : ""}`}>
                    <span className="mt-0.5 grid place-items-center size-8 shrink-0 rounded-full bg-brand-soft text-brand">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block text-[12px] text-navy-mid line-clamp-2">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-navy-mid">{ago(n.created_at)} önce</span>
                    </span>
                    {unreadItem && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          if (unreadItem) markOne(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-surface transition-colors"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        onClick={() => unreadItem && markOne(n.id)}
                        className="block w-full text-left hover:bg-surface transition-colors"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
