import { randomBytes, scrypt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT.dkLen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 },
      (err, key) => (err ? reject(err) : resolve(`${salt}:${key.toString("hex")}`)),
    );
  });
}

/** Güvenli rastgele şifre — okunabilir karakter seti. */
export function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Kullanıcıya credential hesabı verir veya şifresini günceller.
 * Kullanıcı yoksa oluşturur (profil + user rolü dahil).
 */
export async function ensureCredentialAccount(opts: {
  email: string;
  password: string;
  name?: string | null;
  phone?: string | null;
}): Promise<{ userId: string; created: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const hashed = await hashPassword(opts.password);

  let [u] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  let created = false;
  if (!u) {
    [u] = await db
      .insert(schema.user)
      .values({
        email,
        name: opts.name?.trim() || null,
        phone: opts.phone?.trim() || null,
        emailVerified: true,
      })
      .returning({ id: schema.user.id });
    created = true;

    await db
      .insert(schema.profiles)
      .values({
        id: u.id,
        fullName: opts.name?.trim() || null,
        phone: opts.phone?.trim() || null,
        emailVerified: true,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.userRoles)
      .values({ userId: u.id, role: "user" })
      .onConflictDoNothing();
  } else {
    await db
      .update(schema.user)
      .set({
        name: opts.name?.trim() || undefined,
        phone: opts.phone?.trim() || undefined,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, u.id));
  }

  const [existing] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, u.id), eq(schema.account.providerId, "credential")))
    .limit(1);

  if (existing) {
    await db
      .update(schema.account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(schema.account.id, existing.id));
  } else {
    await db.insert(schema.account).values({
      userId: u.id,
      accountId: email,
      providerId: "credential",
      password: hashed,
    });
  }

  return { userId: u.id, created };
}
