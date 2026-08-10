import { useState } from "react";
import { Star, Heart, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export function ResolutionTunnel({
  open, onClose, complaintId, brandName, onDone,
}: { open: boolean; onClose: () => void; complaintId: string; brandName: string; onDone?: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [thanks, setThanks] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function finalize() {
    if (!user) { toast.error("Giriş yapın"); return; }
    setBusy(true);
    // Tek uç: çözüm kaydı + şikayet durumunu 'resolved' yapma sunucuda,
    // sahiplik doğrulanarak atomik şekilde yapılıyor.
    const res = await fetch("/api/resolutions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId, resolutionRating: rating, thanksMessage: thanks.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(j.error ?? "İşlem başarısız");
    }
    logAudit({ action: "complaint.resolve", entityType: "complaint", entityId: complaintId, metadata: { rating } });
    toast.success("Teşekkürünüz iletildi");
    setStep(3);
    onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-navy-mid hover:text-ink"><X className="size-4" /></button>

        {step === 1 && (
          <>
            <div className="text-center">
              <div className="mx-auto size-12 rounded-full bg-success-soft grid place-items-center mb-3"><Check className="size-6 text-success" /></div>
              <h3 className="font-display text-xl font-bold text-ink">Sorununuz çözüldü mü?</h3>
              <p className="text-[13.5px] text-navy-mid mt-1">
                <span className="font-semibold text-ink">{brandName}</span> ile yaşadığınız sürecin tamamlandığını onaylıyorsanız devam edin.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-[13px] font-semibold hover:bg-surface">Vazgeç</button>
              <button onClick={() => setStep(2)} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold">Evet, çözüldü</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h3 className="font-display text-xl font-bold text-ink">Bir teşekkür notu bırakın</h3>
              <p className="text-[13px] text-navy-mid mt-1">{brandName} markasını çözüm süreci üzerinden 5 yıldız üzerinden değerlendirin.</p>
            </div>
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
                  <Star className={`size-9 transition-transform ${(hover || rating) >= n ? "fill-amber-400 text-amber-400 scale-110" : "text-navy-mid"}`} />
                </button>
              ))}
            </div>
            <textarea value={thanks} onChange={(e) => setThanks(e.target.value)} rows={4} maxLength={400}
              placeholder="Yaşadığınız çözüm sürecini diğer kullanıcılarla paylaşın (opsiyonel)…"
              className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-[13px] font-semibold hover:bg-surface">Geri</button>
              <button disabled={busy} onClick={finalize} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold disabled:opacity-60">Gönder</button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="text-center py-4">
            <div className="mx-auto size-14 rounded-full bg-danger-soft grid place-items-center mb-3"><Heart className="size-7 text-danger" /></div>
            <h3 className="font-display text-xl font-bold text-ink">Teşekkürler!</h3>
            <p className="text-[13.5px] text-navy-mid mt-1">Geri bildiriminiz markanın "Başarı Hikayeleri" sayfasında yer alacak.</p>
            <button onClick={onClose} className="mt-5 h-10 px-5 rounded-lg bg-ink text-paper text-[13px] font-semibold">Kapat</button>
          </div>
        )}
      </div>
    </div>
  );
}
