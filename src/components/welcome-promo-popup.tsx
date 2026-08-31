import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PenLine, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

const STORAGE_KEY = "tepkimvar_welcome_promo_v2";
const SHOW_DELAY_MS = 2600;

/**
 * Site giriş popup'ı — promo görseli tüm ekranlarda orantılı gösterilir.
 */
export function WelcomePromoPopup() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* devam */
    }
    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Modal
      open={open}
      onClose={close}
      align="center"
      className="max-w-[min(94vw,920px)] p-0 overflow-hidden rounded-2xl sm:rounded-3xl ring-1 ring-white/10 shadow-2xl bg-[#0a1210]"
    >
      <div className="relative flex flex-col max-h-[min(90vh,820px)]">
        <button
          type="button"
          onClick={close}
          aria-label="Popup'ı kapat"
          className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 z-20 grid place-items-center size-10 rounded-full bg-black/60 text-white hover:bg-black/80 transition backdrop-blur-sm"
        >
          <X className="size-5" />
        </button>

        {/* Promo görseli — mobil + web, orijinal oran korunur */}
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 bg-[#0a1210]">
          <img
            src="/promo/welcome-popup.jpg"
            alt="Sesini duyur, çözümü takip et — tepkimvar.com"
            width={1200}
            height={675}
            className="block w-full h-auto max-h-[min(72vh,620px)] object-contain object-center mx-auto"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Alt aksiyon çubuğu */}
        <div className="shrink-0 border-t border-white/10 bg-[#0a1210] px-3 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row gap-2">
          <Link
            to="/sikayet-yaz"
            onClick={close}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-12 rounded-xl bg-brand text-[#041510] text-[13px] sm:text-[14px] font-bold hover:brightness-110 transition"
          >
            <PenLine className="size-4 shrink-0" />
            Şikayet Yaz
            <ArrowRight className="size-4 shrink-0" />
          </Link>
          <button
            type="button"
            onClick={close}
            className="h-11 sm:h-12 px-4 rounded-xl ring-1 ring-white/15 text-white/75 text-[13px] font-medium hover:bg-white/5 transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
