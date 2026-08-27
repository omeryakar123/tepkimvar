import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { z } from "zod";
import { useAuth, highestRoleRedirect, type AppRole } from "@/hooks/use-auth";
import { OtpInput } from "@/components/otp-input";
import { apiSendSignupOtp, apiVerifySignupOtp } from "@/lib/otp-client";
import { toast } from "sonner";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/(auth)/verify-email")({
  head: () => ({ meta: [{ title: "E-posta Doğrulama — tepkimvar" }] }),
  validateSearch: searchSchema,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email: emailFromQuery } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();

  const email = (emailFromQuery ?? user?.email ?? "").toLowerCase();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true); setErr(null);
    const { error } = await apiVerifySignupOtp(email, code);
    setVerifying(false);
    if (error) { setErr(error ?? "Doğrulama başarısız"); return; }
    setSuccess(true);
    setTimeout(async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      const { user: me, roles } = (await res.json()) as { user: unknown; roles: AppRole[] };
      if (me) navigate({ to: highestRoleRedirect(roles) });
      else navigate({ to: "/login" });
    }, 1200);
  }

  async function resend() {
    if (cooldown > 0 || !email) return;
    setResending(true);
    const { error } = await apiSendSignupOtp(email);
    setResending(false);
    if (error) { toast.error(error); return; }
    toast.success("Yeni kod gönderildi.");
    setCode(""); setCooldown(60);
  }

  useEffect(() => { if (code.length === 6 && !verifying && !success) verify(); /* eslint-disable-next-line */ }, [code]);

  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="grid place-items-center size-9 rounded-lg bg-brand text-brand-foreground font-black text-base">i</span>
          <span className="font-display font-black text-[22px] tracking-tight text-ink">tepkimvar<span className="text-brand">.</span></span>
        </Link>
        <div className="bg-card rounded-2xl ring-1 ring-rule p-7">
          {success ? (
            <div className="text-center py-6">
              <div className="mx-auto grid place-items-center size-16 rounded-full bg-brand-soft text-brand mb-4 animate-in zoom-in-50">
                <CheckCircle2 className="size-8" />
              </div>
              <h1 className="text-xl font-semibold text-ink">E-postan doğrulandı</h1>
              <p className="text-[13px] text-navy-mid mt-1">Yönlendiriliyorsun…</p>
            </div>
          ) : (
            <>
              <div className="mx-auto grid place-items-center size-12 rounded-xl bg-brand-soft text-brand mb-4">
                <Mail className="size-5" />
              </div>
              <h1 className="text-xl font-semibold text-ink text-center">E-postanı doğrula</h1>
              <p className="text-[13px] text-navy-mid mt-1 text-center">
                {email ? <><b>{email}</b> adresine 6 haneli kod gönderdik.</> : "E-posta adresine 6 haneli kod gönderdik."}
              </p>
              {err && <div className="mt-4 text-[13px] text-danger bg-danger-soft border border-danger-soft rounded-lg px-3 py-2 text-center">{err}</div>}
              <form onSubmit={verify} className="mt-6 space-y-4">
                <OtpInput value={code} onChange={setCode} disabled={verifying} />
                <button type="submit" disabled={verifying || code.length !== 6} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-brand-foreground font-medium h-11 text-sm hover:brightness-110 disabled:opacity-60">
                  {verifying && <Loader2 className="size-4 animate-spin" />} Doğrula
                </button>
              </form>
              <div className="mt-5 text-center text-[13px] text-navy-mid">
                {cooldown > 0 ? (
                  <span>Yeni kodu <b>{cooldown}s</b> sonra isteyebilirsin</span>
                ) : (
                  <button onClick={resend} disabled={resending} className="text-brand font-medium hover:underline disabled:opacity-60 inline-flex items-center gap-1">
                    {resending && <Loader2 className="size-3 animate-spin" />} Kodu tekrar gönder
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
