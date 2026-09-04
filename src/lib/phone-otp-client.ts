/** İstemci tarafı telefon OTP API çağrıları (şikayet akışı). */

export async function apiSendPhoneOtp(phone: string): Promise<{ error?: string; phone?: string }> {
  const res = await fetch("/api/otp/phone/send", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; phone?: string };
  if (!res.ok) return { error: json.error ?? "SMS gönderilemedi" };
  return { phone: json.phone };
}

export async function apiVerifyPhoneOtp(
  phone: string,
  otp: string,
): Promise<{ error?: string; verificationId?: string; phone?: string; expiresAt?: string }> {
  const res = await fetch("/api/otp/phone/verify", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    verificationId?: string;
    phone?: string;
    expiresAt?: string;
  };
  if (!res.ok) return { error: json.error ?? "Doğrulama başarısız" };
  return json;
}
