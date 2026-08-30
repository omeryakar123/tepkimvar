import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Props = {
  complaintId: string;
  initialVotes: number;
  initialSupported?: boolean;
  size?: "sm" | "md";
  className?: string;
  onChange?: (votes: number, supported: boolean) => void;
};

export function ComplaintSupportButton({
  complaintId,
  initialVotes,
  initialSupported = false,
  size = "md",
  className = "",
  onChange,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [votes, setVotes] = useState(initialVotes);
  const [supported, setSupported] = useState(initialSupported);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    if (!user) {
      toast.error("Desteklemek için giriş yapın");
      navigate({ to: "/login" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/complaints/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        votes?: number;
        supported?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(j.error ?? "Destek gönderilemedi");
        return;
      }
      const nextVotes = j.votes ?? votes;
      const nextSupported = j.supported ?? !supported;
      setVotes(nextVotes);
      setSupported(nextSupported);
      onChange?.(nextVotes, nextSupported);
      if (nextSupported) toast.success("Tepki desteklendi");
    } finally {
      setLoading(false);
    }
  }

  const compact = size === "sm";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={supported}
      aria-label={supported ? "Desteği geri al" : "Tepkiyi destekle"}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all disabled:opacity-60 ${
        supported
          ? "bg-brand text-brand-foreground ring-1 ring-brand shadow-sm"
          : "bg-surface text-navy-mid ring-1 ring-rule hover:ring-brand/40 hover:text-brand"
      } ${compact ? "px-2.5 h-7 text-[10.5px]" : "px-3.5 h-9 text-[12px]"} ${className}`}
    >
      <Megaphone className={compact ? "size-3" : "size-3.5"} />
      <span>{supported ? "Desteklendi" : "Tepkiyi destekle"}</span>
      {votes > 0 && (
        <span
          className={`tabular-nums ${supported ? "text-brand-foreground/90" : "text-navy-mid"}`}
        >
          · {votes.toLocaleString("tr-TR")}
        </span>
      )}
    </button>
  );
}
