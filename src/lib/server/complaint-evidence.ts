import { and, eq, inArray, isNull, sql, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { isVisualEvidenceMime } from "@/lib/complaint-evidence";
import { HttpError } from "@/lib/server/guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Şikayet oluşturmadan önce yüklenen kanıtları doğrular ve şikayete bağlar. */
export async function linkComplaintEvidence(
  userId: string,
  complaintId: string,
  attachmentIds: string[],
): Promise<number> {
  const ids = [...new Set(attachmentIds.filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0) {
    throw new HttpError(400, "En az bir ekran görüntüsü veya video kanıtı zorunludur");
  }

  const rows = await db
    .select({
      id: schema.complaintAttachments.id,
      fileType: schema.complaintAttachments.fileType,
    })
    .from(schema.complaintAttachments)
    .where(
      and(
        inArray(schema.complaintAttachments.id, ids),
        eq(schema.complaintAttachments.uploaderId, userId),
        isNull(schema.complaintAttachments.complaintId),
      ),
    );

  if (rows.length !== ids.length) {
    throw new HttpError(400, "Kanıt dosyaları geçersiz veya süresi dolmuş. Lütfen yeniden yükleyin.");
  }

  const visualCount = rows.filter((r) => isVisualEvidenceMime(r.fileType)).length;
  if (visualCount < 1) {
    throw new HttpError(400, "En az bir ekran görüntüsü veya video kanıtı zorunludur");
  }

  await db
    .update(schema.complaintAttachments)
    .set({ complaintId })
    .where(inArray(schema.complaintAttachments.id, ids));

  return rows.length;
}

/** Moderasyon onayı öncesi görsel kanıt kontrolü. */
export async function assertComplaintHasVisualEvidence(complaintId: string): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.complaintAttachments)
    .where(eq(schema.complaintAttachments.complaintId, complaintId));

  if (Number(count) === 0) {
    throw new HttpError(400, "Kanıtsız şikayet onaylanamaz — en az bir görsel veya video gerekli");
  }

  const rows = await db
    .select({ fileType: schema.complaintAttachments.fileType })
    .from(schema.complaintAttachments)
    .where(eq(schema.complaintAttachments.complaintId, complaintId));

  if (!rows.some((r) => isVisualEvidenceMime(r.fileType))) {
    throw new HttpError(400, "Kanıtsız şikayet onaylanamaz — ekran görüntüsü veya video gerekli");
  }
}

/** Moderasyon onayında kanıt dosyalarını herkese açık yapar. */
export async function publishComplaintEvidence(complaintId: string): Promise<number> {
  const rows = await db
    .update(schema.complaintAttachments)
    .set({ visibility: "public" })
    .where(eq(schema.complaintAttachments.complaintId, complaintId))
    .returning({ id: schema.complaintAttachments.id });
  return rows.length;
}

export type ComplaintAttachmentRow = {
  id: string;
  storage_path: string;
  file_type: string | null;
  visibility: "public" | "brand_only" | "super_admin_only";
  sensitive: boolean;
  created_at: Date;
};

export async function loadComplaintAttachments(complaintId: string): Promise<ComplaintAttachmentRow[]> {
  return db
    .select({
      id: schema.complaintAttachments.id,
      storage_path: schema.complaintAttachments.storagePath,
      file_type: schema.complaintAttachments.fileType,
      visibility: schema.complaintAttachments.visibility,
      sensitive: schema.complaintAttachments.sensitive,
      created_at: schema.complaintAttachments.createdAt,
    })
    .from(schema.complaintAttachments)
    .where(eq(schema.complaintAttachments.complaintId, complaintId))
    .orderBy(asc(schema.complaintAttachments.createdAt));
}
