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
  rating: number; // 0-5
  totalComplaints: number;
  resolutionRate: number; // 0-100
  avgResponseMinutes: number;
  verified?: boolean;
  premium?: boolean;
  about: string;
  website: string;
  city: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export type ComplaintStatus = "beklemede" | "inceleniyor" | "cozuldu" | "kapatildi";

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
  sentiment?: "angry" | "sad" | "neutral" | "positive";
  isHighPriority?: boolean;
  firstResponseMinutes?: number | null;
  brandId?: string;
  companyReply?: { body: string; agoLabel: string };
}


export const statusLabel: Record<ComplaintStatus, string> = {
  beklemede: "Beklemede",
  inceleniyor: "İnceleniyor",
  cozuldu: "Çözüldü",
  kapatildi: "Kapatıldı",
};

export function statusClasses(s: ComplaintStatus): string {
  switch (s) {
    case "cozuldu":
      return "bg-success/10 text-success ring-success/20";
    case "inceleniyor":
      return "bg-warning/10 text-warning ring-warning/20";
    case "beklemede":
      return "bg-danger/10 text-danger ring-danger/20";
    case "kapatildi":
      return "bg-surface text-navy-mid ring-rule";
  }
}

export function formatResponseTime(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} s`;
  return `${Math.round(minutes / 60 / 24)} g`;
}
