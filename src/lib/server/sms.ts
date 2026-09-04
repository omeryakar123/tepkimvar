/** Sempico Solutions SMS gönderimi (OTP vb.). */

function smsConfig() {
  const baseUrl = (process.env.SMS_API_URL ?? "https://api.sempico.solutions").replace(/\/$/, "");
  return {
    baseUrl: baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    token: (process.env.SMS_API_TOKEN ?? process.env.SMS_API_KEY ?? "").trim(),
    from: process.env.SMS_FROM?.trim() || "VSMS",
  };
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

type SempicoSendResult = {
  ok: boolean;
  status: number;
  body: string;
};

/** Sempico REST API: POST v1/send, header x-access-token */
async function sempicoSend(phone: string, text: string, senderID: string): Promise<SempicoSendResult> {
  const { baseUrl, token } = smsConfig();
  if (!token) {
    return { ok: false, status: 0, body: "SMS token tanımlı değil" };
  }

  const url = `${baseUrl}v1/send`;
  const payload = [
    {
      number: [phone],
      senderID,
      text,
      type: "sms",
      lifetime: 600,
      delivery: false,
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-access-token": token,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

/** OTP SMS gönder. Token yoksa geliştirmede konsola yazar. */
export async function sendSmsOtp(phoneE164: string, code: string): Promise<void> {
  const { token, from } = smsConfig();
  const phone = digitsOnly(phoneE164);
  const text = `tepkimvar dogrulama kodunuz: ${code}. Kod 10 dakika gecerlidir.`;

  if (!token) {
    console.log(`[SMS:OTP] +${phone} -> ${code}`);
    return;
  }

  const result = await sempicoSend(phone, text, from);
  if (result.ok) {
    console.log(`[SMS] Sempico gönderildi (${result.status}) -> +${phone}`);
    return;
  }

  console.error(`[SMS] Sempico hata ${result.status}:`, result.body.slice(0, 500));

  // Eski/alternatif endpoint (BetConstruct tarzı query) — yedek
  const { baseUrl } = smsConfig();
  const legacyUrl = `${baseUrl.replace(/\/$/, "")}/send?${new URLSearchParams({
    token,
    phone,
    senderID: from,
    text,
    type: "sms",
  })}`;

  try {
    const legacy = await fetch(legacyUrl, {
      method: "GET",
      headers: { Accept: "application/json", "x-access-token": token },
      signal: AbortSignal.timeout(12_000),
    });
    const legacyBody = await legacy.text().catch(() => "");
    if (legacy.ok) {
      console.log(`[SMS] Legacy endpoint OK -> +${phone}`);
      return;
    }
    throw new Error(legacyBody.slice(0, 200) || `HTTP ${legacy.status}`);
  } catch (legacyErr) {
    const detail = legacyErr instanceof Error ? legacyErr.message : result.body.slice(0, 200);
    throw new Error(`SMS gönderilemedi (Sempico ${result.status}): ${detail}`);
  }
}

/** Admin/test: SMS bağlantı durumu (secret döndürmez). */
export async function smsHealthCheck(): Promise<{
  configured: boolean;
  senderID: string;
  apiReachable: boolean;
  detail?: string;
}> {
  const { token, from, baseUrl } = smsConfig();
  if (!token) {
    return { configured: false, senderID: from, apiReachable: false, detail: "SMS_API_TOKEN boş" };
  }

  try {
    const res = await fetch(`${baseUrl}v1/me`, {
      headers: { Accept: "application/json", "x-access-token": token },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");
    return {
      configured: true,
      senderID: from,
      apiReachable: res.ok,
      detail: res.ok ? "OK" : body.slice(0, 200) || `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      configured: true,
      senderID: from,
      apiReachable: false,
      detail: e instanceof Error ? e.message : "Bağlantı hatası",
    };
  }
}
