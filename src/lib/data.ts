// Data layer. READ queries now go through server API routes (/api/*) that run
// Drizzle on the server; the routes return the same snake_case Db* shapes the
// mappers below expect, so the pure mappers are unchanged from the Supabase era.
import type { Company, Complaint, ComplaintStatus } from "@/lib/mock-data";

const DB_TO_UI_STATUS: Record<string, ComplaintStatus> = {
  pending: "beklemede",
  approved: "inceleniyor",
  in_review: "inceleniyor",
  answered: "cozuldu",
  resolved: "cozuldu",
  rejected: "kapatildi",
  spam: "kapatildi",
};

/**
 * SSR sırasında göreli URL çalışmaz (fetch mutlak adres ister). Route
 * loader'ları sunucuda da koştuğu için burada origin'i çözüyoruz.
 */
function resolveUrl(url: string): string {
  // Tarayıcıda göreli URL zaten çalışır.
  if (typeof window !== "undefined" || url.startsWith("http")) return url;
  // Sunucuda mutlak adres gerekir. NOT: burada `@tanstack/react-start/server`
  // import EDİLMEZ — bu dosya istemci paketine de giriyor ve Vite sunucu-only
  // import'u engelliyor. Bu yüzden origin env'den çözülür.
  const base =
    process.env.INTERNAL_API_URL ||
    process.env.SITE_URL ||
    `http://localhost:${process.env.PORT || "8080"}`;
  return new URL(url, base).toString();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(resolveUrl(url));
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function formatAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type CategoriesResponse = {
  categories: { id: string; name: string; slug: string; icon: string | null; sort_order: number }[];
  counts: Record<string, number>;
};

const categoryNameCache = new Map<string, { name: string; slug: string }>();

async function fetchCategoriesRaw(): Promise<CategoriesResponse> {
  const data = await getJson<CategoriesResponse>("/api/categories");
  for (const c of data.categories) categoryNameCache.set(c.id, { name: c.name, slug: c.slug });
  return data;
}

async function ensureCategoryCache() {
  if (categoryNameCache.size > 0) return;
  await fetchCategoriesRaw();
}

export type DbBrand = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  about: string | null;
  website: string | null;
  city: string | null;
  category_id: string | null;
  verified: boolean;
  premium: boolean;
  rating: number | null;
  rating_count: number | null;
  total_complaints: number | null;
  complaints_resolved: number | null;
  complaints_pending: number | null;
  resolution_rate: number | null;
  avg_response_minutes: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  socials: Record<string, string> | null;
  business_hours: unknown;
  gallery: string[] | null;
  cover_video: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export function brandToCompany(b: DbBrand, categoryName = "Genel", categorySlug = "genel"): Company {
  const masked = !b.verified;
  return {
    slug: b.slug,
    name: b.name,
    category: (categorySlug as Company["category"]) ?? "diger",
    categoryName,
    rating: masked ? 0 : Number(b.rating ?? 0),
    totalComplaints: b.total_complaints ?? 0,
    resolutionRate: b.resolution_rate ?? 0,
    avgResponseMinutes: b.avg_response_minutes ?? 60,
    verified: !!b.verified,
    premium: !!b.premium,
    about: b.about ?? "",
    website: b.website ?? "",
    city: b.city ?? "—",
    logoUrl: b.logo_url,
    coverUrl: b.cover_url,
  };
}


export type DbComplaint = {
  id: string;
  public_id: string | null;
  short_id: string | null;
  title: string;
  body: string;
  status: string;
  rating: number | null;
  views: number;
  votes: number;
  city: string | null;
  is_anonymous: boolean;
  anon_name: string | null;
  user_id: string | null;
  brand_id: string;
  category_id: string | null;
  created_at: string;
  brand_response: string | null;
  brand_response_at: string | null;
  sentiment_score: string | null;
  is_high_priority: boolean | null;
  first_response_minutes: number | null;
  brands?: { name: string; slug: string; logo_url: string | null; verified: boolean } | null;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function dbComplaintToUi(c: DbComplaint): Complaint {
  const cat = c.category_id ? categoryNameCache.get(c.category_id) : null;
  const userName = c.is_anonymous ? c.anon_name ?? "Anonim" : c.profiles?.full_name ?? c.profiles?.username ?? "Kullanıcı";
  return {
    id: c.id,
    publicId: c.public_id ?? c.short_id ?? undefined,
    title: c.title,
    body: c.body,
    companySlug: c.brands?.slug ?? "",
    companyName: c.brands?.name ?? "—",
    category: (cat?.slug as Complaint["category"]) ?? "diger",
    categoryName: cat?.name ?? "Diğer",
    userInitials: initialsOf(userName),
    userName,
    createdAgo: formatAgo(c.created_at),
    status: DB_TO_UI_STATUS[c.status] ?? "beklemede",
    views: c.views ?? 0,
    comments: 0,
    votes: c.votes ?? 0,
    sentiment: (c.sentiment_score as Complaint["sentiment"]) ?? undefined,
    isHighPriority: !!c.is_high_priority,
    firstResponseMinutes: c.first_response_minutes,
    brandId: c.brand_id,
    companyReply: c.brand_response
      ? { body: c.brand_response, agoLabel: c.brand_response_at ? formatAgo(c.brand_response_at) : "" }
      : undefined,
  };
}


export async function fetchCategoriesWithCount() {
  const { categories, counts } = await fetchCategoriesRaw();
  return categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon ?? "Boxes", count: counts[c.id] ?? 0 }));
}

export const PAGE_SIZE = 12;

export async function fetchComplaintsList(opts: { limit?: number; brandSlug?: string; categorySlug?: string; sortBy?: "recent" | "trending"; search?: string } = {}) {
  await ensureCategoryCache();
  const qs = buildQuery({
    limit: opts.limit,
    brandSlug: opts.brandSlug,
    categorySlug: opts.categorySlug,
    sortBy: opts.sortBy,
    search: opts.search,
  });
  const { items } = await getJson<{ items: DbComplaint[]; total: number }>(`/api/complaints${qs}`);
  return items.map(dbComplaintToUi);
}

export async function fetchComplaintsPaged(opts: { page?: number; pageSize?: number; brandSlug?: string; categorySlug?: string; sortBy?: "recent" | "trending"; search?: string } = {}) {
  await ensureCategoryCache();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const qs = buildQuery({
    page,
    pageSize,
    brandSlug: opts.brandSlug,
    categorySlug: opts.categorySlug,
    sortBy: opts.sortBy,
    search: opts.search,
  });
  const { items, total } = await getJson<{ items: DbComplaint[]; total: number }>(`/api/complaints${qs}`);
  return { items: items.map(dbComplaintToUi), total, page, pageSize };
}

export async function fetchBrandsList(opts: { limit?: number; categorySlug?: string; search?: string; sortBy?: "rating" | "resolution" | "recent" | "complaints" } = {}) {
  await ensureCategoryCache();
  const qs = buildQuery({
    limit: opts.limit,
    categorySlug: opts.categorySlug,
    search: opts.search,
    sortBy: opts.sortBy,
  });
  const { items } = await getJson<{ items: DbBrand[]; total: number }>(`/api/brands${qs}`);
  return items.map((b) => {
    const cat = b.category_id ? categoryNameCache.get(b.category_id) : null;
    return brandToCompany(b, cat?.name ?? "Genel", cat?.slug ?? "diger");
  });
}

export async function fetchBrandsPaged(opts: { page?: number; pageSize?: number; categorySlug?: string; search?: string; sortBy?: "rating" | "resolution" | "recent" | "complaints"; verified?: boolean; premium?: boolean } = {}) {
  await ensureCategoryCache();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const qs = buildQuery({
    page,
    pageSize,
    categorySlug: opts.categorySlug,
    search: opts.search,
    sortBy: opts.sortBy,
    verified: opts.verified ? "1" : undefined,
    premium: opts.premium ? "1" : undefined,
  });
  const { items: rows, total } = await getJson<{ items: DbBrand[]; total: number }>(`/api/brands${qs}`);
  const items = rows.map((b) => {
    const cat = b.category_id ? categoryNameCache.get(b.category_id) : null;
    return brandToCompany(b, cat?.name ?? "Genel", cat?.slug ?? "diger");
  });
  return { items, total, page, pageSize };
}

export async function fetchBrandBySlug(slug: string) {
  await ensureCategoryCache();
  const res = await fetch(resolveUrl(`/api/brands/${encodeURIComponent(slug)}`));
  if (!res.ok) return null;
  const b = (await res.json()) as DbBrand;
  const cat = b.category_id ? categoryNameCache.get(b.category_id) : null;
  return { raw: b, company: brandToCompany(b, cat?.name ?? "Genel", cat?.slug ?? "diger") };
}

export async function fetchComplaintById(id: string) {
  await ensureCategoryCache();
  const res = await fetch(resolveUrl(`/api/complaints/${encodeURIComponent(id)}`));
  if (!res.ok) return null;
  const row = (await res.json()) as DbComplaint;
  return dbComplaintToUi(row);
}

export type ResolutionRow = {
  id: string; complaint_id: string; brand_id: string; user_id: string;
  thanks_message: string | null; resolution_rating: number; created_at: string;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
  complaints?: { id: string; title: string; public_id: string | null } | null;
};

export async function fetchComplaintResolution(complaintId: string): Promise<ResolutionRow | null> {
  return getJson<ResolutionRow | null>(`/api/resolutions${buildQuery({ complaintId })}`);
}

export async function fetchBrandResolutions(brandId: string, limit = 12): Promise<ResolutionRow[]> {
  return getJson<ResolutionRow[]>(`/api/brand-resolutions${buildQuery({ brandId, limit })}`);
}

export async function fetchTrendingComplaints(limit = 30) {
  try {
    return await getJson<unknown[]>(`/api/trending${buildQuery({ limit })}`);
  } catch {
    return [];
  }
}


export async function fetchPlatformStats() {
  return getJson<{
    totalComplaints: number;
    resolvedComplaints: number;
    resolutionRate: number;
    totalCompanies: number;
    totalUsers: number;
  }>("/api/stats");
}

export async function fetchFastestResolvers(limit = 5) {
  await ensureCategoryCache();
  const rows = await getJson<DbBrand[]>(`/api/fastest-resolvers${buildQuery({ limit })}`);
  return rows.map((b) => {
    const cat = b.category_id ? categoryNameCache.get(b.category_id) : null;
    return brandToCompany(b, cat?.name ?? "Genel", cat?.slug ?? "diger");
  });
}

export type DbComment = {
  id: string;
  complaint_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  pinned: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export async function fetchComments(complaintId: string): Promise<DbComment[]> {
  return getJson<DbComment[]>(`/api/comments${buildQuery({ complaintId })}`);
}
