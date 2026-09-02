import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  FileSearch,
  MessageCircle,
  PenLine,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  EASE,
  HeroBackground,
  LogoMarquee,
  Reveal,
  fadeUp,
  stagger,
} from "@/components/marketing/shared";
import { siteContactMailto } from "@/lib/contact";

export function TepkimvarHowItWorksPage() {
  const reduceMotion = !!useReducedMotion();

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-rule site-cta-shell">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center relative">
          <motion.div initial="hidden" animate="visible" variants={stagger(reduceMotion)} className="min-w-0">
            <motion.span variants={fadeUp(reduceMotion)} className="site-cta-badge mb-5">
              <Sparkles className="size-3.5 shrink-0" /> Rehber
            </motion.span>
            <motion.h1
              variants={fadeUp(reduceMotion, 0.08)}
              className="font-display font-black text-[32px] sm:text-[48px] leading-[1.05] tracking-[-0.025em] text-white"
            >
              tepkimvar
              <span className="block mt-1 site-cta-gradient-text">nasıl çalışır?</span>
            </motion.h1>
            <motion.p variants={fadeUp(reduceMotion, 0.16)} className="mt-5 text-[14px] sm:text-[16px] site-cta-muted leading-relaxed max-w-xl">
              Bağımsız şikayet platformu: markaları araştırın, deneyiminizi paylaşın, resmi yanıt ve
              çözüm sürecini şeffaf biçimde takip edin.
            </motion.p>
          </motion.div>
          <HeroVisual reduceMotion={reduceMotion} />
        </div>
      </section>

      {/* BANNER */}
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
          <Reveal className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="font-display font-black text-[24px] sm:text-[32px] text-ink tracking-tight">
                tepkimvar nedir?
              </h2>
              <p className="mt-4 text-[14px] sm:text-[15px] text-navy leading-relaxed">
                tepkimvar; oyuncuları, doğrulanmış markaları ve bağımsız moderasyon ekibini bir araya
                getiren Türkiye&apos;nin şikayet çözüm platformudur. Amacımız taraf tutmadan gerçek
                müşteri deneyimlerini kayda geçirmek, markaların resmi yanıt vermesini sağlamak ve
                çözüm sürecini herkes için görünür kılmaktır.
              </p>
              <p className="mt-3 text-[14px] text-navy-mid leading-relaxed">
                Hiçbir marka ücret karşılığında şikayet sildiremez; puan ve sıralama gerçek çözüm
                performansına dayanır.
              </p>
            </div>
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="relative overflow-hidden rounded-2xl ring-1 ring-rule shadow-lift"
            >
              <img
                src="/tepkim-hero.png"
                alt="tepkimvar platformu — şikayet ve çözüm takibi"
                width={1200}
                height={630}
                className="block w-full h-auto"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent pointer-events-none" aria-hidden />
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* 3 STEPS */}
      <section className="py-14 sm:py-20 border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              Bir markayı kontrol etmek veya şikayet yazmak
            </h2>
            <p className="mt-3 text-[14px] text-navy-mid">Üç adımda başlayın — hesap açmadan marka arayabilirsiniz.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                n: "1",
                icon: Search,
                t: "Markayı ara veya seç",
                d: "Arama çubuğuna marka adını yazın veya markalar dizininden firma profiline gidin.",
                cta: { label: "Marka ara", to: "/markalar" as const },
              },
              {
                n: "2",
                icon: PenLine,
                t: "Şikayetini yaz",
                d: "Giriş yapın, sorunu anlatın, belge ekleyin. Şikayetin moderasyon sonrası yayına alınır.",
                cta: { label: "Şikayet yaz", to: "/sikayet-yaz" as const },
              },
              {
                n: "3",
                icon: Eye,
                t: "Süreci takip et",
                d: "Marka yanıtı, çözüm adımları ve topluluk desteği tek sayfada — SK kodunuzla paylaşın.",
                cta: { label: "Şikayetlere bak", to: "/sikayetler" as const },
              },
            ].map((step, i) => (
              <StepCard key={step.n} step={step} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>

          <Reveal className="mt-10 text-center">
            <Link to="/arama" className="site-cta-btn inline-flex w-full sm:w-auto shadow-lg shadow-brand/20">
              Marka veya şikayet ara <Search className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FOR USERS */}
      <section className="py-14 sm:py-20 bg-surface border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar kullanıcılar için ne yapar?
            </h2>
            <p className="mt-3 text-[14px] text-navy leading-relaxed">
              Alışveriş veya hizmet almadan önce marka skorunu inceleyin; sorun yaşarsanız sesinizi
              duyurun ve çözümü şeffaf biçimde takip edin.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Database,
                t: "Kapsamlı marka veritabanı",
                d: "Binlerce marka profili, çözüm oranı, yanıt süresi ve gerçek şikayet geçmişi — sürekli güncellenir.",
              },
              {
                icon: FileSearch,
                t: "Kolay arama arayüzü",
                d: "Marka adı, kategori veya SK kodu ile anında arama. Üye olmadan marka profillerini gezinin.",
              },
              {
                icon: ClipboardList,
                t: "Şikayet ve moderasyon",
                d: "Şikayetiniz incelenir, uygun bulunursa yayına alınır. Marka resmi yanıt vermek zorundadır.",
              },
            ].map((item, i) => (
              <FeatureCard key={item.t} {...item} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* LOGO MARQUEE */}
      <section className="border-b border-rule bg-paper py-8 sm:py-10 overflow-hidden">
        <Reveal>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-navy-mid mb-6">
            Platformda yer alan markalar
          </p>
        </Reveal>
        <LogoMarquee />
      </section>

      {/* FOR BRANDS */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-3 h-8 text-[11px] font-semibold ring-1 ring-brand/20 mb-4">
              <Building2 className="size-3.5" /> Markalar için
            </div>
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar markalar için ne yapar?
            </h2>
            <p className="mt-4 text-[14px] text-navy leading-relaxed">
              Doğrulanmış marka profilinizle oyuncularla güven inşa edin. Şikayetlere resmi yanıt
              verin, çözüm oranınızı artırın ve SEAL rozetiyle farkınızı gösterin.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Resmi marka paneli ve mesajlaşma",
                "Şikayet bildirimleri ve yanıt araçları",
                "Çözüm oranı ve puanınızın profilde görünmesi",
                "Sahte profillere karşı SEAL doğrulaması",
              ].map((line, i) => (
                <motion.li
                  key={line}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-start gap-2.5 text-[13px] text-navy"
                >
                  <CheckCircle2 className="size-4 text-brand shrink-0 mt-0.5" />
                  {line}
                </motion.li>
              ))}
            </ul>
            <Link
              to="/register/marka-basvuru"
              className="mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-brand hover:gap-3 transition-all"
            >
              Marka başvurusu yap <ArrowRight className="size-4" />
            </Link>
          </Reveal>

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="relative"
          >
            <div className="rounded-2xl site-cta-panel p-6 sm:p-8">
              <div className="site-cta-panel-shine" aria-hidden />
              <div className="relative space-y-4">
                {[
                  { label: "Yeni şikayet", status: "Moderasyon", color: "bg-amber-400/20 text-amber-200" },
                  { label: "Yayında", status: "Yanıt bekleniyor", color: "bg-brand/20 text-brand" },
                  { label: "Yanıtlandı", status: "Marka yanıt verdi", color: "bg-sky-400/20 text-sky-200" },
                  { label: "Çözüldü", status: "Müşteri onayladı", color: "bg-emerald-400/20 text-emerald-200" },
                ].map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={reduceMotion ? {} : { opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3"
                  >
                    <span className="text-[13px] font-medium text-white">{row.label}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${row.color}`}>
                      {row.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MODERATION FLOW */}
      <section className="py-14 sm:py-16 site-cta-shell border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-white tracking-tight">
              Şikayetler nasıl kontrol edilir?
            </h2>
            <p className="mt-4 text-[14px] site-cta-muted leading-relaxed">
              Her şikayet moderasyon sürecinden geçer. Onaylanan içerik yayına alınır; marka resmi
              yanıt verir; çözüm yalnızca şikayet sahibi tarafından kapatılır.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheck, t: "Otomatik ön kontrol", d: "Küfür, kişisel veri ve spam filtreleri" },
              { icon: Users, t: "Manuel inceleme", d: "Şüpheli içerik moderasyon ekibine iletilir" },
              { icon: MessageCircle, t: "Yayın ve yanıt", d: "Onay sonrası marka paneline düşer" },
              { icon: Scale, t: "Çözüm onayı", d: "Kapatma ve puanlama yalnızca müşteriye aittir" },
            ].map((item, i) => (
              <motion.div
                key={item.t}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
                whileHover={reduceMotion ? {} : { y: -4 }}
                className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 backdrop-blur-sm"
              >
                <item.icon className="size-6 site-cta-accent mb-3" />
                <div className="font-semibold text-[14px] text-white">{item.t}</div>
                <p className="mt-1.5 text-[12px] site-cta-muted leading-relaxed">{item.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SEAL PROMO */}
      <section className="py-14 sm:py-20 bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <BadgeCheck className="size-10 text-brand mb-4" />
            <h2 className="font-display font-black text-[26px] sm:text-[32px] text-ink tracking-tight">
              Doğrulanmış markalar: tepkimvar SEAL
            </h2>
            <p className="mt-3 text-[14px] text-navy leading-relaxed">
              SEAL, markanın resmi temsilcisinin doğrulandığını ve periyodik denetimlerden geçtiğini
              gösterir. Oyuncular QR kod ile anında profili doğrular.
            </p>
            <Link
              to="/tepkimvar-seal"
              className="mt-6 site-cta-btn inline-flex w-full sm:w-auto"
            >
              SEAL&apos;i keşfedin <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className={`relative max-w-md mx-auto lg:ml-auto ${reduceMotion ? "" : "animate-floaty"}`}
          >
            <div className="rounded-2xl overflow-hidden ring-1 ring-rule shadow-lift p-1 bg-gradient-to-br from-brand/10 to-card">
              <img src="/dogrulama-rozeti.jpg" alt="tepkimvar SEAL" className="w-full h-auto rounded-xl" loading="lazy" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden site-cta-shell">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 text-center relative">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <h2 className="font-display font-black text-[26px] sm:text-[36px] text-white tracking-tight">
              Güven görünür. Sesiniz duyulsun.
            </h2>
            <p className="mt-3 text-[14px] site-cta-muted max-w-lg mx-auto">
              Deneyiminizi paylaşın veya markanızı doğrulayın — tepkimvar her iki taraf için de
              şeffaf bir çözüm alanı sunar.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/sikayet-yaz" className="site-cta-btn w-full sm:w-auto">
                Şikayet yaz <PenLine className="size-4" />
              </Link>
              <a href={siteContactMailto("tepkimvar hakkında bilgi")} className="site-cta-btn-ghost w-full sm:w-auto">
                Bize ulaşın
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function HeroVisual({ reduceMotion }: { reduceMotion: boolean }) {
  const cards = [
    { icon: Search, label: "Marka ara", sub: "jojobet, matbet…", delay: 0 },
    { icon: PenLine, label: "Şikayet yaz", sub: "Moderasyon → Yayın", delay: 0.15 },
    { icon: CheckCircle2, label: "Çözüm takibi", sub: "SK-XXXXXX", delay: 0.3 },
  ];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.75, ease: EASE, delay: 0.15 }}
      className="relative w-full max-w-md lg:max-w-lg mx-auto lg:ml-auto min-h-[280px] sm:min-h-[320px]"
    >
      {!reduceMotion && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="size-[90%] rounded-full border border-dashed border-white/15 animate-seal-orbit" />
        </div>
      )}
      <div className="relative h-full flex flex-col justify-center gap-3 sm:gap-4 py-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.3 + c.delay, ease: EASE }}
              className={`flex items-center gap-4 rounded-2xl bg-white/8 backdrop-blur-md ring-1 ring-white/15 px-4 sm:px-5 py-3.5 sm:py-4 shadow-lg ${i === 1 ? "ml-4 sm:ml-8" : i === 2 ? "ml-2 sm:ml-4" : ""} ${!reduceMotion && i === 1 ? "animate-floaty" : ""}`}
              style={!reduceMotion && i !== 1 ? { animationDelay: `${i * 0.8}s` } : undefined}
            >
              <span className="grid place-items-center size-11 rounded-xl bg-brand/20 text-brand shrink-0">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="font-semibold text-[14px] text-white">{c.label}</div>
                <div className="text-[12px] site-cta-muted truncate">{c.sub}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function StepCard({
  step,
  index,
  reduceMotion,
}: {
  step: {
    n: string;
    icon: typeof Search;
    t: string;
    d: string;
    cta: { label: string; to: "/markalar" | "/sikayet-yaz" | "/sikayetler" };
  };
  index: number;
  reduceMotion: boolean;
}) {
  const Icon = step.icon;
  return (
    <motion.article
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay: index * 0.12, ease: EASE }}
      whileHover={reduceMotion ? {} : { y: -6 }}
      className="relative bg-card rounded-2xl p-6 sm:p-7 ring-1 ring-rule hover:ring-brand/30 hover:shadow-lift transition-shadow text-center md:text-left"
    >
      <div className="absolute -top-3 left-1/2 md:left-6 -translate-x-1/2 md:translate-x-0 size-8 rounded-full bg-brand text-brand-foreground grid place-items-center text-[13px] font-black shadow-md">
        {step.n}
      </div>
      <span className="mt-4 inline-grid place-items-center size-12 rounded-2xl bg-brand-soft text-brand mb-4">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold text-[17px] text-ink">{step.t}</h3>
      <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">{step.d}</p>
      <Link
        to={step.cta.to}
        className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:gap-2.5 transition-all"
      >
        {step.cta.label} <ArrowRight className="size-3.5" />
      </Link>
    </motion.article>
  );
}

function FeatureCard({
  icon: Icon,
  t,
  d,
  index,
  reduceMotion,
}: {
  icon: typeof Database;
  t: string;
  d: string;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE }}
      whileHover={reduceMotion ? {} : { y: -5 }}
      className="bg-card rounded-2xl p-5 sm:p-6 ring-1 ring-rule hover:ring-brand/25 hover:shadow-soft transition-shadow"
    >
      <Icon className="size-6 text-brand mb-3" />
      <h3 className="font-semibold text-[15px] text-ink">{t}</h3>
      <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">{d}</p>
    </motion.div>
  );
}
