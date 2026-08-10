import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { highestRoleRedirect, type AppRole } from "@/hooks/use-auth";
import { PhoneInput } from "@/components/phone-input";
import { toE164Tr } from "@/lib/phone";

type Mode = "login" | "register" | "reset";
type Variant = "user" | "admin" | "brand";

const titles: Record<Variant, { login: string; sub: string; brand: string }> = {
  user: { login: "Hesabına giriş yap", sub: "Şikayetlerini takip et, firmalardan yanıt al.", brand: "" },
  admin: { login: "Yönetim Paneli Girişi", sub: "Sadece yetkili admin hesapları için.", brand: "Admin" },
  brand: { login: "Firma Paneli Girişi", sub: "Firma yetkilisi hesabınla giriş yap.", brand: "Brand" },
};

export function AuthForm({ variant = "user", initialMode = "login" }: { variant?: Variant; initialMode?: Mode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowedRolesForVariant: AppRole[] =
    variant === "admin" ? ["admin", "super_admin"] : variant === "brand" ? ["brand"] : ["user", "admin", "super_admin", "brand"];

  // Google butonu yalnızca OAuth yapılandırıldığında görünür.
  // Etkinleştirmek için: sunucuda GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET,
  // client'ta VITE_GOOGLE_ENABLED=true.
  const googleEnabled = import.meta.env.VITE_GOOGLE_ENABLED === "true";

  async function postLoginRedirect() {
    const res = await fetch("/api/me", { credentials: "include" });
    const { roles } = (await res.json()) as { roles: AppRole[] };
    if (variant !== "user" && !roles.some((r) => allowedRolesForVariant.includes(r))) {
      await authClient.signOut();
      setErr("Bu giriş sayfası için yetkiniz bulunmuyor.");
      return;
    }
    navigate({ to: highestRoleRedirect(roles) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (mode === "register") {
      if (!fullName.trim()) return setErr("Ad Soyad zorunludur.");
      if (!toE164Tr(phone)) return setErr("Geçerli bir telefon numarası giriniz.");
      if (password.length < 6) return setErr("Şifre en az 6 karakter olmalı.");
      if (password !== password2) return setErr("Şifreler eşleşmiyor.");
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const e164 = toE164Tr(phone)!;
        // requireEmailVerification + sendVerificationOnSignUp -> OTP otomatik gider.
        const { error } = await authClient.signUp.email({
          email: email.toLowerCase(),
          password,
          name: fullName,
          phone: e164,
        });
        if (error) throw new Error(error.message);
        navigate({ to: "/verify-email", search: { email: email.toLowerCase() } });
        return;
      } else {
        const { error } = await authClient.signIn.email({ email: email.toLowerCase(), password });
        if (error) {
          // E-posta doğrulanmamışsa: kod gönder ve doğrulama ekranına yönlendir.
          if (error.status === 403 || /verif|doğrula/i.test(error.message ?? "")) {
            await authClient.emailOtp.sendVerificationOtp({ email: email.toLowerCase(), type: "email-verification" });
            navigate({ to: "/verify-email", search: { email: email.toLowerCase() } });
            return;
          }
          throw new Error(error.message);
        }
        await postLoginRedirect();
      }
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setErr(null); setLoading(true);
    try {
      // Google'a yönlendirir; dönüşte callbackURL'e gelir.
      await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Google ile giriş başarısız.");
      setLoading(false);
    }
  }

  const t = titles[variant];

  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="grid place-items-center size-9 rounded-lg bg-brand text-brand-foreground font-black text-base">i</span>
          <span className="font-display font-black text-[22px] tracking-tight text-ink">
            itirazvar<span className="text-brand">.</span>
          </span>
          {variant !== "user" && (
            <span className="ml-2 text-[10px] uppercase tracking-wider font-bold bg-ink text-paper dark:bg-surface dark:text-ink px-2 py-0.5 rounded-full">{t.brand}</span>
          )}
        </Link>

        <div className="bg-card rounded-2xl ring-1 ring-rule p-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {mode === "register" ? "Yeni hesap oluştur" : t.login}
          </h1>
          <p className="text-[13px] text-navy-mid mt-1">
            {mode === "register" ? "Birkaç saniyede başla." : t.sub}
          </p>

          {err && <div className="mt-4 text-[13px] text-danger bg-danger-soft border border-danger-soft rounded-lg px-3 py-2">{err}</div>}
          {msg && <div className="mt-4 text-[13px] text-brand bg-brand-soft rounded-lg px-3 py-2">{msg}</div>}

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            {mode === "register" && (
              <Field icon={UserIcon} type="text" placeholder="Ad Soyad" value={fullName} onChange={setFullName} required />
            )}
            <Field icon={Mail} type="email" placeholder="E-posta" value={email} onChange={setEmail} required />
            {mode === "register" && (
              <PhoneInput value={phone} onChange={setPhone} required />
            )}
            <Field icon={Lock} type="password" placeholder="Şifre" value={password} onChange={setPassword} required minLength={6} />
            {mode === "register" && (
              <Field icon={Lock} type="password" placeholder="Şifre tekrar" value={password2} onChange={setPassword2} required minLength={6} />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-brand-foreground font-medium h-11 text-sm hover:brightness-110 transition disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "register" ? "Kayıt Ol" : "Giriş Yap"}
            </button>
          </form>

          {variant === "user" && googleEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-navy-mid">
                <div className="h-px bg-rule flex-1" />ya da<div className="h-px bg-rule flex-1" />
              </div>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg ring-1 ring-rule bg-card h-11 text-sm font-medium hover:bg-surface transition disabled:opacity-60"
              >
                <GoogleIcon /> Google ile devam et
              </button>
            </>
          )}

          <div className="mt-6 text-[13px] text-navy-mid text-center space-y-1">
            {mode === "login" ? (
              <>
                <p>
                  Hesabın yok mu?{" "}
                  <button onClick={() => setMode("register")} className="text-brand font-medium hover:underline">Üye ol</button>
                </p>
                <p>
                  <Link to="/forgot-password" className="hover:text-ink">Şifremi unuttum</Link>
                </p>
              </>
            ) : (
              <p>
                Zaten üye misin?{" "}
                <button onClick={() => setMode("login")} className="text-brand font-medium hover:underline">Giriş yap</button>
              </p>
            )}
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

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c3 0 5.7 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c3 0 5.7 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.1 0 9.8-2 13.3-5.2l-6.1-5c-1.9 1.3-4.4 2.2-7.2 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.3 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.4l6.1 5c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
