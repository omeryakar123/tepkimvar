/**
 * Test hesapları — Better Auth uyumlu scrypt hash ile doğrudan DB'ye yazar.
 * Kayıt API'si TRUSTED_ORIGINS eksikse bile çalışır.
 *
 *   DATABASE_URL=... node scripts/create-test-users.mjs
 */
import { randomBytes, scrypt } from "node:crypto";
import postgres from "postgres";

const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };

function hashPassword(password) {
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

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const ACCOUNTS = [
  { email: "user@tepkimvar.com", password: "user123!", name: "Test Kullanıcı", username: "testuser", roles: ["user"] },
  { email: "admin@tepkimvar.com", password: "siftadmin123!", name: "Test Admin", username: "testadmin", roles: ["user", "super_admin"] },
  {
    email: "brand@tepkimvar.com",
    password: "brand123!",
    name: "Test Marka",
    username: "testbrand",
    roles: ["user", "brand"],
    brandSlug: "trendyol",
    brandMemberRole: "manager",
  },
];

async function createAccount(acc) {
  const email = acc.email.toLowerCase();
  console.log(`\n--- ${email} ---`);

  await sql`DELETE FROM "user" WHERE email = ${email}`;

  const hashed = await hashPassword(acc.password);

  const [user] = await sql`
    INSERT INTO "user" (name, email, email_verified)
    VALUES (${acc.name}, ${email}, true)
    RETURNING id`;

  await sql`
    INSERT INTO account (user_id, account_id, provider_id, password)
    VALUES (${user.id}, ${email}, 'credential', ${hashed})`;

  await sql`
    INSERT INTO profiles (id, full_name, username, email_verified)
    VALUES (${user.id}, ${acc.name}, ${acc.username}, true)
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      username = EXCLUDED.username,
      email_verified = true`;

  for (const role of acc.roles) {
    await sql`
      INSERT INTO user_roles (user_id, role) VALUES (${user.id}, ${role}::app_role)
      ON CONFLICT DO NOTHING`;
  }

  if (acc.brandSlug) {
    const [brand] = await sql`SELECT id FROM brands WHERE slug = ${acc.brandSlug} LIMIT 1`;
    if (brand) {
      await sql`
        INSERT INTO brand_members (brand_id, user_id, role)
        VALUES (${brand.id}, ${user.id}, ${acc.brandMemberRole ?? "agent"})
        ON CONFLICT DO NOTHING`;
      console.log(`  + marka: ${acc.brandSlug}`);
    }
  }

  console.log(`  + oluşturuldu, roller: ${acc.roles.join(", ")}`);
}

for (const acc of ACCOUNTS) {
  await createAccount(acc);
}

console.log("\nTamam.");
await sql.end();
