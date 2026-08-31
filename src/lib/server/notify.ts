/**
 * Bildirim oluşturma (sunucu tarafı).
 *
 * Kullanıcı şikayetine marka yanıt verdiğinde, durumu değiştiğinde veya
 * şikayetine yorum geldiğinde haberdar olsun diye. Bildirim ASLA istemciden
 * oluşturulmaz — hep bu yardımcı üzerinden, tetikleyen olayın yanında yazılır.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { publish } from "@/lib/server/events";

type NotifyInput = {
  userId: string;
  type: "brand_reply" | "status_change" | "comment" | "resolution" | "system";
  title: string;
  body?: string | null;
  link?: string | null;
  /** Kendi eylemin için sana bildirim gitmesin. */
  skipIfSameAs?: string | null;
};

export async function notify(input: NotifyInput): Promise<void> {
  if (input.skipIfSameAs && input.skipIfSameAs === input.userId) return;
  try {
    await db.insert(schema.notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 500) ?? null,
      link: input.link ?? null,
    });
  } catch (e) {
    // Bildirim asıl işlemi bozmasın.
    console.error("[notify] yazılamadı:", e);
  }
}

/** Bir şikayetin sahibine bildirim gönderir (anonim olsa da sahibi bilinir). */
export async function notifyComplaintOwner(
  complaintId: string,
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  const [c] = await db
    .select({
      userId: schema.complaints.userId,
      title: schema.complaints.title,
      publicId: schema.complaints.publicId,
      id: schema.complaints.id,
    })
    .from(schema.complaints)
    .where(eq(schema.complaints.id, complaintId))
    .limit(1);
  if (!c) return;

  await notify({
    ...input,
    userId: c.userId,
    link: input.link ?? `/sikayet/${c.publicId ?? c.id}`,
  });

  // Açık sekmeler zil rozetini anında tazelesin.
  await publish({ type: "complaint", complaintId });
}

/** Markayı takip eden kullanıcılara bildirim (yeni şikayet vb.). */
export async function notifyBrandFollowers(
  brandId: string,
  input: Omit<NotifyInput, "userId"> & { skipUserIds?: string[] },
): Promise<void> {
  const followers = await db
    .select({ userId: schema.brandFollows.userId })
    .from(schema.brandFollows)
    .where(eq(schema.brandFollows.brandId, brandId));

  const skip = new Set(input.skipUserIds ?? []);
  if (input.skipIfSameAs) skip.add(input.skipIfSameAs);

  await Promise.all(
    followers
      .filter((f) => !skip.has(f.userId))
      .map((f) => notify({ ...input, userId: f.userId })),
  );
}

/** Marka temsilcilerine bildirim (kullanıcı yanıtı, anket vb.). */
export async function notifyBrandMembers(
  brandId: string,
  input: Omit<NotifyInput, "userId"> & { skipUserIds?: string[] },
): Promise<void> {
  const members = await db
    .select({ userId: schema.brandMembers.userId })
    .from(schema.brandMembers)
    .where(eq(schema.brandMembers.brandId, brandId));

  const skip = new Set(input.skipUserIds ?? []);
  if (input.skipIfSameAs) skip.add(input.skipIfSameAs);

  await Promise.all(
    members
      .filter((m) => !skip.has(m.userId))
      .map((m) => notify({ ...input, userId: m.userId })),
  );
}
