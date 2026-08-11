import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db, schema } from "@/db";

// OTP e-postasını Resend ile gönder. RESEND_API_KEY yoksa (lokal geliştirme)
// kodu konsola yazar — böylece Resend olmadan da test edebilirsin.
async function sendOtpEmail(email: string, otp: string, type: string) {
  const subject =
    type === "forget-password" ? "Şifre sıfırlama kodun" : "E-posta doğrulama kodun";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[OTP:${type}] ${email} -> ${otp}`);
    return;
  }
  // Gönderen adresi: Resend'de DOĞRULANMIŞ domain olmalı. Domain'i EMAIL_FROM
  // ile ver (ör. "itirazvar <noreply@itirazvarplus.com>"). Doğrulanmamış domain
  // Resend tarafından 403 ile reddedilir.
  const from = process.env.EMAIL_FROM || "itirazvar <noreply@itirazvarplus.com>";
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
    // Sessizce yutma: hata prod loglarında görünsün ve akış "başarılı" sanılmasın.
    console.error(`[Resend] OTP gönderilemedi (${res.status}) from="${from}" to="${email}": ${detail}`);
    throw new Error(`E-posta gönderilemedi (${res.status})`);
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET,

  // İzin verilen origin'ler. Coolify'da domain'i TRUSTED_ORIGINS'e ekle
  // (virgülle ayrılmış). Varsayılan lokal dev portu 8080.
  trustedOrigins: (process.env.TRUSTED_ORIGINS || "http://localhost:8080")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // ID üretimini veritabanına bırak: kolonlarımız uuid + defaultRandom().
  // Aksi halde BetterAuth kendi string ID'sini uuid kolona yazmaya çalışıp patlar.
  advanced: {
    database: {
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    requireEmailVerification: true,
  },

  // Kayıt sırasında telefon almak için user'a ek alan (profiles.phone'a kopyalanır).
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
    },
  },

  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
      }
    : undefined,

  // Supabase'deki handle_new_user trigger'ının yerine: kayıt olan her kullanıcı
  // için profiles satırı + varsayılan 'user' rolü oluştur.
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const u = createdUser as typeof createdUser & { phone?: string | null };
          await db
            .insert(schema.profiles)
            .values({
              id: u.id,
              fullName: u.name ?? null,
              phone: u.phone ?? null,
              emailVerified: u.emailVerified ?? false,
            })
            .onConflictDoNothing();
          await db
            .insert(schema.userRoles)
            .values({ userId: u.id, role: "user" })
            .onConflictDoNothing();
        },
      },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        await sendOtpEmail(email, otp, type);
      },
    }),
  ],
});

export type Auth = typeof auth;
