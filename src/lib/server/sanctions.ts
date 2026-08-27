/**
 * Kullanıcı yaptırımları — uyarı, süreli/kalıcı ban, ban kaldırma.
 *
 * `profiles.is_banned` hızlı-yol bayrağı olarak korunur (requireUser her yazmada
 * user_sanctions'ı sorgulamasın diye). Süreli ban'ın süresi dolunca bayrak
 * requireUser içinde tembel (lazy) olarak temizlenir — bkz. isCurrentlyBanned.
 */
import { and, desc, eq, isNull, or, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { notify } from "@/lib/server/notify";
import { sqlTs } from "@/lib/server/complaint-bot";

export type SanctionType = "warning" | "ban_temp" | "ban_permanent" | "unban";

const TYPE_LABEL: Record<SanctionType, string> = {
  warning: "Uyarı",
  ban_temp: "Süreli askıya alma",
  ban_permanent: "Kalıcı askıya alma",
  unban: "Askı kaldırma",
};

/** Yaptırımı uygular: kayıt + is_banned senkron + kullanıcıya bildirim. */
export async function applySanction(input: {
  userId: string;
  type: SanctionType;
  reason: string;
  issuedBy: string;
  expiresAt?: Date | null;
}): Promise<void> {
  const expiresAt = input.type === "ban_temp" ? (input.expiresAt ?? null) : null;

  await db.insert(schema.userSanctions).values({
    userId: input.userId,
    type: input.type,
    reason: input.reason,
    issuedBy: input.issuedBy,
    active: input.type !== "unban" && input.type !== "warning",
    expiresAt,
  });

  if (input.type === "unban") {
    // Aktif tüm ban'ları pasifle + bayrağı temizle.
    await db
      .update(schema.userSanctions)
      .set({ active: false })
      .where(and(eq(schema.userSanctions.userId, input.userId), eq(schema.userSanctions.active, true)));
    await db
      .update(schema.profiles)
      .set({ isBanned: false, updatedAt: new Date() })
      .where(eq(schema.profiles.id, input.userId));
  } else if (input.type === "ban_temp" || input.type === "ban_permanent") {
    await db
      .update(schema.profiles)
      .set({ isBanned: true, updatedAt: new Date() })
      .where(eq(schema.profiles.id, input.userId));
  }
  // warning: bayrağa dokunmaz.

  await notify({
    userId: input.userId,
    type: "system",
    title: TYPE_LABEL[input.type],
    body:
      input.type === "unban"
        ? "Hesabınızın askısı kaldırıldı."
        : input.type === "warning"
          ? `Uyarı: ${input.reason}`
          : `Hesabınız askıya alındı. Sebep: ${input.reason}` +
            (expiresAt ? ` (Bitiş: ${expiresAt.toLocaleString("tr-TR")})` : ""),
  });
}

/**
 * Kullanıcı şu an banlı mı? is_banned true ise gerçek yaptırıma bakar;
 * süreli ban dolmuşsa bayrağı temizleyip false döner (tembel unban).
 */
export async function isCurrentlyBanned(userId: string, isBannedFlag: boolean): Promise<boolean> {
  if (!isBannedFlag) return false;

  const [ban] = await db
    .select({ id: schema.userSanctions.id, expiresAt: schema.userSanctions.expiresAt })
    .from(schema.userSanctions)
    .where(
      and(
        eq(schema.userSanctions.userId, userId),
        eq(schema.userSanctions.active, true),
        // kalıcı (expiresAt null) VEYA süresi henüz dolmamış
        or(isNull(schema.userSanctions.expiresAt), gt(schema.userSanctions.expiresAt, sqlTs(new Date()))),
      ),
    )
    .orderBy(desc(schema.userSanctions.createdAt))
    .limit(1);

  if (ban) return true;

  // Aktif geçerli ban yok ama bayrak açık kalmış → süreli ban dolmuş: temizle.
  await db
    .update(schema.userSanctions)
    .set({ active: false })
    .where(and(eq(schema.userSanctions.userId, userId), eq(schema.userSanctions.active, true)));
  await db
    .update(schema.profiles)
    .set({ isBanned: false, updatedAt: new Date() })
    .where(eq(schema.profiles.id, userId));
  return false;
}
