/** İstemci tarafı signup OTP API çağrıları. */

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "İşlem başarısız.";
  } catch {
    return "İşlem başarısız.";
  }
}

export async function apiSendSignupOtp(email: string): Promise<{ error?: string }> {
  const res = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!res.ok) return { error: await parseError(res) };
  return {};
}

export async function apiVerifySignupOtp(
  email: string,
  otp: string,
): Promise<{ error?: string }> {
  const res = await fetch("/api/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
  });
  if (!res.ok) return { error: await parseError(res) };
  return {};
}
