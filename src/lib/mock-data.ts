// Paylaşılan tipler ve durum/format yardımcıları.
// (Eski sahte veri array'leri kaldırıldı — site tamamen gerçek veriden besleniyor.)

export type CategorySlug =
  | "e-ticaret"
  | "finans"
  | "kripto"
  | "yazilim"
  | "telekom"
  | "diger";


export interface Category {
  slug: CategorySlug;
  name: string;
  icon: string; // lucide name
  count: number;
}

export interface Company {
  slug: string;
  name: string;
  category: CategorySlug;
  categoryName: string;
  rating: number; // 0-5 — ratingCount 0 ise anlamsızdır
  ratingCount: number;
  totalComplaints: number;
  resolutionRate: number; // 0-100
  /** 0 = henüz ölçüm yok. */
  avgResponseMinutes: number;
  verified?: boolean;
  premium?: boolean;
  about: string;
  website: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export type { ComplaintStatus } from "@/lib/complaint-status";
export { statusLabel, statusClasses } from "@/lib/complaint-status";
import type { ComplaintStatus } from "@/lib/complaint-status";

export interface Complaint {
  id: string;
  publicId?: string;
  title: string;
  body: string;
  companySlug: string;
  companyName: string;
  category: CategorySlug;
  categoryName: string;
  userInitials: string;
  userName: string;
  createdAgo: string;
  status: ComplaintStatus;
  views: number;
  comments: number;
  votes: number;
  /** Oturum açmış kullanıcı bu şikayeti destekledi mi. */
  supported?: boolean;
  /** Şikayet sahibinin sonuca verdiği 1-5 yıldız (yoksa tanımsız). */
  rating?: number | null;
  sentiment?: "angry" | "sad" | "neutral" | "positive";
  isHighPriority?: boolean;
  firstResponseMinutes?: number | null;
  brandId?: string;
  companyReply?: { body: string; agoLabel: string };
  previewComments?: { userName: string; body: string; createdAgo: string }[];
  platformUsername?: string | null;
  contactPhoneDisplay?: string | null;
}


/** 0 / null = ölçüm yok; "0 dk" göstermek yanıltıcı olurdu. */
export function formatResponseTime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} dk`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} s`;
  return `${Math.round(minutes / 60 / 24)} g`;
}

/**
 * Yıldız puanı. Hiç oy yoksa 0 değil "—" gösterilir: puansız markanın
 * 0.0 ile en kötü markayla aynı görünmesi yanlış bilgi.
 */
export function formatRating(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): string {
  if (!ratingCount || ratingCount <= 0) return "—";
  return Number(rating ?? 0).toFixed(1);
}

/** Binlik kısaltma yalnızca 1000'den büyük sayılarda (5 şikayet "0.0k" olmasın). */
export function formatCompactCount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (n < 1000) return n.toLocaleString("tr-TR");
  return `${(n / 1000).toFixed(1)}k`;
}
