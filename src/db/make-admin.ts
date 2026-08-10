/**
 * Bir kullanıcıya rol atar.
 *   bun run src/db/make-admin.ts ornek@mail.com super_admin
 *   bun run src/db/make-admin.ts ornek@mail.com brand
 * Rol verilmezse super_admin atanır.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "./index";

const ROLES = ["super_admin", "admin", "brand", "moderator", "user"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? "super_admin") as Role;

  if (!email) {
    console.error("Kullanım: bun run src/db/make-admin.ts <email> [rol]");
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Geçersiz rol: ${role}. Seçenekler: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const [u] = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()))
    .limit(1);

  if (!u) {
    console.error(`Kullanıcı bulunamadı: ${email} (önce siteden kayıt ol)`);
    process.exit(1);
  }

  await db
    .insert(schema.userRoles)
    .values({ userId: u.id, role })
    .onConflictDoNothing();

  // Panele girebilmek için e-posta doğrulaması da tamamlanmış olsun.
  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, u.id));

  const roles = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, u.id));

  console.log(`${u.email} -> rolleri: ${roles.map((r) => r.role).join(", ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
