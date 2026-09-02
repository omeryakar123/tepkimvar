import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { absUrl } from "@/lib/seo";

type Props = {
  open: boolean;
  complaintId: string;
  title: string;
  onClose: () => void;
  onView: () => void;
};

export function ComplaintShareModal({ open, complaintId, title, onClose, onView }: Props) {
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!open || !complaintId) return;
    const slug = encodeURIComponent(complaintId);
    setShareUrl(
      typeof window !== "undefined"
        ? `${window.location.origin}/sikayet/${slug}`
        : absUrl(`/sikayet/${slug}`),
    );
  }, [open, complaintId]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link kopyalandı");
    } catch {
      toast.error("Link kopyalanamadı");
    }
  }

  async function shareNative() {
    if (!shareUrl) return;
    const payload = {
      title: "Şikayetim — tepkimvar",
      text: title ? `${title}\n\n` : "",
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  function shareWhatsApp() {
    if (!shareUrl) return;
    const text = encodeURIComponent(
      `Şikayetimi tepkimvar'da paylaştım — destek olmak isterseniz:\n${shareUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md bg-card rounded-2xl ring-1 ring-rule shadow-xl overflow-hidden">
      <div className="p-6 sm:p-8 text-center">
        <div className="mx-auto size-16 rounded-full bg-brand-soft grid place-items-center">
          <CheckCircle2 className="size-9 text-brand" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-black tracking-tight text-ink">Şikayetiniz alındı</h2>
        <p className="mt-2 text-[14px] text-navy-mid leading-relaxed">
          Moderasyon onayından sonra yayına alınacak. Şikayetinizi paylaşarak daha fazla kişinin görmesini sağlayabilirsiniz.
        </p>

        <div className="mt-6 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid mb-2">Şikayet linki</div>
          <div className="flex items-center gap-2 rounded-xl bg-surface ring-1 ring-rule p-2 pl-3">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-ink truncate focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold hover:bg-card transition"
            >
              <Copy className="size-3.5" /> Kopyala
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareNative}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand text-brand-foreground text-[14px] font-semibold hover:brightness-105 transition"
          >
            <Share2 className="size-4" /> Paylaş
          </button>
          <button
            type="button"
            onClick={shareWhatsApp}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] text-white text-[14px] font-semibold hover:brightness-105 transition"
          >
            WhatsApp
          </button>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onView}
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl ring-1 ring-rule text-[13px] font-semibold hover:bg-surface transition"
          >
            <ExternalLink className="size-4" /> Şikayete git
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-[13px] font-medium text-navy-mid hover:text-ink transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
