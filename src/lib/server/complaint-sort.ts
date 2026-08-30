import { desc } from "drizzle-orm";
import { schema } from "@/db";

/** En yeni şikayetler önce — gündem, canlı akış, varsayılan liste. */
export function complaintRecentOrder() {
  return [desc(schema.complaints.createdAt)] as const;
}

/** Destek sayısına göre — trend / popüler. */
export function complaintRankOrder() {
  return [desc(schema.complaints.votes), desc(schema.complaints.createdAt)] as const;
}

/** Trend: destek + görüntülenme. */
export function complaintTrendingOrder() {
  return [
    desc(schema.complaints.votes),
    desc(schema.complaints.views),
    desc(schema.complaints.createdAt),
  ] as const;
}
