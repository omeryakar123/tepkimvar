import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PhoneInput } from "@/components/phone-input";
import { OtpInput } from "@/components/otp-input";
import { SiteLogoMark } from "@/components/site-logo-mark";
import { toE164Tr, fromE164 } from "@/lib/phone";
import { apiSendPhoneOtp, apiVerifyPhoneOtp } from "@/lib/phone-otp-client";
import { PHONE_OTP_LENGTH, PHONE_OTP_RESEND_COOLDOWN_SEC } from "@/lib/phone-otp-constants";
import { toast } from "sonner";

type Phase = "phone" | "otp";

export function PhoneOtpModal({
  open,
  onClose,
  initialPhone = "",
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  initialPhone?: string;
  onVerified: (result: { verificationId: string; phone: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setPhase("phone");
      setPhone(initialPhone);
      setOtp("");
      setVerifiedPhone(null);
      setCooldown(0);
    }
  }, [open, initialPhone]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendCode() {
    const e164 = toE164Tr(phone);
    if (!e164) return toast.error("Geçerli bir cep telefonu numarası girin.");
    setBusy(true);
    const { error, phone: sentPhone } = await apiSendPhoneOtp(phone);
    setBusy(false);
    if (error) return toast.error(error);
    setVerifiedPhone(sentPhone ?? e164);
    setPhase("otp");
    setCooldown(PHONE_OTP_RESEND_COOLDOWN_SEC);
    toast.success("Doğrulama kodu gönderildi.");
  }

  async function verifyCode() {
    if (otp.replace(/\D/g, "").length !== PHONE_OTP_LENGTH) {
      return toast.error(`${PHONE_OTP_LENGTH} haneli kodu girin.`);
    }
    setBusy(true);
    const { error, verificationId, phone: p } = await apiVerifyPhoneOtp(phone, otp);
    setBusy(false);
    if (error || !verificationId || !p) return toast.error(error ?? "Doğrulama başarısız");
    toast.success("Telefon doğrulandı.");
    onVerified({ verificationId, phone: p });
  }

  useEffect(() => {
    if (phase === "otp" && otp.replace(/\D/g, "").length === PHONE_OTP_LENGTH && !busy) {
      void verifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, phase]);

  return (
    <Modal open={open} onClose={onClose} className="max-w-md bg-card rounded-3xl p-6 sm:p-8 shadow-lift relative">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-navy-mid hover:text-ink"
        aria-label="Kapat"
      >
        <X className="size-5" />
      </button>

      <div className="flex flex-col items-center text-center">
        <SiteLogoMark size={40} tone="on-light" className="mb-4" />

        {phase === "phone" ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              Çözüm aşamasında sizinle iletişim kurulabilecek bir numara girin
            </h2>
            <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">
              Yazdığınız telefon numarasına doğrulama kodu gönderilecektir. Numaranız yalnızca admin
              ve ilgili firma tarafından görülür.
            </p>
            <div className="mt-6 w-full text-left">
              <PhoneInput value={phone} onChange={setPhone} required />
            </div>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="mt-6 w-full h-12 rounded-full bg-brand text-brand-foreground text-[14px] font-semibold hover:brightness-105 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Kod Gönder
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Telefon Doğrulaması</h2>
            <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">
              <span className="font-semibold text-ink">{fromE164(verifiedPhone ?? phone)}</span>{" "}
              numaralı telefonunuza gönderilen kodu aşağıya yazın.
            </p>
            <div className="mt-6 w-full">
              <OtpInput value={otp} onChange={setOtp} disabled={busy} length={PHONE_OTP_LENGTH} />
            </div>
            <p className="mt-4 text-[12px] text-navy-mid">
              {cooldown > 0 ? (
                <>
                  Kod ulaşmadıysa <b>{cooldown} saniye</b> sonra tekrar kod talep edebilirsiniz.
                </>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy}
                  className="text-brand font-semibold hover:underline"
                >
                  Kodu tekrar gönder
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={verifyCode}
              disabled={busy || otp.replace(/\D/g, "").length !== PHONE_OTP_LENGTH}
              className="mt-4 w-full h-12 rounded-full bg-brand text-brand-foreground text-[14px] font-semibold hover:brightness-105 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Tamamla
            </button>
            <button
              type="button"
              onClick={() => { setPhase("phone"); setOtp(""); }}
              className="mt-3 text-[12px] text-navy-mid hover:text-brand"
            >
              Numarayı değiştir
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
