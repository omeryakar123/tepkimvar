import { desc } from "drizzle-orm";
import { schema } from "@/db";

/** Varsayılan sıralama: en çok desteklenen önce. */
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
