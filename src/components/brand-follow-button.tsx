import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Props = {
  brandSlug: string;
  brandName: string;
  className?: string;
};

/** Marka takip — yeni şikayetlerde bildirim al. */
export function BrandFollowButton({ brandSlug, brandName, className = "" }: Props) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setFollowing(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/brands/${encodeURIComponent(brandSlug)}/follow`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { following: false }))
      .then((j: { following?: boolean }) => setFollowing(!!j.following))
      .catch(() => setFollowing(false))
      .finally(() => setLoading(false));
  }, [user, brandSlug]);

  async function toggle() {
    if (!user) {
      toast.info("Takip etmek için giriş yapın");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandSlug)}/follow`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { following?: boolean; error?: string };
      if (!res.ok) throw new Error(j.error ?? "İşlem başarısız");
      setFollowing(!!j.following);
      toast.success(j.following ? `${brandName} takip ediliyor` : "Takip bırakıldı");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Takip güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <button type="button" disabled className={`inline-flex items-center gap-2 h-9 px-4 rounded-full ring-1 ring-rule text-navy-mid text-[13px] ${className}`}>
        <Loader2 className="size-4 animate-spin" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold transition ${
        following
          ? "bg-brand-soft text-brand ring-1 ring-brand/25 hover:bg-brand/10"
          : "ring-1 ring-rule text-ink hover:bg-surface"
      } ${className}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : following ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      {following ? "Takip ediliyor" : "Takip et"}
    </button>
  );
}
