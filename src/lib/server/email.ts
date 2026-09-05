/** OTP / transactional e-posta — Brevo SMTP (öncelik) veya Resend yedek. */

import nodemailer from "nodemailer";

export function resolveFromAddress(): string {
  const explicit = process.env.SMTP_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  if (explicit) {
    return explicit.includes("<") ? explicit : `tepkimvar <${explicit}>`;
  }
  return process.env.EMAIL_FROM || "tepkimvar <info@tepkimvar.net>";
}

function parseFrom(raw: string): { name?: string; address: string } {
  const m = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), address: m[2].trim() };
  return { address: raw.trim() };
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_PASSWORD?.trim());
}

function otpSubject(type: "signup" | "forget-password"): string {
  return type === "forget-password" ? "Şifre sıfırlama kodun — tepkimvar" : "E-posta doğrulama kodun — tepkimvar";
}

function otpHtml(otp: string, type: "signup" | "forget-password"): string {
  const lead =
    type === "forget-password"
      ? "Şifrenizi sıfırlamak için aşağıdaki kodu girin:"
      : "Kaydınızı tamamlamak için e-posta adresinizi doğrulayın:";
  return `<!DOCTYPE html>
<html lang="tr">
<body style="font-family:Inter,Segoe UI,sans-serif;background:#f4f6f8;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">tepkimvar</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">Doğrulama kodun</h1>
    <p style="margin:0 0 24px;color:#334155;line-height:1.5">${lead}</p>
    <p style="margin:0 0 8px;font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a;text-align:center">${otp}</p>
    <p style="margin:24px 0 0;font-size:13px;color:#64748b;text-align:center">Kod 10 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın.</p>
  </div>
</body>
</html>`;
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user =
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_LOGIN?.trim() ||
    parseFrom(resolveFromAddress()).address;
  if (!user) {
    throw new Error("SMTP_USER tanımlı değil (Brevo panelindeki SMTP login e-postası).");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
  });

  const from = parseFrom(resolveFromAddress());
  await transporter.sendMail({
    from: from.name ? `"${from.name}" <${from.address}>` : from.address,
    to,
    subject,
    html,
  });
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY!.trim();
  const from = resolveFromAddress();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[Resend] OTP gönderilemedi (${res.status}) from="${from}" to="${to}": ${detail}`);
    throw new Error("E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  type: "signup" | "forget-password",
): Promise<void> {
  const subject = otpSubject(type);
  const html = otpHtml(otp, type);

  if (smtpConfigured()) {
    try {
      await sendViaSmtp(email, subject, html);
      return;
    } catch (e) {
      console.error("[SMTP] OTP gönderilemedi:", e);
      throw new Error("E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.");
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    await sendViaResend(email, subject, html);
    return;
  }

  console.log(`[OTP:${type}] ${email} -> ${otp}`);
}
