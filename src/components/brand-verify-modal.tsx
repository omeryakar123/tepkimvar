import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { BadgeCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export function BrandVerifyModal({
  open, onClose, brandId, defaultCompanyName,
}: { open: boolean; onClose: () => void; brandId: string; defaultCompanyName?: string }) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState(defaultCompanyName ?? "");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Giriş yapmanız gerekiyor"); return; }
    if (!companyName || !contactName || !phone || !email) return toast.error("Zorunlu alanları doldurun");
    setBusy(true);
    const res = await fetch("/api/brand-verification", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId, companyName, contactName,
        phone, email, website: website || null, message: message || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(j.error ?? "Başvuru gönderilemedi");
    }
    logAudit({ action: "brand.verify_request", entityType: "brand", entityId: brandId });
    toast.success("Başvurunuz alındı. Super Admin inceleyecek.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg">
      <form onSubmit={submit} className="bg-card rounded-2xl p-6 space-y-3 shadow-lift">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-info" /><h3 className="font-display text-lg font-bold text-ink">Doğrulanmış Firma Başvurusu</h3></div>
          <button type="button" onClick={onClose}><X className="size-4 text-navy-mid" /></button>
        </div>
        <p className="text-[13px] text-navy-mid">Doğrulama rozeti almak için Premium üyeliğin aktif olması gerekir. Bilgilerinizi paylaşın, Super Admin sizinle iletişime geçecek.</p>
        <Field label="Firma Adı *" value={companyName} onChange={setCompanyName} required />
        <Field label="Yetkili Ad Soyad *" value={contactName} onChange={setContactName} required />
        <Field label="Telefon *" value={phone} onChange={setPhone} required type="tel" />
        <Field label="E-posta *" value={email} onChange={setEmail} required type="email" />
        <Field label="Website" value={website} onChange={setWebsite} placeholder="https://" />
        <div>
          <label className="text-[12px] font-medium text-navy-mid">Mesaj</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={busy} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold disabled:opacity-60">Başvuruyu Gönder</button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, required, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
    </div>
  );
}
