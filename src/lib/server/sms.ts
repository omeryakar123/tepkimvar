/** Sempico Solutions SMS gönderimi (OTP vb.). */

const LEGACY_BASE = "https://api.sempico.solutions";
const REST_BASE = "https://restapi.sempico.solutions";

function smsConfig() {
  const configured = (process.env.SMS_API_URL ?? REST_BASE).replace(/\/$/, "");
  return {
    /** REST API tabanı — v1/send, x-access-token header */
    restBase: configured.includes("api.sempico.solutions") ? REST_BASE : configured,
    /** Eski GET /send API tabanı */
    legacyBase: LEGACY_BASE,
    token: (process.env.SMS_API_TOKEN ?? process.env.SMS_API_KEY ?? "").trim(),
    from: process.env.SMS_FROM?.trim() || "VSMS",
    senderId: process.env.SMS_SENDER_ID?.trim() || "",
  };
}

function normalizePhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("5")) return `90${digits}`;
  return digits;
}

type SendResult = { ok: boolean; status: number; body: string; detail?: string };

function parseSempicoResponse(body: string, status: number): { ok: boolean; detail?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, detail: "Boş yanıt" };

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;

    if (json.status === false) {
      return {
        ok: false,
        detail: String(json.errors ?? json.message ?? json.error ?? "SMS hatası"),
      };
    }
    if (json.error) return { ok: false, detail: String(json.error) };
    if (json.success === false) {
      return { ok: false, detail: String(json.message ?? json.error ?? "SMS hatası") };
    }
    if (json.status === true || json.success === true) return { ok: true };

    if (Array.isArray(json)) {
      const first = json[0] as Record<string, unknown> | undefined;
      if (first?.error) return { ok: false, detail: String(first.error) };
      if (first?.status === false) {
        return { ok: false, detail: String(first.errors ?? first.message ?? "SMS hatası") };
      }
      return { ok: true };
    }

    if (status >= 200 && status < 300) return { ok: true };
    return { ok: false, detail: trimmed.slice(0, 200) };
  } catch {
    if (/error|fail|incorrect|invalid/i.test(trimmed)) {
      return { ok: false, detail: trimmed.slice(0, 200) };
    }
    return { ok: status >= 200 && status < 300 };
  }
}

/** REST API: POST https://restapi.sempico.solutions/v1/send */
async function restApiSend(phone: string, text: string, senderID: string): Promise<SendResult> {
  const { restBase, token } = smsConfig();
  if (!token) return { ok: false, status: 0, body: "", detail: "SMS token tanımlı değil" };

  const url = `${restBase}/v1/send`;
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
  const parsed = parseSempicoResponse(body, res.status);
  return { ok: res.ok && parsed.ok, status: res.status, body, detail: parsed.detail };
}

/** Legacy API: GET https://api.sempico.solutions/send?token=... */
async function legacySend(phone: string, text: string, senderID: string): Promise<SendResult> {
  const { legacyBase, token } = smsConfig();
  if (!token) return { ok: false, status: 0, body: "", detail: "SMS token tanımlı değil" };

  const params = new URLSearchParams({
    token,
    phone,
    senderID,
    text,
    type: "sms!",
    lifetime: "600",
    delivery: "FALSE",
  });

  const res = await fetch(`${legacyBase}/send?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text().catch(() => "");
  const parsed = parseSempicoResponse(body, res.status);
  return { ok: res.ok && parsed.ok, status: res.status, body, detail: parsed.detail };
}

/** OTP SMS gönder. Token yoksa geliştirmede konsola yazar. */
export async function sendSmsOtp(phoneE164: string, code: string): Promise<void> {
  const { token, from, senderId } = smsConfig();
  const phone = normalizePhone(phoneE164);
  const text = `tepkimvar dogrulama kodunuz: ${code}. Kod 10 dakika gecerlidir.`;

  if (!token) {
    console.log(`[SMS:OTP] +${phone} -> ${code}`);
    return;
  }

  const senders = [senderId || from, from].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
  let lastError = "SMS gönderilemedi";

  for (const senderID of senders) {
    const rest = await restApiSend(phone, text, senderID);
    if (rest.ok) {
      console.log(`[SMS] REST gönderildi (${rest.status}) -> +${phone} sender=${senderID}`);
      return;
    }
    lastError = rest.detail ?? rest.body.slice(0, 200) ?? `HTTP ${rest.status}`;
    console.error(`[SMS] REST hata sender=${senderID} ${rest.status}:`, rest.body.slice(0, 500));

    const legacy = await legacySend(phone, text, senderID);
    if (legacy.ok) {
      console.log(`[SMS] Legacy gönderildi (${legacy.status}) -> +${phone} sender=${senderID}`);
      return;
    }
    lastError = legacy.detail ?? legacy.body.slice(0, 200) ?? `HTTP ${legacy.status}`;
    console.error(`[SMS] Legacy hata sender=${senderID} ${legacy.status}:`, legacy.body.slice(0, 500));
  }

  throw new Error(`SMS gönderilemedi: ${lastError}`);
}

/** Admin/test: SMS bağlantı durumu (secret döndürmez). */
export async function smsHealthCheck(): Promise<{
  configured: boolean;
  senderID: string;
  apiReachable: boolean;
  detail?: string;
}> {
  const { token, from, restBase } = smsConfig();
  if (!token) {
    return { configured: false, senderID: from, apiReachable: false, detail: "SMS_API_TOKEN boş" };
  }

  try {
    const res = await fetch(`${restBase}/v1/me`, {
      headers: { Accept: "application/json", "x-access-token": token },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");
    const parsed = parseSempicoResponse(body, res.status);
    return {
      configured: true,
      senderID: from,
      apiReachable: res.ok && parsed.ok,
      detail: parsed.ok ? "OK" : parsed.detail ?? body.slice(0, 200) ?? `HTTP ${res.status}`,
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
