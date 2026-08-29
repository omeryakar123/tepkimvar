import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db, schema } from "@/db";
import { sendOtpEmail } from "@/lib/server/email";

/** SITE_URL / TRUSTED_ORIGINS listesine www varyantını da ekler. */
function expandTrustedOrigins(values: string[]): string[] {
  const out = new Set(values);
  for (const raw of values) {
    try {
      const u = new URL(raw);
      const host = u.hostname;
      const port = u.port ? `:${u.port}` : "";
      if (host.startsWith("www.")) {
        out.add(`${u.protocol}//${host.slice(4)}${port}`);
      } else {
        out.add(`${u.protocol}//www.${host}${port}`);
      }
    } catch {
      // Geçersiz URL — atla.
    }
  }
  return [...out];
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET,

  // İzin verilen origin'ler. Coolify'da domain'i TRUSTED_ORIGINS'e ekle
  // (virgülle ayrılmış). BETTER_AUTH_URL / SITE_URL otomatik eklenir.
  trustedOrigins: expandTrustedOrigins([
    ...new Set(
      [
        process.env.TRUSTED_ORIGINS,
        process.env.BETTER_AUTH_URL,
        process.env.SITE_URL,
        "http://localhost:8080",
      ]
        .flatMap((v) => (v ?? "").split(","))
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]),

  // Prod'da sign-in varsayılanı 3/10sn — başarısız origin denemeleri hızla 429'a düşer.
  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 60, max: 20 },
      "/sign-up/email": { window: 60, max: 10 },
    },
  },

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
    requireEmailVerification: false,
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
          // E-posta OTP kapalı — yeni kayıtlar doğrulanmış sayılır.
          await db
            .update(schema.user)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(eq(schema.user.id, u.id));
          await db
            .insert(schema.profiles)
            .values({
              id: u.id,
              fullName: u.name ?? null,
              phone: u.phone ?? null,
              emailVerified: true,
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
      // Kayıt OTP'si hash'li email_otps + /api/otp/* ile gönderilir.
      sendVerificationOnSignUp: false,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification" || type === "sign-in") {
          throw new Error("Kayıt doğrulaması için /api/otp kullanın.");
        }
        await sendOtpEmail(email, otp, "forget-password");
      },
    }),
  ],
});

export type Auth = typeof auth;
