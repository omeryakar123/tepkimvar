import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, Building2, MapPin, Send, Camera, Upload } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { PhoneInput } from "@/components/phone-input";
import { toE164Tr } from "@/lib/phone";

export function BrandApplicationForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandName, setBrandName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPhotoChange(file: File | null) {
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!fullName.trim()) return setErr("Ad Soyad zorunludur.");
    if (!toE164Tr(phone)) return setErr("Geçerli bir telefon numarası giriniz.");
    if (password.length < 6) return setErr("Şifre en az 6 karakter olmalı.");
    if (password !== password2) return setErr("Şifreler eşleşmiyor.");
    if (!brandName.trim()) return setErr("Marka adı zorunludur.");
    if (!telegram.trim()) return setErr("Telegram kullanıcı adı zorunludur.");
    if (!address.trim() || address.trim().length < 10) return setErr("Güncel adres en az 10 karakter olmalıdır.");
    if (!photoFile) return setErr("Telefon / kimlik fotoğrafı yüklemeniz gerekiyor.");

    setLoading(true);
    try {
      const e164 = toE164Tr(phone)!;
      const { error } = await authClient.signUp.email({
        email: email.toLowerCase(),
        password,
        name: fullName,
        phone: e164,
      });
      if (error) throw new Error(error.message);

      const uploadForm = new FormData();
      uploadForm.append("file", photoFile);
      uploadForm.append("folder", "brand-application-photos");
      const upRes = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: uploadForm,
      });
      if (!upRes.ok) {
        const j = (await upRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Fotoğraf yüklenemedi");
      }
      const { url: photoUrl } = (await upRes.json()) as { url: string };

      const appRes = await fetch("/api/brand-application", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim(),
          contactName: fullName.trim(),
          email: email.toLowerCase(),
          phone: e164,
          telegram: telegram.trim().replace(/^@/, ""),
          address: address.trim(),
          photoUrl,
          website: website.trim() || null,
        }),
      });
      if (!appRes.ok) {
        const j = (await appRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Başvuru gönderilemedi");
      }

      setMsg(
        "Başvurunuz alındı. Admin onayından sonra giriş bilgileriniz e-posta adresinize iletilecektir.",
      );
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="grid place-items-center size-9 rounded-lg bg-brand text-brand-foreground font-black text-base">i</span>
          <span className="font-display font-black text-[22px] tracking-tight text-ink">
            tepkimvar<span className="text-brand">.</span>
          </span>
        </Link>

        <div className="bg-card rounded-2xl ring-1 ring-rule p-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Marka Başvuru Formu</h1>
          <p className="text-[13px] text-navy-mid mt-1">
            Marka yönetim paneli erişimi için başvurun. Onay sonrası giriş bilgileriniz oluşturulacaktır.
          </p>

          {err && <div className="mt-4 text-[13px] text-danger bg-danger-soft border border-danger-soft rounded-lg px-3 py-2">{err}</div>}
          {msg && <div className="mt-4 text-[13px] text-brand bg-brand-soft rounded-lg px-3 py-2">{msg}</div>}

          {!msg && (
            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-navy-mid pt-1">Hesap Bilgileri</div>
              <Field icon={UserIcon} type="text" placeholder="Ad Soyad *" value={fullName} onChange={setFullName} required />
              <Field icon={Mail} type="email" placeholder="E-posta (giriş için kullanılacak) *" value={email} onChange={setEmail} required />
              <PhoneInput value={phone} onChange={setPhone} required />
              <Field icon={Lock} type="password" placeholder="Şifre *" value={password} onChange={setPassword} required minLength={6} />
              <Field icon={Lock} type="password" placeholder="Şifre tekrar *" value={password2} onChange={setPassword2} required minLength={6} />

              <div className="text-[11px] font-bold uppercase tracking-wider text-navy-mid pt-2">Marka Bilgileri</div>
              <Field icon={Building2} type="text" placeholder="Marka adı *" value={brandName} onChange={setBrandName} required />
              <Field icon={Building2} type="text" placeholder="Web sitesi (opsiyonel)" value={website} onChange={setWebsite} />
              <Field icon={Send} type="text" placeholder="Telegram kullanıcı adı *" value={telegram} onChange={setTelegram} required />
              <div className="relative">
                <MapPin className="absolute left-3 top-3 size-4 text-navy-mid" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Güncel adres *"
                  rows={3}
                  required
                  className="w-full rounded-lg ring-1 ring-rule bg-card pl-10 pr-3 py-2.5 text-sm placeholder:text-navy-mid focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-navy-mid">Telefon / kimlik fotoğrafı *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 w-full flex items-center gap-3 rounded-lg ring-1 ring-rule bg-surface/50 px-4 py-3 text-left hover:bg-surface transition"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <span className="size-12 rounded-lg bg-surface grid place-items-center text-navy-mid">
                      <Camera className="size-5" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-ink truncate">
                      {photoFile?.name ?? "Fotoğraf seçin"}
                    </span>
                    <span className="text-[11px] text-navy-mid">JPG, PNG veya WebP — en fazla 10 MB</span>
                  </span>
                  <Upload className="size-4 text-brand shrink-0" />
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-brand-foreground font-medium h-11 text-sm hover:brightness-110 transition disabled:opacity-60 mt-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Başvuruyu Gönder
              </button>
            </form>
          )}

          <div className="mt-6 text-[13px] text-navy-mid text-center">
            Zaten hesabınız var mı?{" "}
            <Link to="/login" className="text-brand font-medium hover:underline">Giriş yap</Link>
            {" · "}
            <Link to="/register" className="text-brand font-medium hover:underline">Bireysel kayıt</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, type, placeholder, value, onChange, required, minLength,
}: {
  icon: typeof Mail; type: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean; minLength?: number;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full h-11 rounded-lg ring-1 ring-rule bg-card pl-10 pr-3 text-sm placeholder:text-navy-mid focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
      />
    </div>
  );
}
