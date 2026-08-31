import { and, eq, gt, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const HIDDEN = ["pending", "rejected", "spam"] as const;

export type BrandTrendRow = {
  brandId: string;
  recentComplaints: number;
  priorComplaints: number;
  recentViews: number;
  recentSupports: number;
  trendScore: number;
};

/** Son 7 gün aktivitesine göre marka trend skoru. */
export async function fetchBrandTrendScores(opts: {
  limit?: number;
  categorySlug?: string;
}): Promise<BrandTrendRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);

  const complaintVisible = and(
    notInArray(schema.complaints.status, [...HIDDEN]),
    or(eq(schema.complaints.isPublic, true), eq(schema.complaints.isSynthetic, true)),
  );

  let brandIds: string[] | undefined;
  if (opts.categorySlug) {
    const cats = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .innerJoin(schema.categories, eq(schema.brands.categoryId, schema.categories.id))
      .where(and(eq(schema.brands.isActive, true), eq(schema.categories.slug, opts.categorySlug)));
    brandIds = cats.map((c) => c.id);
    if (brandIds.length === 0) return [];
  }

  const rows = await db
    .select({
      brandId: schema.brands.id,
      recentComplaints: sql<number>`
        count(${schema.complaints.id}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        )::int`,
      priorComplaints: sql<number>`
        count(${schema.complaints.id}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '14 days'
            and ${schema.complaints.createdAt} < now() - interval '7 days'
        )::int`,
      recentViews: sql<number>`
        coalesce(sum(${schema.complaints.views}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ), 0)::int`,
      recentSupports: sql<number>`
        coalesce(sum(${schema.complaints.votes}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ), 0)::int`,
      trendScore: sql<number>`
        (
          count(${schema.complaints.id}) filter (
            where ${schema.complaints.createdAt} >= now() - interval '7 days'
          ) * 4
          + coalesce(sum(${schema.complaints.votes}) filter (
            where ${schema.complaints.createdAt} >= now() - interval '7 days'
          ), 0) * 2
          + coalesce(sum(${schema.complaints.views}) filter (
            where ${schema.complaints.createdAt} >= now() - interval '7 days'
          ), 0) / 80
        )::float`,
    })
    .from(schema.brands)
    .leftJoin(
      schema.complaints,
      and(eq(schema.complaints.brandId, schema.brands.id), complaintVisible),
    )
    .where(
      and(
        eq(schema.brands.isActive, true),
        brandIds ? inArray(schema.brands.id, brandIds) : undefined,
      ),
    )
    .groupBy(schema.brands.id)
    .having(
      sql`(
        count(${schema.complaints.id}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ) > 0
        or coalesce(sum(${schema.complaints.views}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ), 0) >= 50
      )`,
    )
    .orderBy(
      sql`(
        count(${schema.complaints.id}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ) * 4
        + coalesce(sum(${schema.complaints.votes}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ), 0) * 2
        + coalesce(sum(${schema.complaints.views}) filter (
          where ${schema.complaints.createdAt} >= now() - interval '7 days'
        ), 0) / 80
      ) desc`,
    )
    .limit(limit);

  return rows.map((r) => ({
    brandId: r.brandId,
    recentComplaints: Number(r.recentComplaints) || 0,
    priorComplaints: Number(r.priorComplaints) || 0,
    recentViews: Number(r.recentViews) || 0,
    recentSupports: Number(r.recentSupports) || 0,
    trendScore: Math.round(Number(r.trendScore) || 0),
  }));
}

/** Son 7 günde aktivite yoksa: toplam şikayet sayısına göre yedek. */
export async function fetchBrandTrendFallback(limit: number): Promise<string[]> {
  const rows = await db
    .select({ id: schema.brands.id })
    .from(schema.brands)
    .where(and(eq(schema.brands.isActive, true), gt(schema.brands.totalComplaints, 0)))
    .orderBy(sql`${schema.brands.totalComplaints} desc`)
    .limit(limit);
  return rows.map((r) => r.id);
}
