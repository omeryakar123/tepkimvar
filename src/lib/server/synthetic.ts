/**
 * Sentetik (bot üretimi) içeriğin YAYINA çıkıp çıkmayacağını belirleyen tek
 * anahtar.
 *
 * VARSAYILAN: false — yani bot üretimi şikayetler `is_public = false` ile
 * kaydedilir, herkese açık listelerde/aramada görünmez ve markanın yıldız
 * ortalamasına KATILMAZ. Yalnızca yönetim panelinde görünür.
 *
 * Bunun sebebi teknik değil hukuki: uydurulmuş tüketici şikayeti ve puanını
 * gerçek ziyaretçilere gerçek deneyim gibi göstermek yanıltıcı ticari
 * uygulamadır (TR 6502 s. Tüketicinin Korunması Hk. Kanun, AB UCPD, ABD FTC
 * "fake reviews" kuralı). Demo/staging/QA ortamında içeriği yayına almak için:
 *
 *     SYNTHETIC_CONTENT_PUBLIC="true"
 *
 * Bu anahtar YAZMA anında okunur; sonradan açılırsa geçmiş kayıtlar için
 * ayrıca `UPDATE complaints SET is_public = true WHERE is_synthetic` gerekir.
 */
export function isSyntheticPublic(): boolean {
  return (process.env.SYNTHETIC_CONTENT_PUBLIC ?? "").trim().toLowerCase() === "true";
}
