import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import postgres from "postgres";
import { HttpError, rateLimit } from "@/lib/server/guard";
import { toE164Tr } from "@/lib/phone";
import { sendSmsOtp } from "@/lib/server/sms";
import {
  PHONE_OTP_LENGTH,
  PHONE_OTP_RESEND_COOLDOWN_SEC,
} from "@/lib/phone-otp-constants";

export const PHONE_OTP_TTL_MS = 10 * 60 * 1000;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_RESEND_COOLDOWN_MS = PHONE_OTP_RESEND_COOLDOWN_SEC * 1000;
export const PHONE_VERIFY_SESSION_MS = 30 * 60 * 1000;
export { PHONE_OTP_LENGTH };

const SEND_LIMIT_PHONE = 5;
const SEND_LIMIT_IP = 20;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const VERIFY_LIMIT_PHONE = 15;
const VERIFY_LIMIT_IP = 30;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

let tablesReady: Promise<void> | null = null;

function otpPepper(): string {
  return process.env.OTP_PEPPER || process.env.BETTER_AUTH_SECRET || "dev-otp-pepper";
}

function generateOtpCode(): string {
  const max = 10 ** PHONE_OTP_LENGTH;
  const min = 10 ** (PHONE_OTP_LENGTH - 1);
  return String(randomInt(min, max));
}

function hashOtp(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${code}${otpPepper()}`, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyOtpHash(code: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actualHex = scryptSync(`${code}${otpPepper()}`, salt, 32).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(actualHex, "hex"));
  } catch {
    return false;
  }
}

function normalizePhone(raw: string): string {
  const e164 = toE164Tr(raw);
  if (!e164) throw new HttpError(400, "Geçerli bir cep telefonu numarası girin.");
  return e164;
}

export async function ensurePhoneOtpTables(): Promise<void> {
  if (tablesReady) return tablesReady;
  const url = process.env.DATABASE_URL;
  if (!url) return;

  tablesReady = (async () => {
    const pg = postgres(url, { max: 1 });
    try {
      await pg`
        CREATE TABLE IF NOT EXISTS phone_otps (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
          phone text NOT NULL,
          otp_hash text NOT NULL,
          attempts int NOT NULL DEFAULT 0,
          ip_address text,
          expires_at timestamptz NOT NULL,
          used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await pg`
        CREATE TABLE IF NOT EXISTS phone_verifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          phone text NOT NULL,
          verified_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL,
          used_at timestamptz
        )
      `;
      await pg`
        CREATE INDEX IF NOT EXISTS phone_otps_phone_created_idx
        ON phone_otps (phone, created_at DESC)
      `;
      await pg`
        CREATE INDEX IF NOT EXISTS phone_verifications_user_phone_idx
        ON phone_verifications (user_id, phone)
      `;
    } finally {
      await pg.end({ timeout: 5 }).catch(() => {});
    }
  })();

  return tablesReady;
}

async function invalidateActiveOtps(phone: string): Promise<void> {
  await ensurePhoneOtpTables();
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pg = postgres(url, { max: 1 });
  try {
    await pg`UPDATE phone_otps SET used_at = now() WHERE phone = ${phone} AND used_at IS NULL`;
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

async function enforceResendCooldown(phone: string): Promise<void> {
  await ensurePhoneOtpTables();
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pg = postgres(url, { max: 1 });
  try {
    const [recent] = await pg<{ created_at: Date }[]>`
      SELECT created_at FROM phone_otps
      WHERE phone = ${phone}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!recent) return;
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < PHONE_OTP_RESEND_COOLDOWN_MS) {
      const secs = Math.ceil((PHONE_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new HttpError(429, `Yeni kod ${secs} saniye sonra istenebilir.`);
    }
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

/** Şikayet akışı için telefon OTP gönder. */
export async function sendComplaintPhoneOtp(
  userId: string,
  rawPhone: string,
  ip: string,
): Promise<{ phone: string }> {
  await ensurePhoneOtpTables();
  const phone = normalizePhone(rawPhone);

  rateLimit(`phone-otp:send:${phone}`, SEND_LIMIT_PHONE, SEND_WINDOW_MS);
  rateLimit(`phone-otp:send:ip:${ip}`, SEND_LIMIT_IP, SEND_WINDOW_MS);

  await enforceResendCooldown(phone);
  await invalidateActiveOtps(phone);

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);

  // SMS başarısızsa OTP kaydı oluşturma
  await sendSmsOtp(phone, code);

  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(500, "Veritabanı yapılandırması eksik");
  const pg = postgres(url, { max: 1 });
  try {
    await pg`
      INSERT INTO phone_otps (user_id, phone, otp_hash, attempts, ip_address, expires_at)
      VALUES (${userId}, ${phone}, ${hashOtp(code)}, 0, ${ip === "unknown" ? null : ip}, ${expiresAt})
    `;
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }

  return { phone };
}

/** OTP doğrula; kısa ömürlü doğrulama oturumu döner. */
export async function verifyComplaintPhoneOtp(
  userId: string,
  rawPhone: string,
  code: string,
  ip: string,
): Promise<{ verificationId: string; phone: string; expiresAt: string }> {
  await ensurePhoneOtpTables();
  const phone = normalizePhone(rawPhone);
  const trimmed = code.replace(/\D/g, "");
  if (trimmed.length !== PHONE_OTP_LENGTH) {
    throw new HttpError(400, `${PHONE_OTP_LENGTH} haneli kodu girin.`);
  }

  rateLimit(`phone-otp:verify:${phone}`, VERIFY_LIMIT_PHONE, VERIFY_WINDOW_MS);
  rateLimit(`phone-otp:verify:ip:${ip}`, VERIFY_LIMIT_IP, VERIFY_WINDOW_MS);

  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(500, "Veritabanı yapılandırması eksik");
  const pg = postgres(url, { max: 1 });

  try {
    const [row] = await pg<{
      id: string;
      otp_hash: string;
      attempts: number;
      expires_at: Date;
    }[]>`
      SELECT id, otp_hash, attempts, expires_at
      FROM phone_otps
      WHERE phone = ${phone} AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new HttpError(400, "Geçersiz veya süresi dolmuş kod.");
    }

    if (row.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await pg`UPDATE phone_otps SET used_at = now() WHERE id = ${row.id}`;
      throw new HttpError(400, "Çok fazla hatalı deneme. Yeni kod isteyin.");
    }

    if (!verifyOtpHash(trimmed, row.otp_hash)) {
      const nextAttempts = row.attempts + 1;
      await pg`
        UPDATE phone_otps
        SET attempts = ${nextAttempts}, used_at = ${nextAttempts >= PHONE_OTP_MAX_ATTEMPTS ? new Date() : null}
        WHERE id = ${row.id}
      `;
      if (nextAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
        throw new HttpError(400, "Çok fazla hatalı deneme. Yeni kod isteyin.");
      }
      throw new HttpError(400, "Geçersiz kod.");
    }

    const now = new Date();
    await pg`UPDATE phone_otps SET used_at = ${now} WHERE id = ${row.id}`;

    const expiresAt = new Date(Date.now() + PHONE_VERIFY_SESSION_MS);
    const [session] = await pg<{ id: string }[]>`
      INSERT INTO phone_verifications (user_id, phone, verified_at, expires_at)
      VALUES (${userId}, ${phone}, ${now}, ${expiresAt})
      RETURNING id
    `;

    return {
      verificationId: session.id,
      phone,
      expiresAt: expiresAt.toISOString(),
    };
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

/** Şikayet gönderiminde doğrulanmış telefon oturumunu tüket. */
export async function consumePhoneVerification(
  userId: string,
  verificationId: string,
  contactPhone: string,
): Promise<void> {
  await ensurePhoneOtpTables();
  const phone = normalizePhone(contactPhone);
  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(500, "Veritabanı yapılandırması eksik");
  const pg = postgres(url, { max: 1 });

  try {
    const [row] = await pg<{ id: string; phone: string }[]>`
      SELECT id, phone FROM phone_verifications
      WHERE id = ${verificationId}
        AND user_id = ${userId}
        AND used_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `;

    if (!row || row.phone !== phone) {
      throw new HttpError(400, "Telefon doğrulaması gerekli. Lütfen SMS kodunu onaylayın.");
    }

    await pg`UPDATE phone_verifications SET used_at = now() WHERE id = ${row.id}`;
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

/** Aktif doğrulama var mı (opsiyonel kontrol). */
export async function hasActivePhoneVerification(
  userId: string,
  phone: string,
): Promise<boolean> {
  await ensurePhoneOtpTables();
  const normalized = normalizePhone(phone);
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const pg = postgres(url, { max: 1 });
  try {
    const rows = await pg<{ id: string }[]>`
      SELECT id FROM phone_verifications
      WHERE user_id = ${userId}
        AND phone = ${normalized}
        AND used_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `;
    return rows.length > 0;
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}
