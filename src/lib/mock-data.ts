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


export const categories: Category[] = [
  { slug: "e-ticaret", name: "E-Ticaret", icon: "ShoppingCart", count: 28940 },
  { slug: "finans", name: "Finans", icon: "Landmark", count: 12455 },
  { slug: "kripto", name: "Kripto", icon: "Bitcoin", count: 3122 },
  { slug: "yazilim", name: "Yazılım", icon: "Code2", count: 1845 },
  { slug: "telekom", name: "Telekom", icon: "Signal", count: 18222 },
  { slug: "diger", name: "Diğer", icon: "Boxes", count: 9011 },
];


export const stats = {
  totalCompanies: 8421,
  totalUsers: 421300,
  totalComplaints: 1248020,
  resolvedComplaints: 1051080,
  resolutionRate: 84.2,
  todayComplaints: 1432,
};

export const companies: Company[] = [
  {
    slug: "trendyol",
    name: "Trendyol",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    rating: 4.8,
    totalComplaints: 12400,
    resolutionRate: 92,
    avgResponseMinutes: 18,
    verified: true,
    premium: true,
    about: "Türkiye'nin lider e-ticaret platformu.",
    website: "trendyol.com",
    city: "İstanbul",
  },
  {
    slug: "papara",
    name: "Papara",
    category: "finans",
    categoryName: "Finans",
    rating: 4.2,
    totalComplaints: 4100,
    resolutionRate: 88,
    avgResponseMinutes: 42,
    verified: true,
    premium: true,
    about: "Dijital cüzdan ve ön ödemeli kart hizmeti.",
    website: "papara.com",
    city: "İstanbul",
  },
  {
    slug: "turkcell",
    name: "Turkcell",
    category: "telekom",
    categoryName: "Telekom",
    rating: 3.1,
    totalComplaints: 28900,
    resolutionRate: 65,
    avgResponseMinutes: 240,
    verified: true,
    about: "Mobil iletişim ve dijital servisler.",
    website: "turkcell.com.tr",
    city: "İstanbul",
  },
  {
    slug: "getir",
    name: "Getir",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    rating: 4.6,
    totalComplaints: 8230,
    resolutionRate: 96,
    avgResponseMinutes: 12,
    verified: true,
    premium: true,
    about: "Dakikalar içinde teslimat servisi.",
    website: "getir.com",
    city: "İstanbul",
  },
  {
    slug: "hepsiburada",
    name: "Hepsiburada",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    rating: 4.3,
    totalComplaints: 10210,
    resolutionRate: 87,
    avgResponseMinutes: 19,
    verified: true,
    about: "Online alışveriş pazaryeri.",
    website: "hepsiburada.com",
    city: "İstanbul",
  },
  {
    slug: "amazon-tr",
    name: "Amazon TR",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    rating: 4.4,
    totalComplaints: 6500,
    resolutionRate: 90,
    avgResponseMinutes: 24,
    verified: true,
    about: "Global e-ticaret platformunun Türkiye operasyonu.",
    website: "amazon.com.tr",
    city: "İstanbul",
  },
];

export const complaints: Complaint[] = [
  {
    id: "12845",
    title: "Trendyol üzerinden aldığım ürün hasarlı geldi ve iade kabul edilmiyor.",
    body: "Ürün elime ulaştığında paketi yırtıktı. Kargo tutanağı tutmama rağmen Trendyol satıcısı iade talebimi reddediyor. Müşteri hizmetleri ise süreci sürekli uzatıyor. Aynı sorun daha önce de yaşanmış, bu konuda hızlı bir çözüm bekliyorum.",
    companySlug: "trendyol",
    companyName: "Trendyol",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    userInitials: "AÇ",
    userName: "Arda Ç.",
    createdAgo: "12 dakika önce",
    status: "inceleniyor",
    views: 1248,
    comments: 14,
    votes: 32,
  },
  {
    id: "12844",
    title: "Papara kart başvurum 3 haftadır kuryede bekliyor.",
    body: "Kartımın basıldığı söylendi ancak kurye firma bir türlü teslimatı yapmıyor. Papara üzerinden şikayet oluşturmama rağmen geri dönüş alamadım.",
    companySlug: "papara",
    companyName: "Papara",
    category: "finans",
    categoryName: "Finans",
    userInitials: "ME",
    userName: "Merve E.",
    createdAgo: "45 dakika önce",
    status: "cozuldu",
    views: 842,
    comments: 6,
    votes: 18,
    companyReply: {
      body: "Merhaba Merve Hanım, ilgili kurye firma ile iletişime geçildi ve kartınız 24 saat içinde teslim edilecektir. Yaşadığınız mağduriyet için özür dileriz.",
      agoLabel: "30 dakika önce",
    },
  },
  {
    id: "12843",
    title: "Turkcell faturama hiç kullanmadığım bir servis yansıdı.",
    body: "Bu ay faturamda 'premium içerik aboneliği' kalemi ile 89₺ kesilmiş. Bu servisi hiçbir zaman aktive etmedim. İptal ve iade talep ediyorum.",
    companySlug: "turkcell",
    companyName: "Turkcell",
    category: "telekom",
    categoryName: "Telekom",
    userInitials: "KO",
    userName: "Kerem O.",
    createdAgo: "2 saat önce",
    status: "beklemede",
    views: 421,
    comments: 9,
    votes: 41,
  },
  {
    id: "12842",
    title: "Getir Büyük siparişim eksik geldi, fark iade edilmedi.",
    body: "3 üründen biri pakette yoktu. Uygulama üzerinden bildirimi yaptım ancak iki gündür yanıt yok.",
    companySlug: "getir",
    companyName: "Getir",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    userInitials: "SY",
    userName: "Selin Y.",
    createdAgo: "3 saat önce",
    status: "inceleniyor",
    views: 312,
    comments: 4,
    votes: 12,
  },
  {
    id: "12841",
    title: "Hepsiburada satıcısı garantili ürünü değiştirmek istemiyor.",
    body: "Aldığım kulaklık 2 hafta içinde bozuldu. Satıcı 'kullanıcı hatası' deyip değişim yapmıyor.",
    companySlug: "hepsiburada",
    companyName: "Hepsiburada",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    userInitials: "ED",
    userName: "Emre D.",
    createdAgo: "5 saat önce",
    status: "cozuldu",
    views: 588,
    comments: 7,
    votes: 22,
  },
  {
    id: "12840",
    title: "Amazon TR sipariş takip numarası hiç güncellenmiyor.",
    body: "Siparişim 'kargoya verildi' aşamasında 6 gündür duruyor. Müşteri hizmetleri 'kontrol ediyoruz' diyor.",
    companySlug: "amazon-tr",
    companyName: "Amazon TR",
    category: "e-ticaret",
    categoryName: "E-Ticaret",
    userInitials: "BT",
    userName: "Begüm T.",
    createdAgo: "8 saat önce",
    status: "inceleniyor",
    views: 244,
    comments: 3,
    votes: 8,
  },
];

export function getCompany(slug: string): Company | undefined {
  return companies.find((c) => c.slug === slug);
}

export function getComplaint(id: string): Complaint | undefined {
  return complaints.find((c) => c.id === id);
}

export function getComplaintsByCompany(slug: string): Complaint[] {
  return complaints.filter((c) => c.companySlug === slug);
}

export function getComplaintsByCategory(slug: CategorySlug): Complaint[] {
  return complaints.filter((c) => c.category === slug);
}

export function getCompaniesByCategory(slug: CategorySlug): Company[] {
  return companies.filter((c) => c.category === slug);
}

export const fastestResolvers = [...companies]
  .sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes)
  .slice(0, 5);

export const trendingComplaints = [...complaints].sort((a, b) => b.views - a.views).slice(0, 3);

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
