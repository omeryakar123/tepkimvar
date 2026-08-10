import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function generateOtp(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export async function hashOtp(otp: string, email: string): Promise<string> {
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${otp}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function emailHtml(otp: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 10px rgba(0,0,0,0.04)">
        <tr><td>
          <div style="font-weight:900;font-size:22px;letter-spacing:-0.02em">itirazvar<span style="color:#00c896">.</span></div>
          <h1 style="font-size:20px;margin:24px 0 8px;font-weight:700">Doğrulama Kodunuz</h1>
          <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px">Merhaba, İtirazVar hesabınızı doğrulamak için aşağıdaki kodu kullanabilirsiniz.</p>
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:20px;text-align:center;margin:8px 0 24px">
            <div style="font-size:34px;font-weight:800;letter-spacing:0.4em;color:#047857;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${otp}</div>
          </div>
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px">Bu doğrulama kodu <b>10 dakika</b> boyunca geçerlidir.</p>
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0">Bu işlemi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8;margin:0">Teşekkür ederiz,<br/>İtirazVar Ekibi</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendOtpEmail(email: string, otp: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "İtirazVar <onboarding@resend.dev>",
      to: [email],
      subject: "İtirazVar Doğrulama Kodunuz",
      html: emailHtml(otp),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend failed: ${r.status} ${t}`);
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip")
    ?? null;
}
