/** Resend ile OTP / transactional e-posta gönderimi. */

export function resolveFromAddress(): string {
  const explicit = process.env.RESEND_FROM_EMAIL?.trim();
  if (explicit) {
    return explicit.includes("<") ? explicit : `tepkimvar <${explicit}>`;
  }
  return process.env.EMAIL_FROM || "tepkimvar <noreply@tepkimvarplus.com>";
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  type: "signup" | "forget-password",
): Promise<void> {
  const subject =
    type === "forget-password" ? "Şifre sıfırlama kodun" : "E-posta doğrulama kodun";
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log(`[OTP:${type}] ${email} -> ${otp}`);
    return;
  }

  const from = resolveFromAddress();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject,
      html: `<p>Doğrulama kodun: <b style="font-size:22px;letter-spacing:3px">${otp}</b></p><p>Kod 10 dakika geçerlidir.</p>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      `[Resend] OTP gönderilemedi (${res.status}) from="${from}" to="${email}": ${detail}`,
    );
    throw new Error("E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}
