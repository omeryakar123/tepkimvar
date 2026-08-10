// Server-side helpers that turn Drizzle (camelCase) rows into the snake_case
// Db* shapes that src/lib/data.ts mappers expect. Kept out of src/routes so the
// TanStack route codegen does not treat it as a route.
import { schema } from "@/db";

type BrandRow = typeof schema.brands.$inferSelect;
type ComplaintRow = typeof schema.complaints.$inferSelect;

export type BrandNested = {
  name: string;
  slug: string;
  logo_url: string | null;
  verified: boolean;
};

// Every DbBrand field maps to an existing brands column, so nothing is nulled
// for a missing column here. `rating` is a numeric (returned as string by the
// driver) so it is coerced back to a number to match the DbBrand type.
export function toDbBrand(r: BrandRow) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    logo_url: r.logoUrl,
    cover_url: r.coverUrl,
    about: r.about,
    website: r.website,
    city: r.city,
    category_id: r.categoryId,
    verified: r.verified,
    premium: r.premium,
    rating: r.rating === null ? null : Number(r.rating),
    rating_count: r.ratingCount,
    total_complaints: r.totalComplaints,
    complaints_resolved: r.complaintsResolved,
    complaints_pending: r.complaintsPending,
    resolution_rate: r.resolutionRate,
    avg_response_minutes: r.avgResponseMinutes,
    phone: r.phone,
    email: r.email,
    address: r.address,
    socials: r.socials as Record<string, string> | null,
    business_hours: r.businessHours,
    gallery: r.gallery as string[] | null,
    cover_video: r.coverVideo,
    seo_title: r.seoTitle,
    seo_description: r.seoDescription,
  };
}

// Build the DbComplaint snake_case shape. `brands` is attached from the joined
// brand row; `profiles` is attached separately by the caller (PII rule).
export function toDbComplaint(c: ComplaintRow, brand: BrandNested | null) {
  return {
    id: c.id,
    public_id: c.publicId,
    short_id: c.shortId,
    title: c.title,
    body: c.body,
    status: c.status,
    rating: c.rating,
    views: c.views,
    votes: c.votes,
    city: c.city,
    is_anonymous: c.isAnonymous,
    anon_name: c.anonName,
    // PII: real user id is stripped for anonymous complaints by the caller.
    user_id: c.userId as string | null,
    brand_id: c.brandId,
    category_id: c.categoryId,
    created_at:
      c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    brand_response: c.brandResponse,
    brand_response_at:
      c.brandResponseAt == null
        ? null
        : c.brandResponseAt instanceof Date
          ? c.brandResponseAt.toISOString()
          : String(c.brandResponseAt),
    sentiment_score: c.sentimentScore,
    is_high_priority: c.isHighPriority,
    first_response_minutes: c.firstResponseMinutes,
    brands: brand,
    profiles: null as
      | { full_name: string | null; username: string | null; avatar_url: string | null }
      | null,
  };
}

export type DbComplaintShape = ReturnType<typeof toDbComplaint>;
