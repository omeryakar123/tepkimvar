import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Clock,
  Link2,
  PenLine,
  Share2,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

const STORAGE_KEY = "tepkimvar_welcome_promo_v1";
const SHOW_DELAY_MS = 2600;

const FEATURES = [
  { icon: PenLine, title: "Şikayetini paylaş", desc: "Sorununu detaylı anlat, sesini duyur." },
  { icon: Bell, title: "Çözüm sürecini takip et", desc: "Marka yanıtlarını anlık gör." },
  { icon: Share2, title: "Paylaş ve destek bul", desc: "Linkini kopyalayıp çevrene gönder." },
] as const;

/**
 * Site giriş popup'ı — oturum başına bir kez, ~2.5 sn gecikmeyle.
 * Mobilde kompakt kart; masaüstünde promo görseli.
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
      align="top"
      className="max-w-[min(100%,28rem)] sm:max-w-xl lg:max-w-4xl max-h-[min(92vh,720px)] overflow-hidden rounded-2xl sm:rounded-3xl ring-1 ring-white/10 shadow-2xl bg-[#0a1210]"
    >
      <div className="relative flex flex-col max-h-[min(92vh,720px)]">
        {/* Kapat — büyük dokunma alanı */}
        <button
          type="button"
          onClick={close}
          aria-label="Popup'ı kapat"
          className="absolute right-3 top-3 z-20 grid place-items-center size-10 rounded-full bg-black/50 text-white/90 hover:bg-black/70 hover:text-white transition backdrop-blur-sm"
        >
          <X className="size-5" />
        </button>

        {/* Masaüstü: tam promo görseli */}
        <div className="hidden lg:block relative shrink-0">
          <img
            src="/promo/welcome-popup.jpg"
            alt="Sesini duyur, çözümü takip et — tepkimvar"
            className="w-full h-auto max-h-[52vh] object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a1210] to-transparent pointer-events-none" />
        </div>

        {/* Mobil + tablet: metin odaklı */}
        <div className="lg:hidden px-5 pt-5 pb-2 text-center">
          <p className="text-[11px] uppercase tracking-widest text-brand font-semibold">
            Web sitemizi keşfedin
          </p>
          <h2 className="mt-2 font-display text-[1.35rem] sm:text-2xl font-black tracking-tight text-white leading-tight">
            Sesini Duyur,{" "}
            <span className="text-brand">Çözümü Takip Et!</span>
          </h2>
          <p className="mt-2 text-[13px] text-white/65 leading-relaxed">
            Şikayetini paylaş, marka yanıtlarını takip et, çözüm sürecini hızlandır.
          </p>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-6 pb-5 lg:pb-6 lg:pt-4">
          {/* Masaüstü başlık (görselin altında) */}
          <div className="hidden lg:block mb-4 pr-8">
            <h2 className="font-display text-2xl font-black text-white tracking-tight">
              Sesini Duyur, <span className="text-brand">Çözümü Takip Et!</span>
            </h2>
            <p className="mt-1.5 text-[14px] text-white/60">
              Şikayetini paylaş, marka yanıtlarını gerçek zamanlı takip et.
            </p>
          </div>

          <ul className="space-y-2.5 sm:space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-xl bg-white/[0.04] ring-1 ring-white/8 px-3.5 py-3"
              >
                <span className="shrink-0 grid place-items-center size-9 rounded-lg bg-brand/15 text-brand">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 text-left">
                  <div className="text-[13px] sm:text-sm font-semibold text-white">{title}</div>
                  <div className="text-[11.5px] sm:text-[12px] text-white/55 mt-0.5">{desc}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Clock, label: "7/24 şikayet" },
              { icon: ShieldCheck, label: "Güvenilir" },
              { icon: Zap, label: "Hızlı çözüm" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-lg bg-white/[0.03] px-2 py-2">
                <Icon className="size-3.5 mx-auto text-brand mb-1" />
                <span className="text-[9px] sm:text-[10px] text-white/50 leading-tight block">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <Link
              to="/sikayet-yaz"
              onClick={close}
              className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-brand text-[#041510] text-[14px] font-bold hover:brightness-110 transition shadow-lg shadow-brand/20"
            >
              <PenLine className="size-4" />
              Şikayet Yaz
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/sikayetler"
              onClick={close}
              className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl ring-1 ring-white/15 text-white/80 text-[13px] font-semibold hover:bg-white/5 transition"
            >
              <Link2 className="size-4" />
              Şikayetlere bak
            </Link>
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-4 w-full py-2 text-[12px] text-white/40 hover:text-white/70 transition"
          >
            Bir daha gösterme
          </button>
        </div>
      </div>
    </Modal>
  );
}
