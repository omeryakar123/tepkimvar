import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** complaint_supports tablosundan sayacı günceller. */
export async function refreshComplaintVoteCount(complaintId: string): Promise<number> {
  const [agg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.complaintSupports)
    .where(eq(schema.complaintSupports.complaintId, complaintId));

  const votes = Number(agg?.n) || 0;
  await db.update(schema.complaints).set({ votes }).where(eq(schema.complaints.id, complaintId));
  return votes;
}

/** Oturum açmış kullanıcının desteklediği şikayet id'leri. */
export async function supportedComplaintIds(
  userId: string,
  complaintIds: string[],
): Promise<Set<string>> {
  if (!complaintIds.length) return new Set();
  const rows = await db
    .select({ complaintId: schema.complaintSupports.complaintId })
    .from(schema.complaintSupports)
    .where(
      and(
        eq(schema.complaintSupports.userId, userId),
        inArray(schema.complaintSupports.complaintId, complaintIds),
      ),
    );
  return new Set(rows.map((r) => r.complaintId));
}
