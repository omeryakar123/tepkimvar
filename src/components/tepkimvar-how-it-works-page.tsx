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
  Sparkles,
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
import { siteContactMailto } from "@/lib/contact";

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
    d: "Sorunu anlatın, belge ekleyin. Moderasyon sonrası yayına alınır.",
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
    d: "Binlerce marka profili, çözüm oranı ve gerçek şikayet geçmişi.",
    accent: "from-brand/15 to-brand-soft/30",
    large: true,
  },
  {
    icon: FileSearch,
    t: "Anında arama",
    d: "Marka adı, kategori veya SK kodu — üye olmadan gezin.",
    accent: "from-accent-purple/10 to-brand-soft/20",
    large: false,
  },
  {
    icon: ClipboardList,
    t: "Moderasyon",
    d: "Şikayetiniz incelenir; marka resmi yanıt verir.",
    accent: "from-sky-500/10 to-brand-soft/20",
    large: false,
  },
  {
    icon: ShieldCheck,
    t: "Bağımsız platform",
    d: "Hiçbir marka ücret karşılığında şikayet sildiremez.",
    accent: "from-emerald-500/10 to-brand-soft/20",
    large: false,
  },
] as const;

const MOD_STEPS = [
  { icon: Zap, t: "Otomatik filtre", d: "Küfür, kişisel veri, spam" },
  { icon: Users, t: "Manuel inceleme", d: "Şüpheli içerik ekibe gider" },
  { icon: MessageCircle, t: "Yayın & yanıt", d: "Marka paneline düşer" },
  { icon: Scale, t: "Çözüm onayı", d: "Kapatma müşteriye aittir" },
] as const;

export function TepkimvarHowItWorksPage() {
  const reduceMotion = !!useReducedMotion();

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden site-cta-shell">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.76_0.15_162/0.18),transparent)] pointer-events-none" aria-hidden />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial="hidden" animate="visible" variants={stagger(reduceMotion)} className="min-w-0">
              <motion.span variants={fadeUp(reduceMotion)} className="site-cta-badge mb-6">
                <Sparkles className="size-3.5 shrink-0" /> Rehber
              </motion.span>
              <motion.h1
                variants={fadeUp(reduceMotion, 0.06)}
                className="font-display font-black text-[34px] sm:text-[52px] leading-[1.02] tracking-[-0.03em] text-white"
              >
                tepkimvar
                <span className="block mt-2 site-cta-gradient-text">nasıl çalışır?</span>
              </motion.h1>
              <motion.p variants={fadeUp(reduceMotion, 0.12)} className="mt-6 text-[15px] sm:text-[17px] site-cta-muted leading-relaxed max-w-lg">
                Markaları araştırın, deneyiminizi paylaşın, resmi yanıt ve çözüm sürecini
                şeffaf biçimde takip edin.
              </motion.p>
              <motion.div variants={fadeUp(reduceMotion, 0.18)} className="mt-8 flex flex-wrap gap-3">
                <Link to="/sikayet-yaz" className="site-cta-btn shadow-lg shadow-brand/25">
                  Şikayet yaz <PenLine className="size-4" />
                </Link>
                <Link to="/markalar" className="site-cta-btn-ghost">
                  Marka ara <Search className="size-4" />
                </Link>
              </motion.div>
            </motion.div>

            <HeroFlowVisual reduceMotion={reduceMotion} />
          </div>

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
            className="mt-14 sm:mt-16 flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3"
          >
            {["Bağımsız moderasyon", "Resmi marka yanıtı", "SEAL doğrulama", "Ücretsiz kullanım"].map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/8 ring-1 ring-white/12 px-3.5 py-1.5 text-[11px] sm:text-[12px] font-medium text-white/85 backdrop-blur-sm"
              >
                <CheckCircle2 className="size-3.5 site-cta-accent shrink-0" />
                {pill}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* WHAT IS */}
      <section className="relative py-16 sm:py-24 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <Reveal className="lg:col-span-5 order-2 lg:order-1">
              <SectionEyebrow>Platform</SectionEyebrow>
              <h2 className="font-display font-black text-[28px] sm:text-[38px] text-ink tracking-tight leading-[1.08]">
                Bağımsız şikayet
                <span className="text-brand"> çözüm </span>
                platformu
              </h2>
              <p className="mt-5 text-[15px] text-navy leading-relaxed">
                tepkimvar; oyuncuları, doğrulanmış markaları ve moderasyon ekibini bir araya getirir.
                Gerçek deneyimleri kayda geçirir, markaların resmi yanıt vermesini sağlar.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  { k: "Tarafsız", v: "Puan satılmaz" },
                  { k: "Şeffaf", v: "Açık süreç" },
                  { k: "Güvenli", v: "Moderasyon" },
                  { k: "Hızlı", v: "Resmi yanıt" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-surface ring-1 ring-rule px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand">{s.k}</div>
                    <div className="text-[13px] font-semibold text-ink mt-0.5">{s.v}</div>
                  </div>
                ))}
              </div>
            </Reveal>

            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="lg:col-span-7 order-1 lg:order-2 relative"
            >
              <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-brand/20 via-transparent to-accent-purple/15 blur-2xl pointer-events-none" aria-hidden />
              <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden ring-1 ring-rule shadow-lift bg-card p-1.5 sm:p-2">
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-rule/80 bg-surface/80 rounded-t-[14px] sm:rounded-t-[18px]">
                  <span className="size-2.5 rounded-full bg-red-400/80" />
                  <span className="size-2.5 rounded-full bg-amber-400/80" />
                  <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 text-[11px] text-navy-mid font-medium">tepkimvar.com</span>
                </div>
                <img
                  src="/tepkim-hero.png"
                  alt="tepkimvar platformu"
                  width={1200}
                  height={630}
                  className="block w-full h-auto rounded-b-[14px] sm:rounded-b-[18px]"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STEPS TIMELINE */}
      <section className="py-16 sm:py-24 bg-surface border-y border-rule relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 size-96 rounded-full bg-brand/5 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
          <Reveal className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
            <SectionEyebrow center>3 adım</SectionEyebrow>
            <h2 className="font-display font-black text-[28px] sm:text-[38px] text-ink tracking-tight">
              Dakikalar içinde başlayın
            </h2>
            <p className="mt-3 text-[14px] sm:text-[15px] text-navy-mid">
              Marka aramak için hesap gerekmez; şikayet yazmak için giriş yeterli.
            </p>
          </Reveal>

          <div className="relative">
            <div className="hidden md:block absolute top-[52px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" aria-hidden />

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {STEPS.map((step, i) => (
                <StepCard key={step.n} step={step} index={i} reduceMotion={reduceMotion} />
              ))}
            </div>
          </div>

          <Reveal className="mt-12 flex justify-center">
            <Link
              to="/arama"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-6 h-11 text-[13px] font-semibold hover:bg-ink/90 transition shadow-pop"
            >
              <Search className="size-4" /> Marka veya şikayet ara
            </Link>
          </Reveal>
        </div>
      </section>

      {/* BENTO — USERS */}
      <section className="py-16 sm:py-24 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-xl mb-12">
            <SectionEyebrow>Kullanıcılar</SectionEyebrow>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight leading-tight">
              Alışverişten önce araştır, sorun yaşarsan sesini duyur
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {USER_FEATURES.map((item, i) => (
              <BentoCard key={item.t} {...item} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <section className="py-10 sm:py-12 bg-surface border-y border-rule overflow-hidden">
        <Reveal>
          <p className="text-center eyebrow text-navy-mid mb-7">Platformda yer alan markalar</p>
        </Reveal>
        <LogoMarquee />
      </section>

      {/* BRANDS */}
      <section className="py-16 sm:py-24 bg-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <SectionEyebrow>Markalar</SectionEyebrow>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-ink tracking-tight leading-tight">
              Güven inşa edin, çözüm oranınızı yükseltin
            </h2>
            <p className="mt-4 text-[15px] text-navy leading-relaxed">
              Doğrulanmış profilinizle oyunculara güven verin. Resmi yanıtlar, SEAL rozeti ve
              şeffaf metrikler tek yerde.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                "Resmi marka paneli ve mesajlaşma",
                "Anlık şikayet bildirimleri",
                "Profilde çözüm oranı ve puan",
                "SEAL ile sahte profil koruması",
              ].map((line, i) => (
                <motion.li
                  key={line}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="flex items-center gap-3 text-[14px] text-navy"
                >
                  <span className="grid place-items-center size-6 rounded-full bg-brand-soft text-brand shrink-0">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  {line}
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register/marka-basvuru"
                className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition shadow-soft"
              >
                Marka başvurusu <Building2 className="size-4" />
              </Link>
              <Link to="/tepkimvar-seal" className="inline-flex items-center gap-2 rounded-full ring-1 ring-rule bg-card px-5 h-11 text-[13px] font-semibold text-ink hover:ring-brand/40 transition">
                SEAL <BadgeCheck className="size-4 text-brand" />
              </Link>
            </div>
          </Reveal>

          <StatusPipeline reduceMotion={reduceMotion} />
        </div>
      </section>

      {/* MODERATION TIMELINE */}
      <section className="py-16 sm:py-24 site-cta-shell relative overflow-hidden">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow center dark>
              Moderasyon
            </SectionEyebrow>
            <h2 className="font-display font-black text-[28px] sm:text-[36px] text-white tracking-tight">
              Her şikayet kontrol edilir
            </h2>
            <p className="mt-4 text-[14px] site-cta-muted">
              Onay → yayın → marka yanıtı → çözüm. Süreç herkese açık.
            </p>
          </Reveal>

          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3">
            {!reduceMotion && (
              <div className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
            )}
            {MOD_STEPS.map((item, i) => (
              <ModStep key={item.t} {...item} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* SEAL */}
      <section className="py-16 sm:py-24 bg-surface border-t border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden ring-1 ring-rule bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-brand/8 via-transparent to-accent-purple/5 pointer-events-none" aria-hidden />
            <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-0 items-center p-6 sm:p-10 lg:p-12">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-3 h-8 text-[11px] font-bold ring-1 ring-brand/20 mb-5">
                  <BadgeCheck className="size-3.5" /> Doğrulanmış markalar
                </div>
                <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight leading-tight">
                  tepkimvar SEAL nedir?
                </h2>
                <p className="mt-4 text-[14px] sm:text-[15px] text-navy leading-relaxed max-w-md">
                  Resmi temsil onayı, periyodik denetim ve QR kodlu rozet — oyuncular saniyeler
                  içinde doğrular.
                </p>
                <Link
                  to="/tepkimvar-seal"
                  className="mt-7 inline-flex items-center gap-2 text-[14px] font-semibold text-brand group"
                >
                  SEAL sayfasını keşfedin
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Reveal>
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASE }}
                className={`relative max-w-sm mx-auto lg:max-w-none ${reduceMotion ? "" : "animate-floaty"}`}
              >
                <div className="rounded-2xl p-1.5 bg-gradient-to-br from-brand/25 via-brand/10 to-accent-purple/10 ring-1 ring-brand/20 shadow-lift">
                  <img src="/dogrulama-rozeti.jpg" alt="tepkimvar SEAL" className="w-full h-auto rounded-xl" loading="lazy" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden site-cta-shell">
        <HeroBackground reduceMotion={reduceMotion} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 text-center relative">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE }}
            className="max-w-2xl mx-auto"
          >
            <div className="inline-flex mb-6">
              <span className="relative">
                {!reduceMotion && (
                  <span className="absolute inset-0 rounded-full bg-brand/30 animate-seal-pulse-ring" aria-hidden />
                )}
                <Sparkles className="size-10 site-cta-accent relative mx-auto" />
              </span>
            </div>
            <h2 className="font-display font-black text-[28px] sm:text-[40px] text-white tracking-tight leading-tight">
              Güven görünür.
              <span className="block site-cta-gradient-text mt-1">Sesiniz duyulsun.</span>
            </h2>
            <p className="mt-4 text-[15px] site-cta-muted">
              Deneyiminizi paylaşın veya markanızı doğrulayın.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/sikayet-yaz" className="site-cta-btn w-full sm:w-auto justify-center">
                Şikayet yaz <PenLine className="size-4" />
              </Link>
              <a href={siteContactMailto("tepkimvar hakkında bilgi")} className="site-cta-btn-ghost w-full sm:w-auto justify-center">
                Bize ulaşın
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function SectionEyebrow({ children, center, dark }: { children: ReactNode; center?: boolean; dark?: boolean }) {
  return (
    <p className={`eyebrow mb-3 ${center ? "text-center" : ""} ${dark ? "text-white/50" : "text-brand"}`}>
      {children}
    </p>
  );
}

function HeroFlowVisual({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
      className="relative w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-0"
    >
      {!reduceMotion && (
        <div className="absolute -inset-6 rounded-full border border-dashed border-white/12 animate-seal-orbit pointer-events-none" aria-hidden />
      )}

      <div className="relative rounded-[22px] overflow-hidden ring-1 ring-white/15 bg-white/6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <span className="font-display font-black text-[15px] text-white">
            tepkimvar<span className="text-brand">.</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider site-cta-muted">Canlı</span>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + i * 0.12, duration: 0.5, ease: EASE }}
                className="flex items-center gap-3 rounded-xl bg-white/6 ring-1 ring-white/10 px-3.5 py-3"
              >
                <span className="font-mono text-[11px] font-bold site-cta-accent w-6 shrink-0">{step.n}</span>
                <span className="grid place-items-center size-9 rounded-lg bg-brand/20 text-brand shrink-0">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white truncate">{step.t}</div>
                </div>
                {i < STEPS.length - 1 ? (
                  <ArrowRight className="size-3.5 text-white/30 shrink-0 rotate-90 sm:rotate-0 hidden sm:block" />
                ) : (
                  <CheckCircle2 className="size-4 text-brand shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-xl bg-brand/15 ring-1 ring-brand/25 px-4 py-3 flex items-center gap-3">
            <div className="size-2 rounded-full bg-brand animate-pulse shrink-0" />
            <span className="text-[12px] text-white/90 font-medium">Marka yanıtı bekleniyor…</span>
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
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: index * 0.1, ease: EASE }}
      whileHover={reduceMotion ? {} : { y: -8 }}
      className="group relative bg-card rounded-[20px] p-6 sm:p-7 ring-1 ring-rule hover:ring-brand/35 hover:shadow-lift transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-6">
        <span className="font-mono text-[13px] font-bold text-brand/80">{step.n}</span>
        <span className="grid place-items-center size-12 rounded-2xl bg-gradient-to-br from-brand-soft to-brand/10 text-brand ring-1 ring-brand/15 group-hover:scale-110 transition-transform duration-300">
          <Icon className="size-5" />
        </span>
      </div>
      <h3 className="font-display font-bold text-[18px] sm:text-[20px] text-ink leading-snug">{step.t}</h3>
      <p className="mt-2.5 text-[13px] sm:text-[14px] text-navy-mid leading-relaxed">{step.d}</p>
      <Link
        to={step.cta.to}
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand group/link"
      >
        {step.cta.label}
        <ArrowRight className="size-3.5 transition-transform group-hover/link:translate-x-1" />
      </Link>
    </motion.article>
  );
}

function BentoCard({
  icon: Icon,
  t,
  d,
  accent,
  large,
  index,
  reduceMotion,
}: {
  icon: LucideIcon;
  t: string;
  d: string;
  accent: string;
  large: boolean;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
      whileHover={reduceMotion ? {} : { y: -4 }}
      className={`relative overflow-hidden rounded-[20px] ring-1 ring-rule bg-card p-6 sm:p-7 hover:ring-brand/25 hover:shadow-soft transition-all duration-300 ${
        large ? "sm:col-span-2 lg:col-span-2 lg:row-span-1" : ""
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60 pointer-events-none`} aria-hidden />
      <div className="relative">
        <span className="inline-grid place-items-center size-11 rounded-xl bg-card/80 backdrop-blur text-brand ring-1 ring-rule mb-4">
          <Icon className="size-5" />
        </span>
        <h3 className={`font-display font-bold text-ink leading-snug ${large ? "text-[20px] sm:text-[22px]" : "text-[16px]"}`}>
          {t}
        </h3>
        <p className={`mt-2 text-navy-mid leading-relaxed ${large ? "text-[14px] max-w-md" : "text-[13px]"}`}>{d}</p>
      </div>
    </motion.div>
  );
}

function StatusPipeline({ reduceMotion }: { reduceMotion: boolean }) {
  const rows = [
    { label: "Yeni şikayet", status: "Moderasyon", dot: "bg-amber-400" },
    { label: "Yayında", status: "Yanıt bekleniyor", dot: "bg-brand" },
    { label: "Yanıtlandı", status: "Marka yanıt verdi", dot: "bg-sky-400" },
    { label: "Çözüldü", status: "Müşteri onayladı", dot: "bg-emerald-400" },
  ];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.65, ease: EASE }}
      className="relative"
    >
      <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-brand/15 to-accent-purple/10 blur-xl pointer-events-none" aria-hidden />
      <div className="relative rounded-[22px] site-cta-panel p-6 sm:p-8">
        <div className="site-cta-panel-shine" aria-hidden />
        <div className="relative mb-5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white">Şikayet durumu</span>
          <span className="text-[10px] font-bold uppercase tracking-wider site-cta-muted">Canlı akış</span>
        </div>
        <div className="relative space-y-0">
          {rows.map((row, i) => (
            <motion.div
              key={row.label}
              initial={reduceMotion ? {} : { opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.45 }}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              {i < rows.length - 1 && (
                <div className="absolute left-[7px] top-4 bottom-0 w-px bg-white/15" aria-hidden />
              )}
              <span className={`relative z-[1] mt-1.5 size-3.5 rounded-full ${row.dot} ring-2 ring-white/20 shrink-0`} />
              <div className="flex-1 flex items-center justify-between gap-3 rounded-xl bg-white/5 ring-1 ring-white/8 px-4 py-3 min-w-0">
                <span className="text-[13px] font-medium text-white truncate">{row.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider site-cta-muted shrink-0 hidden sm:inline">
                  {row.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
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
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE }}
      whileHover={reduceMotion ? {} : { y: -4 }}
      className="relative text-center lg:text-left rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 sm:p-6 backdrop-blur-sm hover:bg-white/8 transition-colors"
    >
      <div className="lg:hidden sm:flex items-center justify-center mb-3">
        <span className="font-mono text-[11px] font-bold site-cta-accent">0{index + 1}</span>
      </div>
      <span className="inline-grid place-items-center size-11 rounded-xl bg-brand/15 text-brand mb-4 mx-auto lg:mx-0">
        <Icon className="size-5" />
      </span>
      <div className="font-semibold text-[14px] sm:text-[15px] text-white">{t}</div>
      <p className="mt-1.5 text-[12px] sm:text-[13px] site-cta-muted leading-relaxed">{d}</p>
    </motion.div>
  );
}
