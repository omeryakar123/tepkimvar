import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { seoHead, jsonLd } from "@/lib/seo";

const groups = [
  {
    id: "uyelik",
    title: "Üyelik",
    items: [
      { q: "Nasıl üye olurum?", a: "Sağ üstteki 'Giriş / Üye Ol' bağlantısından e-postanızla saniyeler içinde üye olabilirsiniz. Google hesabınızla da giriş yapabilirsiniz." },
      { q: "Şifremi unuttum, ne yapmalıyım?", a: "Giriş ekranındaki 'Şifremi Unuttum' bağlantısını kullanın; e-postanıza 6 haneli doğrulama kodu gönderilir." },
      { q: "Üyelik ücretli mi?", a: "Hayır. Şikayet yazmak, yorum yapmak ve markaları puanlamak tamamen ücretsizdir." },
      { q: "Hesabımı nasıl silerim?", a: "Profil sayfanızdaki ayarlardan hesabınızı kapatabilir veya iletisim@itirazvarplus.com adresine yazarak silinmesini talep edebilirsiniz." },
    ],
  },
  {
    id: "sikayet",
    title: "Şikayet Süreci",
    items: [
      { q: "Şikayet nasıl yazılır?", a: "'Şikayet Yaz' düğmesine tıklayın, firmayı ve kategoriyi seçin, yaşadığınız sorunu anlatın. Dilerseniz görsel veya belge ekleyebilirsiniz." },
      { q: "Şikayetim neden yayınlanmadı?", a: "İçerik moderasyondan geçmediğinde yayınlanmaz — küfür, hakaret, kişisel veri veya spam içeren şikayetler incelemeye alınır ya da reddedilir." },
      { q: "Anonim şikayet yazabilir miyim?", a: "Evet. Şikayet yazarken 'Anonim olarak paylaş' seçeneğini işaretlerseniz adınız diğer kullanıcılara ve markaya gösterilmez." },
      { q: "Şikayetimi nasıl silerim?", a: "Profilinizden ilgili şikayete giderek 'Sil' düğmesini kullanabilirsiniz." },
    ],
  },
  {
    id: "cozum",
    title: "Çözüm Aşaması",
    items: [
      { q: "Şikayetim ne zaman çözülür?", a: "Süre markaya göre değişir; aktif markalar genellikle ilk yanıtı birkaç saat içinde verir. Yanıt geldiğinde bildirim alırsınız." },
      { q: "Marka cevap vermezse ne olur?", a: "Şikayetiniz yayında kalmaya devam eder ve markanın çözüm oranını etkiler. Dilerseniz şikayetinizi platform yönetiminin incelemesine iletebilirsiniz." },
      { q: "Şikayetimi nasıl 'çözüldü' yaparım?", a: "Sorununuz giderildiyse şikayet sayfanızdaki 'Sorunum çözüldü' adımlarını takip edin; markayı 5 yıldız üzerinden değerlendirip bir teşekkür notu bırakabilirsiniz." },
      { q: "Verdiğim puan neyi etkiler?", a: "Çözüm puanınız markanın genel yıldız ortalamasına ve çözüm istatistiklerine doğrudan yansır — böylece diğer tüketiciler gerçek performansı görür." },
    ],
  },
  {
    id: "markalar",
    title: "Markalar",
    items: [
      { q: "Marka hesabı nasıl açılır?", a: "Firma girişi sayfasından marka hesabınızı oluşturup şirketinize ait şikayetleri yanıtlamaya başlayabilirsiniz." },
      { q: "Marka nasıl doğrulanır?", a: "Marka sayfanızdaki 'Doğrulanmış Firma Başvurusu' formunu doldurun; ekibimiz ticari bilgilerinizi kontrol edip sizinle iletişime geçer." },
      { q: "Şikayetlere nasıl yanıt veririm?", a: "Marka paneline giriş yaptıktan sonra size iletilen şikayetleri görüntüleyebilir ve her birine resmi yanıt yazabilirsiniz." },
      { q: "Premium üyelik ne sağlar?", a: "Premium markalar sayfalarını özelleştirebilir, reklam alanlarını yönetebilir ve gelişmiş istatistiklere erişebilir. Detaylar için Reklam Çözümleri sayfasına bakın." },
    ],
  },
];

export const Route = createFileRoute("/_site/(kurumsal)/yardim")({
  head: () => ({
    ...seoHead({
      title: "Yardım ve SSS — itirazvar",
      description:
        "itirazvar yardım merkezi: üyelik, şikayet yazma, çözüm süreci ve marka hesapları hakkında sıkça sorulan sorular ve cevapları.",
      path: "/yardim",
    }),
    scripts: [
      // FAQPage şeması — Google'da zengin SSS sonucu için.
      jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: groups.flatMap((g) =>
          g.items.map((it) => ({
            "@type": "Question",
            name: it.q,
            acceptedAnswer: { "@type": "Answer", text: it.a },
          })),
        ),
      }),
    ],
  }),
  component: Page,
});

function Page() {
  const [open, setOpen] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState("uyelik");
  const [query, setQuery] = useState("");

  // Arama doluysa tüm gruplarda filtrele; boşsa seçili grubu göster.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups.find((g) => g.id === activeGroup)?.items ?? [];
    return groups.flatMap((g) => g.items).filter(
      (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
    );
  }, [query, activeGroup]);

  return (
    <div>
      <div className="bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-navy-mid mb-3">Yardım</p>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-ink mb-6">Size Nasıl Yardımcı Olabiliriz?</h1>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-navy-mid" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Yardım almak istediğiniz konuyu yazın"
              className="w-full h-14 pl-12 pr-4 rounded-full bg-card ring-1 ring-rule shadow-soft focus:outline-none focus:ring-brand/40"
            />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid md:grid-cols-[220px,1fr] gap-8">
        <aside className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => { setActiveGroup(g.id); setQuery(""); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${activeGroup === g.id && !query ? "text-brand font-semibold" : "text-navy-mid hover:text-ink"}`}
            >
              {activeGroup === g.id && !query && <span className="text-brand mr-2">•</span>}
              {g.title}
            </button>
          ))}
        </aside>
        <div className="space-y-3">
          {shown.length === 0 && (
            <div className="bg-surface rounded-xl px-5 py-8 text-center text-navy-mid text-sm">
              "{query}" için sonuç bulunamadı. Sorunuza yanıt bulamadıysanız{" "}
              <a href="/iletisim" className="text-brand hover:underline">bize ulaşın</a>.
            </div>
          )}
          {shown.map((it) => (
            <details
              key={it.q}
              open={open === it.q}
              onToggle={(e) => e.currentTarget.open && setOpen(it.q)}
              className="bg-surface rounded-xl px-5 py-4 group"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none text-ink font-medium">
                {it.q}
                <ChevronDown className="size-4 text-navy-mid group-open:rotate-180 transition" />
              </summary>
              <p className="mt-3 text-sm text-navy leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
