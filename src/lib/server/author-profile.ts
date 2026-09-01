import { eq, inArray } from "drizzle-orm";
import type postgres from "postgres";
import { db, schema } from "@/db";

export type AuthorProfile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/** Şikayet/yorum yazarının görünen adı — profile + user.name yedeklemesi. */
export async function loadAuthorProfile(userId: string): Promise<AuthorProfile | null> {
  const [row] = await db
    .select({
      full_name: schema.profiles.fullName,
      username: schema.profiles.username,
      avatar_url: schema.profiles.avatarUrl,
      user_name: schema.user.name,
    })
    .from(schema.profiles)
    .leftJoin(schema.user, eq(schema.profiles.id, schema.user.id))
    .where(eq(schema.profiles.id, userId))
    .limit(1);

  if (row) {
    return {
      full_name: row.full_name?.trim() || row.user_name?.trim() || null,
      username: row.username,
      avatar_url: row.avatar_url,
    };
  }

  const [u] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!u?.name?.trim()) return null;
  return { full_name: u.name.trim(), username: null, avatar_url: null };
}

export async function loadAuthorProfiles(
  userIds: string[],
): Promise<Map<string, AuthorProfile>> {
  const map = new Map<string, AuthorProfile>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({
      id: schema.profiles.id,
      full_name: schema.profiles.fullName,
      username: schema.profiles.username,
      avatar_url: schema.profiles.avatarUrl,
      user_name: schema.user.name,
    })
    .from(schema.profiles)
    .leftJoin(schema.user, eq(schema.profiles.id, schema.user.id))
    .where(inArray(schema.profiles.id, userIds));

  for (const row of rows) {
    map.set(row.id, {
      full_name: row.full_name?.trim() || row.user_name?.trim() || null,
      username: row.username,
      avatar_url: row.avatar_url,
    });
  }

  const missing = userIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const users = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(inArray(schema.user.id, missing));
    for (const u of users) {
      if (u.name?.trim()) {
        map.set(u.id, { full_name: u.name.trim(), username: null, avatar_url: null });
      }
    }
  }

  return map;
}

/** admin@tepkimvar.com görünen adını senkronize eder. */
export async function syncAdminDisplayName(pg: postgres.Sql): Promise<void> {
  await pg`
    UPDATE "user" SET name = 'Mehmet Cakır', updated_at = now()
    WHERE lower(email) = 'admin@tepkimvar.com'
       OR lower(name) = 'test admin'
  `.catch(() => {});

  await pg`
    INSERT INTO profiles (id, full_name, username, email_verified)
    SELECT u.id, 'Mehmet Cakır', 'testadmin', true
    FROM "user" u
    WHERE lower(u.email) = 'admin@tepkimvar.com'
    ON CONFLICT (id) DO UPDATE SET
      full_name = 'Mehmet Cakır',
      updated_at = now()
  `.catch(() => {});

  await pg`
    UPDATE profiles SET full_name = 'Mehmet Cakır', updated_at = now()
    WHERE id IN (SELECT id FROM "user" WHERE lower(email) = 'admin@tepkimvar.com')
       OR lower(username) = 'testadmin'
       OR lower(full_name) = 'test admin'
  `.catch(() => {});
}
