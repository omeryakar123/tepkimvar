import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Building2, PenLine, Search, ShieldCheck } from "lucide-react";
import { EASE, LogoMarquee, Reveal } from "@/components/marketing/shared";
import { siteContactMailto } from "@/lib/contact";

const STEPS = [
  {
    n: 1,
    title: "Marka adını\narayın",
    body: "Arama çubuğuna marka adını yazın veya markalar dizininden firma profiline gidin.",
  },
  {
    n: 2,
    title: "Şikayetinizi\noluşturun",
    body: "Sorunu anlatın, gerekirse belge ekleyin. Moderasyon sonrası yayına alınır.",
  },
  {
    n: 3,
    title: "Sonuçları\ntakip edin",
    body: "Marka yanıtı ve çözüm adımlarını tek sayfada görün; SK kodunuzla paylaşın.",
  },
] as const;

const USER_FEATURES = [
  {
    title: "Kapsamlı bir marka veritabanı",
    body: "tepkimvar, doğrulanmış markalar ve gerçek kullanıcı şikayetlerinden oluşan sürekli güncellenen bir veritabanı tutar. Bir marka listede yoksa veya daha yakından incelemek istiyorsanız şikayet yazarak süreci başlatabilirsiniz.",
  },
  {
    title: "Kolay erişim için kullanıcı dostu arayüz",
    body: "Marka adını arama çubuğuna yazarak çözüm oranı, şikayet geçmişi ve resmi yanıtlar hakkında anında bilgi alın — marka aramak için hesap oluşturmanıza gerek yok.",
  },
  {
    title: "Şikayet paylaşımı",
    body: "Bir markayla sorun yaşadıysanız veya yalnızca deneyiminizi kayda geçirmek istiyorsanız şikayet formunu doldurun. tepkimvar ekibi içeriği inceler; marka resmi yanıt verir ve süreç şeffaf biçimde takip edilir.",
  },
] as const;

export function TepkimvarHowItWorksPage() {
  const reduceMotion = !!useReducedMotion();

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* ── HERO (Gamecheck: başlık + açıklama + banner) ── */}
      <section className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-14 sm:pt-20 pb-10 sm:pb-14 text-center">
          <motion.h1
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="font-display font-black text-[32px] sm:text-[44px] lg:text-[52px] leading-[1.08] tracking-[-0.03em] text-ink"
          >
            tepkimvar nasıl çalışır?
          </motion.h1>
          <motion.p
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
            className="mt-5 text-[15px] sm:text-[17px] text-navy leading-relaxed max-w-2xl mx-auto"
          >
            tepkimvar, bağımsız moderasyon ve resmi marka yanıtlarıyla çevrimiçi markaların
            şikayet ve çözüm süreçlerini şeffaf biçimde kayda geçiren bir platformdur.
          </motion.p>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.14, ease: EASE }}
          className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20"
        >
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-rule shadow-soft bg-card">
            <img
              src="/tepkim-hero.png"
              alt="tepkimvar — nasıl çalışır"
              width={1200}
              height={630}
              className="block w-full h-auto"
              loading="eager"
            />
          </div>
        </motion.div>
      </section>

      {/* ── NEDİR? ── */}
      <section className="py-14 sm:py-20 bg-surface border-b border-rule">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar nedir?
            </h2>
            <p className="mt-5 text-[15px] sm:text-[16px] text-navy leading-[1.75]">
              tepkimvar, dijital hizmet sektörünün kilit aktörlerini — oyuncuları, doğrulanmış
              markaları ve moderasyon ekibini — şeffaflığı ve adaleti teşvik ederek bir araya
              getirir. Gerçek kullanıcı deneyimlerini kayda geçirir, markaların resmi yanıt
              vermesini sağlar ve hiçbir markanın ücret karşılığında şikayet sildirememesini
              garanti eder.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 3 ADIM ── */}
      <section className="py-14 sm:py-20 bg-paper border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <h2 className="font-display font-black text-[24px] sm:text-[32px] text-ink tracking-tight leading-snug">
              Bir markayı kontrol etmek veya şikayet yazmak için tepkimvar&apos;ı nasıl kullanırım?
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((step, i) => (
              <StepItem key={step.n} step={step} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>

          <Reveal className="mt-12 sm:mt-14 flex justify-center">
            <Link
              to="/arama"
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-7 h-12 text-[14px] font-semibold hover:brightness-105 transition shadow-soft"
            >
              Bir markayı ara <Search className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── OYUNCULAR İÇİN ── */}
      <section className="py-14 sm:py-20 bg-surface border-b border-rule">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal className="text-center mb-10 sm:mb-12">
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar oyuncular için ne yapar?
            </h2>
            <p className="mt-4 text-[15px] sm:text-[16px] text-navy leading-relaxed">
              tepkimvar, bir markayla etkileşime geçmeden önce geçmiş şikayetleri ve çözüm
              oranlarını incelemenize yardımcı olur; böylece güvenle karar verebilir, sorun
              yaşarsanız sesinizi duyurabilirsiniz.
            </p>
          </Reveal>

          <div className="space-y-10 sm:space-y-12">
            {USER_FEATURES.map((f, i) => (
              <FeatureBlock key={f.title} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── LOGO MARQUEE ── */}
      <section className="py-10 sm:py-14 bg-paper border-b border-rule overflow-hidden">
        <LogoMarquee />
      </section>

      {/* ── MARKALAR İÇİN ── */}
      <section className="py-14 sm:py-20 bg-surface border-b border-rule">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar markalar için ne yapar?
            </h2>
            <p className="mt-5 text-[15px] sm:text-[16px] text-navy leading-[1.75]">
              tepkimvar, markanızın resmi temsilini doğrulayarak oyuncularla güven inşa etmenize
              yardımcı olur. Resmi yanıtlar, çözüm oranı ve SEAL rozeti tek profilde toplanır —
              dürüst çalışan markalar için eşit ve şeffaf bir oyun alanı desteklenir.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/register/marka-basvuru"
                className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition shadow-soft"
              >
                Marka başvurusu <Building2 className="size-4" />
              </Link>
              <Link
                to="/tepkimvar-seal"
                className="inline-flex items-center gap-2 rounded-full ring-1 ring-rule bg-card px-5 h-11 text-[13px] font-semibold text-ink hover:ring-brand/40 transition"
              >
                SEAL <BadgeCheck className="size-4 text-brand" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── MODERASYON SÜRECİ ── */}
      <section className="py-14 sm:py-20 bg-paper border-b border-rule">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight text-center">
              tepkimvar şikayetleri nasıl kontrol eder?
            </h2>
            <div className="mt-6 space-y-5 text-[15px] sm:text-[16px] text-navy leading-[1.75]">
              <p>
                Bir şikayet gönderildiğinde tepkimvar ekibi, içeriğin platform kurallarına uygun
                olup olmadığını kontrol eder — küfür, kişisel veri ve spam otomatik filtrelerden
                geçer; şüpheli içerik manuel incelemeye alınır.
              </p>
              <p>
                İnceleme devam ederken şikayet durumu{" "}
                <strong className="font-semibold text-ink">Onay Bekliyor</strong> olarak görünür.
                Onaylandığında marka paneline düşer ve{" "}
                <strong className="font-semibold text-ink">Yayında</strong> statüsüne geçer. Marka
                resmi yanıt verdiğinde sayfa{" "}
                <strong className="font-semibold text-ink">Yanıtlandı</strong> olarak güncellenir;
                çözüm müşteri onayıyla{" "}
                <strong className="font-semibold text-ink">Çözüldü</strong> statüsüne taşınır.
              </p>
            </div>
            <div className="mt-8 text-center">
              <Link
                to="/tepkimvar-seal"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand group"
              >
                tepkimvar SEAL&apos;ı keşfedin
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SEAL GÖRSEL ── */}
      <section className="py-14 sm:py-20 bg-surface border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <h2 className="font-display font-black text-[26px] sm:text-[32px] text-ink tracking-tight leading-tight">
              Doğrulanmış markalar için SEAL rozeti
            </h2>
            <p className="mt-4 text-[15px] text-navy leading-relaxed">
              Resmi temsil onayı, periyodik denetim ve QR kodlu rozet — oyuncular saniyeler
              içinde markanın gerçek profil olup olmadığını doğrular.
            </p>
            <Link
              to="/tepkimvar-seal"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition shadow-soft"
            >
              SEAL sayfası <ShieldCheck className="size-4" />
            </Link>
          </Reveal>
          <Reveal>
            <div className="rounded-2xl overflow-hidden ring-1 ring-rule shadow-soft bg-card p-2 max-w-sm mx-auto lg:max-w-none">
              <img
                src="/dogrulama-rozeti.jpg"
                alt="tepkimvar SEAL rozeti"
                className="w-full h-auto rounded-xl"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SON CTA (Gamecheck tarzı) ── */}
      <section className="py-16 sm:py-24 bg-paper">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display font-black text-[28px] sm:text-[40px] text-ink tracking-tight leading-tight">
              Güven görünür.
              <span className="block text-brand mt-1">Sesiniz duyulsun.</span>
            </h2>
            <p className="mt-4 text-[15px] sm:text-[16px] text-navy-mid">
              Deneyiminizi paylaşın veya markanızı doğrulayarak oyuncu güvenini artırın.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/sikayet-yaz"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-7 h-12 text-[14px] font-semibold hover:brightness-105 transition shadow-soft"
              >
                Şikayet yaz <PenLine className="size-4" />
              </Link>
              <a
                href={siteContactMailto("tepkimvar SEAL başvurusu")}
                className="inline-flex items-center justify-center gap-2 rounded-full ring-1 ring-rule bg-card px-7 h-12 text-[14px] font-semibold text-ink hover:ring-brand/40 transition"
              >
                SEAL edinin <BadgeCheck className="size-4 text-brand" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

/* ─── Bileşenler ─── */

function StepItem({
  step,
  index,
  reduceMotion,
}: {
  step: (typeof STEPS)[number];
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
      className="text-center"
    >
      <div className="inline-flex items-center justify-center size-14 sm:size-16 rounded-full bg-brand text-brand-foreground font-display font-black text-[22px] sm:text-[26px] mb-5">
        {step.n}
      </div>
      <h3 className="font-display font-bold text-[18px] sm:text-[20px] text-ink leading-snug whitespace-pre-line">
        {step.title}
      </h3>
      <p className="mt-3 text-[14px] sm:text-[15px] text-navy-mid leading-relaxed max-w-xs mx-auto">
        {step.body}
      </p>
    </motion.div>
  );
}

function FeatureBlock({
  title,
  body,
  index,
}: {
  title: string;
  body: string;
  index: number;
}) {
  return (
    <Reveal>
      <div className={index > 0 ? "pt-10 sm:pt-12 border-t border-rule" : ""}>
        <h3 className="font-display font-bold text-[18px] sm:text-[22px] text-ink leading-snug">
          {title}
        </h3>
        <p className="mt-3 text-[15px] sm:text-[16px] text-navy leading-[1.75]">{body}</p>
      </div>
    </Reveal>
  );
}
