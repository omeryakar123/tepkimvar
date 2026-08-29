import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db, schema } from "@/db";
import { sendOtpEmail } from "@/lib/server/email";
import { collectTrustedOrigins, resolveAuthBaseUrl } from "@/lib/auth-urls";

export const auth = betterAuth({
  baseURL: resolveAuthBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: collectTrustedOrigins(),

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

  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const u = createdUser as typeof createdUser & { phone?: string | null };
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
