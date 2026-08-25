import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import { ArrowRight, Target, Sparkles, Radar, Check } from "lucide-react";
// Self-host edilen görseller (public/) — eski Lovable asset servisi (/__l5e)
// kendi deploy'umuzda yok, o yüzden fotoğraflar kırılıyordu.
const happyUser = { url: "/reklam-happy.jpg" };
const userDesk = { url: "/reklam-desk.jpg" };

export const Route = createFileRoute("/_site/(kurumsal)/reklam-cozumleri")({
  head: () => ({
    ...seoHead({
      title: "Reklam Çözümleri — tepkimvar",
      description: "Milyonların alışveriş kararlarını aldığı tepkimvar'da hedef kitlenize kolayca ulaşın. Premium, hedefli ve programatik reklam modelleri.",
      path: "/reklam-cozumleri",
    }),
  }),
  component: AdsPage,
});

function AdsPage() {
  const metrics = [
    { v: "120 milyon", k: "Reklam Envanteri" },
    { v: "%88", k: "Organik Trafik" },
    { v: "14 milyon", k: "Bireysel Üye Sayısı" },
    { v: "21 milyon", k: "Aylık Ziyaret" },
  ];

  const models = [
    {
      title: "Premium Reklam", icon: Sparkles,
      lead: "Marka sayfanızdaki reklam alanlarını 1 yıl boyunca siz yönetin.",
      bullets: [
        "Marka sayfanızdaki reklam alanlarında yalnızca sizin görselleriniz yayınlanır.",
        "Kampanyalarınızı takvimlere göre planlayabilir, hedeflemelerle özelleştirebilirsiniz.",
        "Doğru bilinen yanlışlara karşı marka itibarınızı doğrudan yönetebilirsiniz.",
      ],
    },
    {
      title: "Hedefli Reklam", icon: Target,
      lead: "Kullanıcı & marka hedeflemesi ile doğru kitleye ulaşın.",
      bullets: [
        "Kullanıcı Hedeflemeli: kullanıcının ziyaret geçmişine göre reklam gösterimi.",
        "Marka Hedeflemeli: seçtiğiniz markanın sayfalarında rakip görünürlük.",
      ],
    },
    {
      title: "Programatik Reklam", icon: Radar,
      lead: "Facebook, Google gibi platformlarda otomatik yayın.",
      bullets: [
        "Seçtiğiniz hedef kitleye programatik olarak ulaşın.",
        "Marka bilinirliği ve dönüşüm için performans odaklı.",
        "Bütçeye göre esnek yönetim ve raporlama.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-paper">

      {/* HERO */}
      <section className="grid md:grid-cols-2 gap-0">
        <div className="px-6 sm:px-10 lg:px-16 py-16 lg:py-24 bg-paper">
          <h1 className="font-display font-black text-[36px] sm:text-[46px] leading-[1.05] tracking-[-0.02em] text-ink">
            Milyonların alışveriş kararlarını aldığı{" "}
            <span className="text-brand">tepkimvar'da</span>{" "}
            hedef kitlenize kolayca ulaşın.
          </h1>
          <p className="mt-5 text-[14.5px] text-navy leading-relaxed max-w-md">
            Türkiye'nin en büyük tüketici deneyimi platformunda markanızı öne çıkarın.
            Premium, hedefli ve programatik reklam modelleriyle doğru zamanda doğru kişiye ulaşın.
          </p>
          <a href="#modeller" className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold">
            Daha Fazla Bilgi Al <ArrowRight className="size-4" />
          </a>
        </div>
        <div className="relative bg-[oklch(0.22_0.02_262)] min-h-[400px] overflow-hidden">
          <div className="absolute right-10 top-10 size-32 rounded-full overflow-hidden ring-4 ring-white/20">
            <img src={happyUser.url} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute left-16 top-32 size-24 rounded-full overflow-hidden ring-4 ring-white/20">
            <img src={userDesk.url} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute right-24 bottom-14 size-20 rounded-full bg-brand grid place-items-center">
            <Sparkles className="size-8 text-white" />
          </div>
          <div className="absolute left-10 bottom-8 size-14 rounded-full bg-[oklch(0.86_0.16_92)]" />
          <div className="absolute left-1/2 top-8 size-10 rounded-full bg-[oklch(0.62_0.18_285)]" />
        </div>
      </section>

      {/* METRICS */}
      <section className="border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {metrics.map((m) => (
            <div key={m.k}>
              <div className="font-display font-black text-[28px] text-ink">{m.v}</div>
              <div className="text-[12px] text-navy-mid mt-1">{m.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose */}
      <section className="bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div className="relative rounded-3xl bg-[oklch(0.86_0.16_92)] p-6 aspect-square max-w-md overflow-hidden">
            <img src={happyUser.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute -bottom-6 -right-6 size-32 rounded-full bg-[oklch(0.62_0.18_285)]" />
            <div className="absolute -bottom-4 left-8 size-16 rounded-full bg-brand" />
          </div>
          <div>
            <h2 className="font-display font-bold text-[24px] text-ink">tepkimvar Reklamları Neden Tercih Ediliyor?</h2>
            <p className="mt-4 text-[14px] text-navy leading-relaxed">
              Ziyaretçilerin %88'i satın alma kararı vermeden önce markayla ilgili tüketici deneyimi arar.
              Etkili bir şekilde şikayetleri ve teşekkürleri yöneterek marka itibarınızı güçlendirin.
              Bu modelde şikayetçi olduğu marka ile ilgili sorunu çözülen kullanıcının, tekrar aynı markadan alışveriş yapma oranı %90 üzerindedir.
            </p>
          </div>
        </div>
      </section>

      {/* MODELS */}
      <section id="modeller" className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <h2 className="text-center font-display font-bold text-[24px] text-ink mb-10">Reklam Modelleri</h2>
          <div className="space-y-6 max-w-4xl mx-auto">
            {models.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.title} className="bg-card rounded-2xl p-8 ring-1 ring-rule">
                  <div className="flex items-start gap-4">
                    <span className="grid place-items-center size-11 rounded-xl bg-brand-soft text-brand shrink-0">
                      <Icon className="size-5" />
                    </span>
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-[18px] text-ink">{m.title}</h3>
                      <p className="mt-1 text-[13.5px] text-navy">{m.lead}</p>
                    </div>
                  </div>
                  <ul className="mt-5 grid md:grid-cols-2 gap-3">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[13px] text-navy">
                        <Check className="size-4 text-brand mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <a href="https://t.me/tepkimvarplus" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold">
                      İletişime Geç <ArrowRight className="size-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Purple CTA */}
      <section className="bg-[oklch(0.62_0.18_285)] text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
          <h2 className="font-display font-bold text-[22px]">tepkimvar Pro üyelik ile hem memnuniyeti hem de müşterilerinizi artırın.</h2>
          <p className="mt-3 text-[13px] text-white/85">Çözüm sunan markalar arasına katılmak için Pro üyelik özelliklerinden faydalanın.</p>
          <a href="https://t.me/tepkimvarplus" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-card text-[oklch(0.62_0.18_285)] px-6 h-11 text-[13px] font-semibold">
            Pro Üyelik için İletişime Geç
          </a>
        </div>
      </section>

    </div>
  );
}
