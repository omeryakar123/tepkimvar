import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import { ArrowRight, Target, Sparkles, Radar, Check, BarChart3, Users, Globe } from "lucide-react";

const happyUser = { url: "/reklam-happy.jpg" };
const userDesk = { url: "/reklam-desk.jpg" };

export const Route = createFileRoute("/_site/(kurumsal)/reklam-cozumleri")({
  head: () => ({
    ...seoHead({
      title: "Reklam Çözümleri — tepkimvar",
      description:
        "Milyonların alışveriş kararlarını aldığı tepkimvar'da hedef kitlenize kolayca ulaşın. Premium, hedefli ve programatik reklam modelleri.",
      path: "/reklam-cozumleri",
    }),
  }),
  component: AdsPage,
});

function AdsPage() {
  const metrics = [
    { v: "120 milyon", k: "Reklam Envanteri", icon: BarChart3 },
    { v: "%88", k: "Organik Trafik", icon: Globe },
    { v: "14 milyon", k: "Bireysel Üye", icon: Users },
    { v: "21 milyon", k: "Aylık Ziyaret", icon: Sparkles },
  ];

  const models = [
    {
      title: "Premium Reklam",
      icon: Sparkles,
      lead: "Marka sayfanızdaki reklam alanlarını 1 yıl boyunca siz yönetin.",
      bullets: [
        "Marka sayfanızdaki reklam alanlarında yalnızca sizin görselleriniz yayınlanır.",
        "Kampanyalarınızı takvimlere göre planlayabilir, hedeflemelerle özelleştirebilirsiniz.",
        "Doğru bilinen yanlışlara karşı marka itibarınızı doğrudan yönetebilirsiniz.",
      ],
    },
    {
      title: "Hedefli Reklam",
      icon: Target,
      lead: "Kullanıcı & marka hedeflemesi ile doğru kitleye ulaşın.",
      bullets: [
        "Kullanıcı Hedeflemeli: ziyaret geçmişine göre reklam gösterimi.",
        "Marka Hedeflemeli: seçtiğiniz markanın sayfalarında rakip görünürlük.",
      ],
    },
    {
      title: "Programatik Reklam",
      icon: Radar,
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
      <section className="border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-12 sm:py-16 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-3 h-7 text-[12px] font-semibold ring-1 ring-brand/15 mb-4">
                <Sparkles className="size-3.5" /> Kurumsal çözümler
              </span>
              <h1 className="font-display font-black text-[28px] sm:text-[40px] lg:text-[46px] leading-[1.08] tracking-[-0.02em] text-ink">
                Milyonların alışveriş kararını aldığı{" "}
                <span className="text-brand">tepkimvar'da</span> hedef kitlenize ulaşın.
              </h1>
              <p className="mt-4 text-[14px] sm:text-[15px] text-navy leading-relaxed max-w-lg">
                Türkiye'nin bağımsız tüketici deneyimi platformunda markanızı öne çıkarın.
                Premium, hedefli ve programatik reklam modelleriyle doğru zamanda doğru kişiye ulaşın.
              </p>
              <a
                href="#modeller"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:bg-brand-hover transition"
              >
                Modelleri İncele <ArrowRight className="size-4" />
              </a>
            </div>

            <div className="relative rounded-3xl bg-gradient-to-br from-ink via-ink to-brand/80 min-h-[280px] sm:min-h-[360px] overflow-hidden ring-1 ring-rule">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
              <div className="absolute right-6 top-6 sm:right-10 sm:top-10 size-24 sm:size-32 rounded-2xl overflow-hidden ring-4 ring-white/25 shadow-lift">
                <img src={happyUser.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute left-6 bottom-6 sm:left-10 sm:bottom-10 size-20 sm:size-28 rounded-2xl overflow-hidden ring-4 ring-white/25 shadow-lift">
                <img src={userDesk.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute right-1/4 bottom-1/3 size-14 rounded-full bg-brand grid place-items-center ring-4 ring-white/20">
                <Sparkles className="size-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section className="bg-surface border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.k}
                  className="bg-card rounded-2xl p-4 sm:p-5 ring-1 ring-rule text-center sm:text-left"
                >
                  <span className="inline-grid place-items-center size-9 rounded-xl bg-brand-soft text-brand mb-3">
                    <Icon className="size-4" />
                  </span>
                  <div className="font-display font-black text-[22px] sm:text-[26px] text-ink tabular-nums">{m.v}</div>
                  <div className="text-[11px] sm:text-[12px] text-navy-mid mt-1">{m.k}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why choose */}
      <section className="bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20 grid md:grid-cols-2 gap-8 sm:gap-10 items-center">
          <div className="relative rounded-3xl overflow-hidden aspect-[4/3] max-w-md mx-auto md:mx-0 ring-1 ring-rule shadow-pop">
            <img src={happyUser.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
          </div>
          <div>
            <h2 className="font-display font-bold text-[22px] sm:text-[26px] text-ink leading-snug">
              tepkimvar Reklamları Neden Tercih Ediliyor?
            </h2>
            <p className="mt-4 text-[14px] text-navy leading-relaxed">
              Ziyaretçilerin büyük çoğunluğu satın alma kararı vermeden önce markayla ilgili tüketici
              deneyimi arar. Şikayetleri ve teşekkürleri etkili yöneterek marka itibarınızı güçlendirin.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Yüksek niyetli, alışverişe yakın kitle",
                "Marka sayfasında doğrudan görünürlük",
                "Çözüm odaklı itibar yönetimi",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] text-navy">
                  <Check className="size-4 text-brand mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* MODELS */}
      <section id="modeller" className="bg-surface scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <h2 className="font-display font-bold text-[24px] sm:text-[28px] text-ink">Reklam Modelleri</h2>
            <p className="mt-2 text-[13px] text-navy-mid">
              İhtiyacınıza uygun modeli seçin; ekibimiz kurulumda yanınızda olsun.
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {models.map((m) => {
              const Icon = m.icon;
              return (
                <article
                  key={m.title}
                  className="bg-card rounded-2xl p-6 sm:p-7 ring-1 ring-rule flex flex-col hover:shadow-pop transition-shadow"
                >
                  <span className="grid place-items-center size-12 rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display font-bold text-[18px] text-ink">{m.title}</h3>
                  <p className="mt-2 text-[13.5px] text-navy leading-relaxed">{m.lead}</p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[13px] text-navy">
                        <Check className="size-4 text-brand mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://t.me/tepkimvarplus"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:bg-brand-hover transition w-full sm:w-auto"
                  >
                    İletişime Geç <ArrowRight className="size-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-paper dark:bg-surface dark:text-ink">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h2 className="font-display font-bold text-[20px] sm:text-[24px] leading-snug">
            tepkimvar Pro ile memnuniyeti ve müşteri tabanınızı büyütün.
          </h2>
          <p className="mt-3 text-[13px] text-paper/75 dark:text-navy-mid max-w-md mx-auto">
            Çözüm sunan markalar arasına katılmak için Pro üyelik özelliklerinden faydalanın.
          </p>
          <a
            href="https://t.me/tepkimvarplus"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-card text-brand px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition"
          >
            Pro Üyelik için İletişime Geç
          </a>
        </div>
      </section>
    </div>
  );
}
