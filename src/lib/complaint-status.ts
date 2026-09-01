/** DB complaint_status → ziyaretçi arayüzü durumu */
export type ComplaintStatus =
  | "beklemede"
  | "yeni"
  | "inceleniyor"
  | "yanitlandi"
  | "cozuldu"
  | "kapatildi";

const DB_TO_UI: Record<string, ComplaintStatus> = {
  pending: "beklemede",
  approved: "yeni",
  in_review: "inceleniyor",
  user_replied: "inceleniyor",
  super_admin_review: "inceleniyor",
  escalated: "inceleniyor",
  answered: "yanitlandi",
  resolved: "cozuldu",
  rejected: "kapatildi",
  spam: "kapatildi",
  archived: "kapatildi",
};

/** /sikayetler?durum=… filtreleri */
export const UI_DURUM_TO_DB: Record<string, string[]> = {
  yeni: ["approved"],
  inceleniyor: ["in_review", "user_replied", "super_admin_review", "escalated"],
  yanitlandi: ["answered"],
  cozuldu: ["resolved"],
};

export function dbStatusToUi(dbStatus: string): ComplaintStatus {
  return DB_TO_UI[dbStatus] ?? "beklemede";
}

export const statusLabel: Record<ComplaintStatus, string> = {
  beklemede: "Onay Bekliyor",
  yeni: "Yeni",
  inceleniyor: "İnceleniyor",
  yanitlandi: "Yanıtlandı",
  cozuldu: "Çözüldü",
  kapatildi: "Kapatıldı",
};

export function statusClasses(s: ComplaintStatus): string {
  switch (s) {
    case "cozuldu":
      return "bg-success/10 text-success ring-success/20";
    case "yanitlandi":
      return "bg-brand-soft text-brand ring-brand/20";
    case "yeni":
      return "bg-info-soft text-info ring-info/20";
    case "inceleniyor":
      return "bg-warning/10 text-warning ring-warning/20";
    case "beklemede":
      return "bg-danger/10 text-danger ring-danger/20";
    case "kapatildi":
      return "bg-surface text-navy-mid ring-rule";
  }
}
