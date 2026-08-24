import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Veri Sorumlusu",
    p: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca itirazvar (\"Platform\"), veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan kapsamda işlemektedir.",
    ],
  },
  {
    h: "2. İşlenen Kişisel Veriler",
    p: [
      "Üyelik ve platform kullanımı kapsamında şu veriler işlenir: kimlik bilgileri (ad, soyad, kullanıcı adı), iletişim bilgileri (e-posta, telefon), işlem güvenliği bilgileri (IP adresi, oturum ve cihaz/tarayıcı bilgileri), platformda oluşturduğunuz içerikler (şikayet metinleri, yorumlar, değerlendirmeler, yüklenen dosyalar).",
    ],
  },
  {
    h: "3. İşleme Amaçları",
    p: [
      "Kişisel verileriniz; üyelik hesabının oluşturulması ve yönetilmesi, şikayetlerin yayınlanması ve markalara iletilmesi, moderasyon ve güvenlik süreçlerinin yürütülmesi, size bildirim gönderilmesi, yasal yükümlülüklerin yerine getirilmesi ve platform hizmetlerinin iyileştirilmesi amaçlarıyla işlenir.",
    ],
  },
  {
    h: "4. Aktarım",
    p: [
      "Şikayetinizde yer alan içerik, şikayet konusu markanın yetkilileriyle çözüm amacıyla paylaşılır. Anonim şikayetlerde kimlik bilgileriniz markaya gösterilmez. Verileriniz yasal zorunluluk halleri dışında üçüncü kişilere satılmaz ve pazarlama amacıyla paylaşılmaz.",
    ],
  },
  {
    h: "5. Saklama Süresi",
    p: [
      "Verileriniz, üyeliğiniz devam ettiği sürece ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır. Üyeliğinizi sonlandırmanız halinde, yasal saklama yükümlülüğü bulunmayan verileriniz makul süre içinde silinir veya anonim hale getirilir.",
    ],
  },
  {
    h: "6. Haklarınız (KVKK m.11)",
    p: [
      "Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini talep etme, otomatik sistemlerle analiz sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve zarara uğramanız halinde giderilmesini talep etme haklarına sahipsiniz.",
      "Taleplerinizi iletisim@itirazvarplus.com adresine iletebilirsiniz. Başvurularınız en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.",
    ],
  },
];

export const Route = createFileRoute("/_site/(kurumsal)/kvkk")({
  head: () => ({
    ...seoHead({
      title: "KVKK Aydınlatma Metni — itirazvar",
      description:
        "itirazvar KVKK Aydınlatma Metni: hangi kişisel verilerin hangi amaçlarla işlendiği, saklama süreleri ve KVKK kapsamındaki haklarınız.",
      path: "/kvkk",
    }),
  }),
  component: () => (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-2">KVKK Aydınlatma Metni</h1>
        <p className="text-[13px] text-navy-mid mb-10">Son güncelleme: Ağustos 2026</p>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-ink mb-2">{s.h}</h2>
              {s.p.map((par, i) => (
                <p key={i} className="text-navy leading-relaxed mb-2">{par}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  ),
});
