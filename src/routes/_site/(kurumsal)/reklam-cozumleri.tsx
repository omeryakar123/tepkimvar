import { createFileRoute, Link } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import { siteContactMailto } from "@/lib/contact";
import { ArrowRight, Target, Sparkles, BarChart3, Users, Globe, ShieldCheck, MessageCircle } from "lucide-react";

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
    { v: "120M+", k: "Reklam envanteri", icon: BarChart3 },
    { v: "%88", k: "Organik trafik", icon: Globe },
    { v: "14M+", k: "Bireysel üye", icon: Users },
    { v: "21M+", k: "Aylık ziyaret", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-rule bg-gradient-to-b from-brand-soft/40 to-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-card text-brand px-3 h-8 text-[12px] font-semibold ring-1 ring-brand/20 mb-5">
              <Sparkles className="size-3.5" /> Kurumsal çözümler
            </span>
            <h1 className="font-display font-black text-[26px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-ink">
              Alışveriş kararı veren milyonlara{" "}
              <span className="text-brand">tepkimvar</span> üzerinden ulaşın
            </h1>
            <p className="mt-4 text-[14px] sm:text-[16px] text-navy leading-relaxed">
              Premium, hedefli ve programatik reklam modelleriyle markanızı doğru zamanda,
              doğru kullanıcıya gösterin.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href={siteContactMailto("Reklam çözümleri")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:bg-brand-hover transition"
              >
                Satış ekibiyle görüş <ArrowRight className="size-4" />
              </a>
              <Link
                to="/register/marka-basvuru"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-card ring-1 ring-rule px-6 h-11 text-[13px] font-semibold hover:bg-surface transition"
              >
                Marka başvurusu yap
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.k} className="bg-card rounded-2xl p-4 sm:p-5 ring-1 ring-rule">
                  <span className="inline-grid place-items-center size-9 rounded-xl bg-brand-soft text-brand mb-3">
                    <Icon className="size-4" />
                  </span>
                  <div className="font-display font-black text-[20px] sm:text-[26px] text-ink tabular-nums">{m.v}</div>
                  <div className="text-[11px] sm:text-[12px] text-navy-mid mt-1">{m.k}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-2 gap-8 items-center">
          <div className="rounded-3xl bg-gradient-to-br from-ink to-brand p-8 sm:p-10 text-paper min-h-[220px] flex flex-col justify-end">
            <ShieldCheck className="size-10 text-brand mb-4" />
            <h2 className="font-display font-bold text-[22px] sm:text-[26px] leading-snug">
              Neden tepkimvar reklamları?
            </h2>
            <p className="mt-3 text-[13px] sm:text-[14px] text-paper/80 leading-relaxed">
              Kullanıcılar satın almadan önce marka deneyimlerini araştırır.
              Doğru görünürlük, güven ve dönüşüm sağlar.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: MessageCircle, t: "Yüksek niyetli kitle", d: "Alışverişe yakın, aktif araştıran kullanıcılar." },
              { icon: Target, t: "Marka sayfası görünürlüğü", d: "Firma profilinizde doğrudan yer alın." },
              { icon: ShieldCheck, t: "İtibar yönetimi", d: "Şikayet ve teşekkürleri çözüm odaklı yönetin." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.t} className="flex gap-4 bg-card rounded-2xl p-4 ring-1 ring-rule">
                  <span className="grid place-items-center size-10 rounded-xl bg-brand-soft text-brand shrink-0">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold text-[14px] text-ink">{item.t}</div>
                    <div className="text-[13px] text-navy-mid mt-0.5">{item.d}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h2 className="font-display font-bold text-[20px] sm:text-[26px] leading-snug">
            tepkimvar Pro ile müşteri tabanınızı büyütün
          </h2>
          <p className="mt-3 text-[13px] sm:text-[14px] text-paper/75 max-w-md mx-auto">
            Çözüm sunan markalar arasına katılın; Pro üyelik avantajlarından yararlanın.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={siteContactMailto("Pro üyelik")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-card text-brand px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition"
            >
              Pro üyelik için iletişim
            </a>
            <Link
              to="/register/marka-basvuru"
              className="inline-flex items-center justify-center gap-2 rounded-full ring-1 ring-paper/30 text-paper px-6 h-11 text-[13px] font-semibold hover:bg-paper/10 transition"
            >
              Marka başvurusu yap
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
