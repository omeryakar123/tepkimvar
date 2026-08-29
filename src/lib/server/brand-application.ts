import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureCredentialAccount, generatePassword } from "@/lib/server/credentials";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || `firma-${Date.now()}`;
  for (let i = 0; i < 8; i++) {
    const [dupe] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.slug, slug))
      .limit(1);
    if (!dupe) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
}

export async function resolveBrandForApproval(opts: {
  assignBrandId?: string | null;
  createBrand?: { name: string; website?: string | null; slug?: string | null } | null;
  fallbackBrandId: string;
}): Promise<string> {
  if (opts.assignBrandId) {
    const [b] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.id, opts.assignBrandId))
      .limit(1);
    if (!b) throw new Error("Atanan marka bulunamadı");
    return b.id;
  }

  if (opts.createBrand?.name?.trim()) {
    const name = opts.createBrand.name.trim().slice(0, 200);
    const slug = await uniqueSlug(slugify(opts.createBrand.slug?.trim() || name));
    const [created] = await db
      .insert(schema.brands)
      .values({
        name,
        slug,
        website: opts.createBrand.website?.trim() || null,
        isActive: false,
        about: "Marka başvurusu — admin onayı bekliyor.",
      })
      .returning({ id: schema.brands.id });
    return created.id;
  }

  return opts.fallbackBrandId;
}

/** Onay sonrası: marka aktif, üye ataması, portal giriş bilgisi. */
export async function provisionBrandPortalAccess(opts: {
  brandId: string;
  userId: string;
  email: string;
  contactName: string;
  phone: string;
  memberRole?: "manager" | "agent" | "owner";
}): Promise<{ email: string; password: string; userId: string }> {
  const password = generatePassword(12);

  const { userId } = await ensureCredentialAccount({
    email: opts.email,
    password,
    name: opts.contactName,
    phone: opts.phone,
  });

  await db
    .update(schema.brands)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(schema.brands.id, opts.brandId));

  await db
    .insert(schema.userRoles)
    .values({ userId, role: "brand" })
    .onConflictDoNothing();

  const role = opts.memberRole ?? "manager";
  const [exists] = await db
    .select({ id: schema.brandMembers.id })
    .from(schema.brandMembers)
    .where(and(eq(schema.brandMembers.brandId, opts.brandId), eq(schema.brandMembers.userId, userId)))
    .limit(1);

  if (!exists) {
    await db.insert(schema.brandMembers).values({
      brandId: opts.brandId,
      userId,
      role,
    });
  }

  return { email: opts.email.toLowerCase(), password, userId };
}
