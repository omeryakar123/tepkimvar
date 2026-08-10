import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Animasyonlu modal (framer-motion).
 *
 * Giriş: backdrop fade + panel scale/kayma. Çıkış: tersi (AnimatePresence
 * sayesinde kapanırken de animasyon oynar — eski `if (!open) return null`
 * mount/unmount'ta çıkış animasyonu MÜMKÜN DEĞİLDİ).
 *
 * Kullanım — panel kutusunun sınıflarını `className` ile ver:
 *   <Modal open={x} onClose={close} className="max-w-md bg-card rounded-2xl p-6">
 *     …içerik…
 *   </Modal>
 *
 * NOT: Çıkış animasyonunun oynaması için bu bileşen KOŞULSUZ render edilmeli
 * (`{cond && <Modal/>}` DEĞİL — `<Modal open={cond}/>`). Aksi halde ebeveyn
 * anında söker ve exit animasyonu görülmez.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  align = "center",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "center" | "top";
  closeOnBackdrop?: boolean;
}) {
  const reduce = useReducedMotion();

  // Açıkken: Escape ile kapan + arka planı kaydırmayı kilitle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            "fixed inset-0 z-[60] flex p-4 bg-black/50 backdrop-blur-sm",
            align === "center" ? "items-center justify-center" : "items-start justify-center pt-[10vh]",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={closeOnBackdrop ? onClose : undefined}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className={cn("w-full", className)}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
