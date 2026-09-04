import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
  Users,
  Zap,
} from "lucide-react";
import {
  EASE,
  HeroBackground,
  LogoMarquee,
  Reveal,
  fadeUp,
  stagger,
} from "@/components/marketing/shared";
import { SiteLogoInline, SiteLogoMark, SiteLogoTitle } from "@/components/site-logo-mark";
import { siteContactMailto } from "@/lib/contact";

const TRUST_METRICS = [
  { label: "Bağımsız moderasyon", icon: ShieldCheck },
  { label: "Resmi marka yanıtı", icon: MessageCircle },
  { label: "SEAL doğrulama", icon: BadgeCheck },
  { label: "Ücretsiz kullanım", icon: CheckCircle2 },
] as const;

const STEPS = [
  {
    n: "01",
    icon: Search,
    t: "Markayı ara",
    d: "Arama çubuğuna marka adını yazın veya dizinden firma profiline gidin.",
    cta: { label: "Markalar", to: "/markalar" as const },
  },
  {
    n: "02",
    icon: PenLine,
    t: "Şikayetini yaz",
    d: "Sorunu anlatın, belge ekleyin. İnceleme sonrası yayına alınır.",
    cta: { label: "Şikayet yaz", to: "/sikayet-yaz" as const },
  },
  {
    n: "03",
    icon: Eye,
    t: "Süreci takip et",
    d: "Marka yanıtı ve çözüm adımları tek sayfada — SK kodunuzla paylaşın.",
    cta: { label: "Şikayetler", to: "/sikayetler" as const },
  },
] as const;

const USER_FEATURES = [
  {
    icon: Database,
    t: "Kapsamlı veritabanı",
    d: "Binlerce marka profili, çözüm oranı ve doğrulanmış şikayet geçmişi tek yerde.",
    large: true,
  },
  {
    icon: FileSearch,
    t: "Anında arama",
    d: "Marka adı, kategori veya SK kodu — üyelik olmadan araştırın.",
    large: false,
  },
  {
    icon: ClipboardList,
    t: "Profesyonel moderasyon",
    d: "Her içerik incelenir; markalar resmi ve kayıt altına alınmış yanıt verir.",
    large: false,
  },
  {
    icon: ShieldCheck,
    t: "Tarafsız platform",
    d: "Hiçbir marka ücret karşılığında şikayet sildiremez veya puan satın alamaz.",
    large: false,
  },
] as const;

const MOD_STEPS = [
  { icon: Zap, t: "Otomatik filtre", d: "Küfür, kişisel veri ve spam engellenir" },
  { icon: Users, t: "Manuel inceleme", d: "Şüpheli içerik uzman ekibe iletilir" },
  { icon: MessageCircle, t: "Yayın & yanıt", d: "Onaylanan şikayet marka paneline düşer" },
  { icon: Scale, t: "Çözüm onayı", d: "Kapatma kararı müşteriye aittir" },
] as const;

export function TepkimvarHowItWorksPage() {
  const reduceMotion = !!useReducedMotion();

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden site-cta-shell border-b border-white/10">
        <HeroBackground reduceMotion={reduceMotion} />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,oklch(0.76_0.15_162/0.14),transparent)]"
          aria-hidden
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-20 pb-12 sm:pb-20 relative">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
            <motion.div initial="hidden" animate="visible" variants={stagger(reduceMotion)} className="min-w-0">
              <motion.div variants={fadeUp(reduceMotion)} className="site-cta-badge mb-8">
                Platform rehberi
              </motion.div>

              <motion.div variants={fadeUp(reduceMotion, 0.05)}>
                <SiteLogoTitle
                  dark
                  logoSize={60}
                  subtitle="nasıl çalışır?"
                  subtitleClassName="site-cta-gradient-text !text-[32px] sm:!text-[46px] lg:!text-[50px]"
                />
              </motion.div>

              <motion.p
                variants={fadeUp(reduceMotion, 0.12)}
                className="mt-7 text-[15px] sm:text-[16px] site-cta-muted leading-[1.75] max-w-lg"
              >
                Markaları araştırın, deneyiminizi kayda geçirin, resmi yanıt ve çözüm sürecini
                uçtan uca şeffaf biçimde takip edin.
              </motion.p>

              <motion.div variants={fadeUp(reduceMotion, 0.18)} className="mt-9 flex flex-wrap gap-3">
                <Link to="/sikayet-yaz" className="site-cta-btn shadow-lg shadow-brand/20">
                  Şikayet yaz <PenLine className="size-4" />
                </Link>
                <Link to="/markalar" className="site-cta-btn-ghost">
                  Marka ara <Search className="size-4" />
                </Link>
              </motion.div>
            </motion.div>

            <HeroFlowVisual reduceMotion={reduceMotion} className="hidden sm:block" />
          </div>
        </div>

        {/* Trust strip */}
        <div className="relative border-t border-white/10 bg-black/15 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {TRUST_METRICS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + i * 0.06, duration: 0.45, ease: EASE }}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <span className="grid place-items-center size-9 rounded-lg bg-white/8 ring-1 ring-white/10 shrink-0">
                      <Icon className="size-4 site-cta-accent" />
                    </span>
                    <span className="text-[12px] sm:text-[13px] font-medium text-white/90 leading-snug">
                      {item.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section className="py-14 sm:py-28 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <Reveal className="lg:col-span-5 order-2 lg:order-1">
              <SectionLabel>Platform</SectionLabel>
              <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight leading-[1.1] mt-3">
                Bağımsız şikayet
                <span className="text-brand"> çözüm </span>
                altyapısı
              </h2>
              <p className="mt-6 text-[15px] sm:text-[16px] text-navy leading-[1.75] flex flex-wrap items-center gap-x-2 gap-y-1">
                <SiteLogoInline size={26} tone="on-light" className="mr-0.5" />
                <span>
                  oyuncuları, doğrulanmış markaları ve moderasyon ekibini tek çatı altında buluşturur.
                  Gerçek deneyimler kayda geçer; markalar resmi yanıt verir.
                </span>
              </p>
              <div className="mt-10 grid grid-cols-2 gap-3">
                {[
                  { k: "Tarafsız", v: "Puan satılmaz" },
                  { k: "Şeffaf", v: "Açık süreç" },
                  { k: "Güvenli", v: "Moderasyon" },
                  { k: "Hızlı", v: "Resmi yanıt" },
                ].map((s) => (
                  <div
                    key={s.k}
                    className="rounded-xl bg-card ring-1 ring-rule px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand">{s.k}</div>
                    <div className="text-[13px] font-semibold text-ink mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </Reveal>

            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.65, ease: EASE }}
              className="lg:col-span-7 order-1 lg:order-2"
            >
              <div className="rounded-2xl overflow-hidden ring-1 ring-rule shadow-lift bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-rule bg-surface/90">
                  <span className="size-2.5 rounded-full bg-red-400/90" />
                  <span className="size-2.5 rounded-full bg-amber-400/90" />
                  <span className="size-2.5 rounded-full bg-emerald-400/90" />
                  <div className="ml-2 flex items-center gap-2">
                    <SiteLogoMark size={18} tone="on-light" />
                    <span className="text-[11px] text-navy-mid font-medium">Platform önizleme</span>
                  </div>
                </div>
                <img
                  src="/tepkim-hero.png"
                  alt="Platform arayüzü"
                  width={1200}
                  height={630}
                  className="block w-full h-auto"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="py-14 sm:py-28 bg-surface border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
            <SectionLabel center>3 adım</SectionLabel>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight mt-3">
              Dakikalar içinde başlayın
            </h2>
            <p className="mt-4 text-[15px] text-navy-mid leading-relaxed">
              Marka aramak için hesap gerekmez; şikayet yazmak için giriş yeterli.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
            {STEPS.map((step, i) => (
              <StepCard key={step.n} step={step} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>

          <Reveal className="mt-14 flex justify-center">
            <Link
              to="/arama"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-7 h-12 text-[14px] font-semibold hover:bg-ink/90 transition"
            >
              <Search className="size-4" /> Marka veya şikayet ara
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-14 sm:py-28 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-2xl mb-14">
            <SectionLabel>Kullanıcılar</SectionLabel>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight leading-tight mt-3">
              Karar vermeden önce araştırın, sorun yaşarsanız sesinizi duyurun
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
            {USER_FEATURES.map((item, i) => (
              <FeatureCard key={item.t} {...item} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <section className="py-12 sm:py-14 bg-surface border-y border-rule overflow-hidden">
        <Reveal>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-navy-mid mb-8">
            Platformda yer alan markalar
          </p>
        </Reveal>
        <LogoMarquee />
      </section>

      {/* BRANDS */}
      <section className="py-20 sm:py-28 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <Reveal>
            <SectionLabel>Markalar</SectionLabel>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight leading-tight mt-3">
              Güven inşa edin, çözüm oranınızı yükseltin
            </h2>
            <p className="mt-5 text-[15px] sm:text-[16px] text-navy leading-[1.75]">
              Doğrulanmış profilinizle oyunculara güven verin. Resmi yanıtlar, SEAL rozeti ve
              şeffaf metrikler tek panelde.
            </p>
            <ul className="mt-9 space-y-4">
              {[
                "Resmi marka paneli ve mesajlaşma",
                "Anlık şikayet bildirimleri",
                "Profilde çözüm oranı ve puan",
                "SEAL ile sahte profil koruması",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-[14px] sm:text-[15px] text-navy">
                  <span className="grid place-items-center size-6 rounded-full bg-brand-soft text-brand shrink-0 mt-0.5">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
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

          <StatusPipeline reduceMotion={reduceMotion} />
        </div>
      </section>

      {/* MODERATION */}
      <section className="py-20 sm:py-28 site-cta-shell relative overflow-hidden border-y border-white/10">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
          <Reveal className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
            <SectionLabel center dark>
              Moderasyon
            </SectionLabel>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-white tracking-tight mt-3">
              Her şikayet kontrol edilir
            </h2>
            <p className="mt-4 text-[15px] site-cta-muted leading-relaxed">
              Onay → yayın → marka yanıtı → çözüm. Süreç herkese açık ve izlenebilir.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MOD_STEPS.map((item, i) => (
              <ModStep key={item.t} {...item} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* SEAL */}
      <section className="py-20 sm:py-28 bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl overflow-hidden ring-1 ring-rule bg-card shadow-soft">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-0 items-center p-8 sm:p-12 lg:p-14">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-3.5 h-8 text-[11px] font-bold ring-1 ring-brand/20 mb-6">
                  <BadgeCheck className="size-3.5" /> Doğrulanmış markalar
                </div>
                <h2 className="font-display font-black text-[26px] sm:text-[32px] text-ink tracking-tight leading-tight flex flex-wrap items-center gap-3">
                  <SiteLogoInline size={36} tone="on-light" />
                  <span>SEAL nedir?</span>
                </h2>
                <p className="mt-5 text-[15px] text-navy leading-[1.75] max-w-md">
                  Resmi temsil onayı, periyodik denetim ve QR kodlu rozet — oyuncular saniyeler
                  içinde doğrulama yapar.
                </p>
                <Link
                  to="/tepkimvar-seal"
                  className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-brand group"
                >
                  SEAL sayfasını inceleyin
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl overflow-hidden ring-1 ring-rule bg-surface p-2 max-w-md mx-auto lg:ml-auto">
                  <img src="/dogrulama-rozeti.jpg" alt="SEAL doğrulama rozeti" className="w-full h-auto rounded-xl" loading="lazy" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden site-cta-shell">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28 text-center relative">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div className="flex justify-center mb-8">
              <SiteLogoMark size={56} tone="on-dark" />
            </div>
            <h2 className="font-display font-black text-[28px] sm:text-[40px] text-white tracking-tight leading-tight">
              Güven görünür.
              <span className="block site-cta-gradient-text mt-2">Sesiniz duyulsun.</span>
            </h2>
            <p className="mt-5 text-[15px] sm:text-[16px] site-cta-muted leading-relaxed max-w-lg mx-auto">
              Deneyiminizi paylaşın veya markanızı doğrulayarak oyuncu güvenini artırın.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/sikayet-yaz" className="site-cta-btn w-full sm:w-auto justify-center">
                Şikayet yaz <PenLine className="size-4" />
              </Link>
              <a
                href={siteContactMailto("Platform hakkında bilgi")}
                className="site-cta-btn-ghost w-full sm:w-auto justify-center"
              >
                Bize ulaşın
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children, center, dark }: { children: ReactNode; center?: boolean; dark?: boolean }) {
  return (
    <p
      className={`text-[11px] font-bold uppercase tracking-[0.18em] ${center ? "text-center" : ""} ${
        dark ? "text-white/45" : "text-brand"
      }`}
    >
      {children}
    </p>
  );
}

function HeroFlowVisual({ reduceMotion, className = "" }: { reduceMotion: boolean; className?: string }) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
      className={`relative w-full max-w-[400px] mx-auto lg:ml-auto ${className}`}
    >
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/12 bg-white/[0.06] backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-white/[0.04]">
          <SiteLogoMark size={28} tone="on-dark" />
          <span className="text-[10px] font-semibold uppercase tracking-wider site-cta-muted">Canlı akış</span>
        </div>

        <div className="p-4 space-y-2.5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.45, ease: EASE }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.05] ring-1 ring-white/10 px-3.5 py-3"
              >
                <span className="font-mono text-[10px] font-bold site-cta-accent w-5">{step.n}</span>
                <span className="grid place-items-center size-8 rounded-lg bg-brand/20 text-brand shrink-0">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-[13px] font-medium text-white truncate flex-1">{step.t}</span>
                {i === STEPS.length - 1 && <CheckCircle2 className="size-4 text-brand shrink-0" />}
              </motion.div>
            );
          })}
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-xl bg-brand/12 ring-1 ring-brand/20 px-4 py-2.5 flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-brand animate-pulse shrink-0" />
            <span className="text-[12px] text-white/85 font-medium">Marka yanıtı bekleniyor</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StepCard({
  step,
  index,
  reduceMotion,
}: {
  step: (typeof STEPS)[number];
  index: number;
  reduceMotion: boolean;
}) {
  const Icon = step.icon;
  return (
    <motion.article
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
      className="group relative bg-card rounded-2xl p-6 sm:p-7 ring-1 ring-rule border-l-[3px] border-l-brand hover:shadow-lift transition-shadow duration-300"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="font-mono text-[12px] font-bold text-brand/70">{step.n}</span>
        <span className="grid place-items-center size-10 rounded-xl bg-brand-soft text-brand ring-1 ring-brand/10">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <h3 className="font-display font-bold text-[18px] text-ink leading-snug">{step.t}</h3>
      <p className="mt-2.5 text-[14px] text-navy-mid leading-relaxed">{step.d}</p>
      <Link
        to={step.cta.to}
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand group/link"
      >
        {step.cta.label}
        <ArrowRight className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
      </Link>
    </motion.article>
  );
}

function FeatureCard({
  icon: Icon,
  t,
  d,
  large,
  index,
  reduceMotion,
}: {
  icon: LucideIcon;
  t: string;
  d: string;
  large: boolean;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: EASE }}
      className={`rounded-2xl ring-1 ring-rule bg-card p-6 sm:p-7 hover:ring-brand/20 transition-colors ${
        large ? "sm:col-span-2" : ""
      }`}
    >
      <span className="inline-grid place-items-center size-10 rounded-xl bg-surface text-brand ring-1 ring-rule mb-4">
        <Icon className="size-5" />
      </span>
      <h3 className={`font-display font-bold text-ink ${large ? "text-[19px] sm:text-[21px]" : "text-[16px]"}`}>
        {t}
      </h3>
      <p className={`mt-2 text-navy-mid leading-relaxed ${large ? "text-[14px] max-w-xl" : "text-[13px]"}`}>{d}</p>
    </motion.div>
  );
}

function StatusPipeline({ reduceMotion }: { reduceMotion: boolean }) {
  const rows = [
    { label: "Yeni şikayet", status: "Moderasyon", dot: "bg-amber-400" },
    { label: "Yayında", status: "Yanıt bekleniyor", dot: "bg-brand" },
    { label: "Yanıtlandı", status: "Marka yanıt verdi", dot: "bg-sky-400" },
    { label: "Çözüldü", status: "Onaylandı", dot: "bg-emerald-400" },
  ];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative rounded-2xl site-cta-panel p-6 sm:p-8 ring-1 ring-white/10"
    >
      <div className="site-cta-panel-shine pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />
      <div className="relative mb-6 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">Şikayet durumu</span>
        <span className="text-[10px] font-bold uppercase tracking-wider site-cta-muted">Canlı</span>
      </div>
      <div className="relative space-y-0">
        {rows.map((row, i) => (
          <div key={row.label} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < rows.length - 1 && (
              <div className="absolute left-[6px] top-3.5 bottom-0 w-px bg-white/12" aria-hidden />
            )}
            <span className={`relative z-[1] mt-1 size-3 rounded-full ${row.dot} ring-2 ring-white/15 shrink-0`} />
            <div className="flex-1 flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] ring-1 ring-white/8 px-3.5 py-2.5 min-w-0">
              <span className="text-[13px] font-medium text-white truncate">{row.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide site-cta-muted shrink-0 hidden sm:inline">
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ModStep({
  icon: Icon,
  t,
  d,
  index,
  reduceMotion,
}: {
  icon: LucideIcon;
  t: string;
  d: string;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: EASE }}
      className="rounded-2xl bg-white/[0.05] ring-1 ring-white/10 p-5 sm:p-6 backdrop-blur-sm"
    >
      <span className="font-mono text-[10px] font-bold site-cta-accent">0{index + 1}</span>
      <span className="mt-3 inline-grid place-items-center size-10 rounded-xl bg-brand/15 text-brand">
        <Icon className="size-[18px]" />
      </span>
      <div className="mt-4 font-semibold text-[14px] sm:text-[15px] text-white">{t}</div>
      <p className="mt-1.5 text-[13px] site-cta-muted leading-relaxed">{d}</p>
    </motion.div>
  );
}
