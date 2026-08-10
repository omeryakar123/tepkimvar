import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

type Reason = "wrong_brand" | "duplicate" | "spam" | "insult" | "profanity" | "wrong_category" | "legal" | "fake_document" | "fake_screenshot" | "adult" | "spam_ad" | "other";

const REASONS: { v: Reason; label: string }[] = [
  { v: "wrong_brand", label: "Yanlış firmaya açılmış" },
  { v: "duplicate", label: "Tekrarlayan şikayet" },
  { v: "spam", label: "Spam" },
  { v: "insult", label: "Hakaret" },
  { v: "profanity", label: "Küfür" },
  { v: "wrong_category", label: "Yanlış kategori" },
  { v: "legal", label: "Yasal ihlal" },
  { v: "fake_document", label: "Sahte belge" },
  { v: "fake_screenshot", label: "Sahte ekran görüntüsü" },
  { v: "adult", label: "18+ içerik" },
  { v: "spam_ad", label: "Spam reklam" },
  { v: "other", label: "Diğer" },
];

export function EscalateModal({
  open, onClose, complaintId, onDone,
  // brandId artık sunucuda şikayetten türetiliyor; prop geriye dönük uyumluluk için duruyor.
}: { open: boolean; onClose: () => void; complaintId: string; brandId?: string; onDone?: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<Reason>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!user) { toast.error("Giriş yapmalısınız"); return; }
    setBusy(true);
    const res = await fetch("/api/escalations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId, reason, note: note.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(j.error ?? "İşlem başarısız");
    }
    logAudit({ action: "complaint.escalate", entityType: "complaint", entityId: complaintId, metadata: { reason }, severity: "warn" });
    toast.success("Şikayet Super Admin'e iletildi");
    onClose(); setNote(""); onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <h3 className="font-display text-lg font-bold text-ink">Super Admin'e İlet</h3>
          </div>
          <button onClick={onClose}><X className="size-4 text-navy-mid" /></button>
        </div>
        <p className="text-[13px] text-navy-mid">Bu şikayet için bir sebep seçin. Super Admin inceleyip karar verecek.</p>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <button key={r.v} onClick={() => setReason(r.v)} className={`h-10 rounded-lg text-[12.5px] font-medium ring-1 ${reason === r.v ? "bg-brand text-brand-foreground ring-brand" : "ring-rule hover:bg-surface text-ink"}`}>{r.label}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Açıklama (opsiyonel)" className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={busy} onClick={submit} className="flex-1 h-10 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-60">İlet</button>
        </div>
      </div>
    </div>
  );
}
