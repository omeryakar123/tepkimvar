import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Flag, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export type ReportTarget = "complaint" | "comment" | "attachment" | "video" | "user" | "brand";
type Reason = "spam" | "insult" | "adult" | "misinformation" | "fraud" | "other";

const REASONS: { v: Reason; label: string }[] = [
  { v: "spam", label: "Spam" },
  { v: "insult", label: "Hakaret" },
  { v: "adult", label: "18+ içerik" },
  { v: "misinformation", label: "Yanlış bilgi" },
  { v: "fraud", label: "Dolandırıcılık" },
  { v: "other", label: "Diğer" },
];

export function ReportButton({
  targetType, targetId, className,
}: { targetType: ReportTarget; targetId: string; className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) { toast.error("Raporlamak için giriş yapın"); return; }
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, note: note.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(j.error ?? "Rapor gönderilemedi");
    }
    logAudit({ action: "report.create", entityType: targetType, entityId: targetId, metadata: { reason } });
    toast.success("Raporunuz alındı, moderasyon inceleyecek.");
    setOpen(false); setNote("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className ?? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-navy-mid hover:text-danger text-sm"}>
        <Flag className="size-4" /> Raporla
      </button>
      <Modal open={open} onClose={() => setOpen(false)} className="max-w-md bg-card rounded-2xl p-6 space-y-4 shadow-lift">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">İçeriği Raporla</h3>
          <button onClick={() => setOpen(false)}><X className="size-4 text-navy-mid" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <button key={r.v} onClick={() => setReason(r.v)} className={`h-10 rounded-lg text-[13px] font-medium ring-1 ${reason === r.v ? "bg-brand text-brand-foreground ring-brand" : "ring-rule hover:bg-surface"}`}>{r.label}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Açıklama (opsiyonel)" className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={busy} onClick={submit} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold disabled:opacity-60">Gönder</button>
        </div>
      </Modal>
    </>
  );
}
