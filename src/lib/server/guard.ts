/**
 * Sunucu tarafı yetki + rate limit yardımcıları.
 *
 * RLS kalktığı için yetkilendirme ARTIK burada. Her yazma ucu:
 *   1) requireUser  -> oturum zorunlu, banlı kullanıcı reddedilir
 *   2) rateLimit    -> spam koruması (RLS'te hiç yoktu)
 *   3) sahiplik/rol kontrolü -> ilgili uçta
 */
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { isCurrentlyBanned } from "@/lib/server/sanctions";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[api]", e);
  return Response.json({ error: "Sunucu hatası" }, { status: 500 });
}

export type SessionUser = { id: string; email: string };

/** Oturum zorunlu. Banlı kullanıcılar yazma yapamaz. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new HttpError(401, "Giriş yapmalısınız");

  const [profile] = await db
    .select({ isBanned: schema.profiles.isBanned })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, session.user.id))
    .limit(1);
  // Süreli ban dolmuşsa isCurrentlyBanned bayrağı temizler ve false döner.
  if (profile?.isBanned && (await isCurrentlyBanned(session.user.id, true))) {
    throw new HttpError(403, "Hesabınız askıya alınmış");
  }

  return { id: session.user.id, email: session.user.email };
}

/** Oturum varsa döner, yoksa null (public uçlarda opsiyonel kullanıcı için). */
export async function optionalUser(request: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function getRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, userId));
  return rows.map((r) => r.role as string);
}

export async function isStaff(userId: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes("admin") || roles.includes("super_admin");
}

export async function requireStaff(request: Request): Promise<SessionUser> {
  const u = await requireUser(request);
  if (!(await isStaff(u.id))) throw new HttpError(403, "Yetkiniz yok");
  return u;
}

/** Kullanıcı bu markanın temsilcisi mi? */
export async function isBrandMember(userId: string, brandId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.brandMembers.id })
    .from(schema.brandMembers)
    .where(and(eq(schema.brandMembers.userId, userId), eq(schema.brandMembers.brandId, brandId)))
    .limit(1);
  return !!row;
}

/**
 * Marka paneli erişim kontrolü — RLS gittiği için TEK savunma hattı.
 * İstemciden gelen brandId ASLA doğrudan kullanılmaz; her /api/brand/* ucu
 * önce bunu çağırır. Üye değilse ve personel değilse 403.
 */
export async function requireBrandAccess(userId: string, brandId: string): Promise<void> {
  const ok = (await isBrandMember(userId, brandId)) || (await isStaff(userId));
  if (!ok) throw new HttpError(403, "Bu firmaya erişiminiz yok");
}

/* --------------------------------- Rate limit ------------------------------ */
// Basit in-memory sayaç. Tek sunucu için yeterli; Coolify'da birden fazla
// replica çalıştırırsan Redis'e taşınmalı.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (b.count >= limit) {
    const secs = Math.ceil((b.resetAt - now) / 1000);
    throw new HttpError(429, `Çok fazla istek. ${secs} saniye sonra tekrar deneyin.`);
  }
  b.count++;
}

// Bellek sızıntısını önle: süresi dolmuş kayıtları ara sıra temizle.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}, 60_000).unref?.();
