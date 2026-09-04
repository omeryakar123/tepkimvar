/** Sempico Solutions SMS gönderimi (OTP vb.). */

function smsConfig() {
  return {
    baseUrl: (process.env.SMS_API_URL ?? "https://api.sempico.solutions").replace(/\/$/, ""),
    apiKey: process.env.SMS_API_KEY?.trim() ?? "",
    apiToken: (process.env.SMS_API_TOKEN ?? process.env.SMS_API_KEY ?? "").trim(),
    from: process.env.SMS_FROM?.trim() || "VSMS",
  };
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** OTP SMS gönder. Anahtar yoksa geliştirmede konsola yazar. */
export async function sendSmsOtp(phoneE164: string, code: string): Promise<void> {
  const { baseUrl, apiKey, apiToken, from } = smsConfig();
  const phone = digitsOnly(phoneE164);
  const text = `tepkimvar dogrulama kodunuz: ${code}. Kod 10 dakika gecerlidir.`;

  if (!apiKey && !apiToken) {
    console.log(`[SMS:OTP] +${phone} -> ${code}`);
    return;
  }

  const payload = [
    {
      number: [phone],
      senderID: from,
      text,
      type: "sms",
    },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  if (apiKey) headers["X-API-Key"] = apiKey;

  const attempts: { url: string; init: RequestInit }[] = [
    {
      url: `${baseUrl}/send`,
      init: { method: "POST", headers, body: JSON.stringify(payload) },
    },
    {
      url: `${baseUrl}/v1/send`,
      init: { method: "POST", headers, body: JSON.stringify(payload) },
    },
    {
      url: `${baseUrl}/send?${new URLSearchParams({
        token: apiToken || apiKey,
        phone,
        senderID: from,
        text,
        type: "sms",
      })}`,
      init: { method: "GET", headers: { Accept: "application/json" } },
    },
  ];

  let lastError = "SMS gönderilemedi";
  for (const { url, init } of attempts) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      const body = await res.text().catch(() => "");
      if (res.ok) {
        console.log(`[SMS] Gönderildi (${res.status}) -> +${phone}`);
        return;
      }
      lastError = body.slice(0, 200) || `HTTP ${res.status}`;
      console.warn(`[SMS] Deneme başarısız ${url}: ${lastError}`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Bağlantı hatası";
      console.warn(`[SMS] Deneme hatası ${url}:`, lastError);
    }
  }

  throw new Error(`SMS sağlayıcı hatası: ${lastError}`);
}
