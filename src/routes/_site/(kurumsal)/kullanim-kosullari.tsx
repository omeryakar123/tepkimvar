import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import { SITE_CONTACT_EMAIL } from "@/lib/contact";

const SECTIONS: { h: string; p: string }[] = [
  {
    h: "1. Taraflar ve Kapsam",
    p: "Bu koşullar, tepkimvar platformunu (\"Platform\") kullanan tüm üyeler ve ziyaretçiler için geçerlidir. Platformu kullanarak bu koşulları okuduğunuzu ve kabul ettiğinizi beyan etmiş olursunuz.",
  },
  {
    h: "2. Üyelik",
    p: "Üyelik gerçek kimlik bilgileriyle oluşturulur; bir kişi yalnızca bir hesap açabilir. Sahte kimlikle veya başkası adına açılan hesaplar ile kural ihlali yapan hesaplar uyarılabilir, askıya alınabilir veya kalıcı olarak kapatılabilir.",
  },
  {
    h: "3. Şikayet İçeriği",
    p: "Şikayetler gerçek ve birinci elden yaşanmış deneyimlere dayanmalıdır. Küfür, hakaret, tehdit, iftira, nefret söylemi, müstehcen içerik ve üçüncü kişilere ait kişisel veriler (isim, telefon, adres vb.) içeren şikayetler yayınlanmaz. İçerikler yayın öncesi ve sonrası moderasyon süreçlerine tabidir.",
  },
  {
    h: "4. Sorumluluk",
    p: "Kullanıcı, yayımladığı içeriğin doğruluğundan ve hukuka uygunluğundan şahsen sorumludur. Platform, kullanıcı içeriklerinin doğruluğunu garanti etmez; ancak bildirilen ihlalleri inceler ve gerekli gördüğünde içeriği kaldırır.",
  },
  {
    h: "5. Marka Yanıtları",
    p: "Markalar, kendileri hakkındaki şikayetlere resmi yanıt verebilir ve çözüm sürecini yürütebilir. Marka hesapları, temsil ettikleri şirket adına doğrulama sürecinden geçirilir. Çözülen şikayetler yalnızca şikayet sahibi tarafından kapatılabilir.",
  },
  {
    h: "6. Fikri Mülkiyet",
    p: "Platformun tasarımı, yazılımı ve markası tepkimvar'a aittir. Kullanıcılar, yayımladıkları içeriğin platformda görüntülenmesi için tepkimvar'a münhasır olmayan kullanım hakkı tanır.",
  },
  {
    h: "7. İçerik Kaldırma ve İtiraz",
    p: `Hakkınızda hukuka aykırı içerik bulunduğunu düşünüyorsanız, ilgili içeriği 'Raporla' özelliğiyle veya ${SITE_CONTACT_EMAIL} üzerinden bildirebilirsiniz. Bildirimler moderasyon ekibince incelenir.`,
  },
  {
    h: "8. Değişiklikler",
    p: "tepkimvar bu koşulları güncelleyebilir. Güncel sürüm her zaman bu sayfada yayınlanır; önemli değişiklikler üyelere ayrıca duyurulabilir.",
  },
];

export const Route = createFileRoute("/_site/(kurumsal)/kullanim-kosullari")({
  head: () => ({
    ...seoHead({
      title: "Kullanım Koşulları — tepkimvar",
      description:
        "tepkimvar Kullanım Koşulları: üyelik kuralları, şikayet içerik standartları, moderasyon, marka yanıtları ve sorumluluklar.",
      path: "/kullanim-kosullari",
    }),
  }),
  component: () => (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-2">Kullanım Koşulları</h1>
        <p className="text-[13px] text-navy-mid mb-10">Son güncelleme: Ağustos 2026</p>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-ink mb-2">{s.h}</h2>
              <p className="text-navy leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  ),
});
