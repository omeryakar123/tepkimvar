import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Genel",
    p: [
      "tepkimvar olarak kullanıcılarımızın gizliliğini önemsiyoruz. Bu politika; hangi verileri topladığımızı, nasıl kullandığımızı ve haklarınızı açıklar. Platformu kullanarak bu politikayı kabul etmiş sayılırsınız.",
    ],
  },
  {
    h: "2. Toplanan Veriler",
    p: [
      "Üyelik sırasında: ad soyad, e-posta ve isteğe bağlı telefon numarası. Kullanım sırasında: IP adresi, cihaz/tarayıcı bilgileri, oturum kayıtları. İçerik olarak: yazdığınız şikayetler, yorumlar, değerlendirmeler ve yüklediğiniz dosyalar.",
    ],
  },
  {
    h: "3. Kullanım Amaçları",
    p: [
      "Toplanan veriler; hesabınızın yönetimi, şikayetlerinizin yayınlanması ve markalara iletilmesi, güvenlik ve moderasyon, size bildirim gönderimi ve hizmet kalitesinin artırılması için kullanılır. Verileriniz üçüncü taraflara satılmaz.",
    ],
  },
  {
    h: "4. Çerezler",
    p: [
      "Platform, oturumunuzu açık tutmak ve tercihlerinizi (ör. tema seçimi) hatırlamak için zorunlu çerezler kullanır. Üçüncü taraf reklam/izleme çerezi kullanılmamaktadır.",
    ],
  },
  {
    h: "5. Veri Güvenliği",
    p: [
      "Verileriniz şifreli bağlantı (HTTPS) üzerinden taşınır, parolalar geri döndürülemez şekilde özetlenerek saklanır. Şikayet eklerinize erişim yetki kontrolüne tabidir; gizli olarak işaretlenen belgeler yalnızca yetkili taraflarca görüntülenebilir.",
    ],
  },
  {
    h: "6. Anonimlik",
    p: [
      "Şikayetinizi anonim olarak yayınlamayı seçebilirsiniz. Bu durumda adınız diğer kullanıcılara ve markaya gösterilmez; yalnızca platform moderasyonu şikayet sahibini görebilir.",
    ],
  },
  {
    h: "7. İletişim",
    p: [
      "Gizlilikle ilgili soru ve talepleriniz için iletisim@tepkimvarplus.com adresine yazabilirsiniz. Ayrıntılı bilgi için KVKK Aydınlatma Metni'ni inceleyebilirsiniz.",
    ],
  },
];

export const Route = createFileRoute("/_site/(kurumsal)/gizlilik")({
  head: () => ({
    ...seoHead({
      title: "Gizlilik Politikası — tepkimvar",
      description:
        "tepkimvar Gizlilik Politikası: hangi verileri topladığımız, nasıl koruduğumuz, çerez kullanımı ve anonim şikayet hakkınız.",
      path: "/gizlilik",
    }),
  }),
  component: () => (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-2">Gizlilik Politikası</h1>
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
