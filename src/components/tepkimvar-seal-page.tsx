import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  MessageCircle,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { RawPlatformStats } from "@/lib/public-stats";
import { siteContactMailto } from "@/lib/contact";

const EASE = [0.16, 1, 0.3, 1] as const;

const BRAND_LOGOS = [
  "matbet", "betist", "pinbahis", "bahsegel", "betsat", "restbet", "gobahis",
  "casinometropol", "betpark", "kingbetting", "betovis", "ganyanbet", "sonbahis",
  "livebahis", "medusabahis", "eyfelcasino", "betboo", "betebet", "efesbet",
  "rotabet", "suratbet", "sohobet", "casinoas", "casifix", "betcool", "betlivo",
  "betkare", "betverse", "gallerbahis", "casinowon", "etrobet",
] as const;

type Props = { stats: RawPlatformStats | null };

export function TepkimvarSealPage({ stats }: Props) {
  const reduceMotion = useReducedMotion();
  const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("tr-TR") : "—");

  const statItems = [
    { v: stats ? nf(stats.totalCompanies) : "—", k: "Kayıtlı marka", icon: BadgeCheck, num: stats?.totalCompanies },
    { v: stats ? `%${Math.round(stats.resolutionRate)}` : "—", k: "Ortalama çözüm oranı", icon: TrendingUp, num: stats?.resolutionRate },
    { v: stats ? nf(stats.resolvedComplaints) : "—", k: "Çözülen şikayet", icon: MessageCircle, num: stats?.resolvedComplaints },
    { v: stats ? nf(stats.totalUsers) : "—", k: "Platform üyesi", icon: Users, num: stats?.totalUsers },
  ];

  const fadeUp = (delay = 0): Variants => ({
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: EASE, delay },
    },
  });

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } },
  };

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-rule bg-gradient-to-br from-ink via-[oklch(0.26_0.045_262)] to-brand/45 text-paper">
        <HeroBackground reduceMotion={!!reduceMotion} />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="min-w-0"
          >
            <motion.span variants={fadeUp()} className="inline-flex items-center gap-2 rounded-full bg-paper/10 backdrop-blur-md px-3 h-8 text-[11px] sm:text-[12px] font-semibold ring-1 ring-paper/20 mb-5">
              <Sparkles className="size-3.5 text-brand" /> Markalar için doğrulama
            </motion.span>
            <motion.h1 variants={fadeUp(0.08)} className="font-display font-black text-[30px] sm:text-[46px] leading-[1.05] tracking-[-0.025em]">
              Oyuncu güvenini inşa edin.
              <span className="block mt-1 bg-gradient-to-r from-brand via-[oklch(0.78_0.16_158)] to-brand bg-clip-text text-transparent">
                tepkimvar SEAL ile kanıtlayın.
              </span>
            </motion.h1>
            <motion.p variants={fadeUp(0.16)} className="mt-5 text-[14px] sm:text-[16px] text-paper/75 leading-relaxed max-w-xl">
              Resmi temsilinizi doğrulayın, şikayetlere şeffaf yanıt verin ve QR kodlu rozetinizle
              oyunculara anında güven sinyali gönderin.
            </motion.p>
            <motion.div variants={fadeUp(0.24)} className="mt-8 flex flex-col sm:flex-row gap-3">
              <motion.a
                href={siteContactMailto("tepkimvar SEAL başvurusu")}
                whileHover={reduceMotion ? {} : { scale: 1.02 }}
                whileTap={reduceMotion ? {} : { scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold shadow-lg shadow-brand/25 hover:brightness-105 transition"
              >
                SEAL başvurusu yap <ArrowRight className="size-4" />
              </motion.a>
              <Link
                to="/markalar"
                search={{ dogrulanmis: true }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-paper/10 ring-1 ring-paper/25 px-6 h-11 text-[13px] font-semibold hover:bg-paper/15 transition backdrop-blur-sm"
              >
                Doğrulanmış markalar
              </Link>
            </motion.div>
          </motion.div>

          <SealBadgeHero reduceMotion={!!reduceMotion} />
        </div>
      </section>

      {/* ── LOGO MARQUEE ── */}
      <section className="border-b border-rule bg-surface py-8 sm:py-10 overflow-hidden">
        <Reveal>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-navy-mid mb-6">
            SEAL ekosistemine güvenen markalar
          </p>
        </Reveal>
        <LogoMarquee />
      </section>

      {/* ── STATS ── */}
      <section className="border-b border-rule bg-paper py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-navy-mid mb-8">
              Platform verileri
            </p>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statItems.map((item, i) => (
              <StatCard key={item.k} item={item} index={i} reduceMotion={!!reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="font-display font-black text-[26px] sm:text-[36px] text-ink tracking-tight leading-tight">
              Oyuncuların doğrulayabileceği{" "}
              <span className="text-brand">basit bir güven katmanı</span>
            </h2>
            <p className="mt-4 text-[14px] sm:text-[15px] text-navy leading-relaxed">
              SEAL, markanıza özgünlük ileten, oyuncu güvenini artıran ve sahte profillere karşı
              koruma sağlayan bağımsız bir sertifikasyon rozetidir.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: ShieldCheck, t: "Oyuncu güvenini artırın", p: "Doğrulanmış rozet, kullanıcılara resmi temsilcilerle konuştuklarını gösterir." },
              { icon: TrendingUp, t: "Dönüşüm ve tutmayı güçlendirin", p: "Görsel güven sinyalleri tereddütü azaltır; ziyaretçiler daha hızlı karar verir." },
              { icon: Eye, t: "Sahte profillere karşı koruma", p: "SEAL yalnızca doğrulanmış markalara verilir; taklit hesaplar ayırt edilir." },
              { icon: BarChart3, t: "Şeffaf itibar yönetimi", p: "Çözüm oranı, yanıt süresi ve puanınız tek profilde görünür." },
            ].map((b, i) => (
              <BenefitCard key={b.t} {...b} index={i} reduceMotion={!!reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <ComparisonSection reduceMotion={!!reduceMotion} />

      {/* ── PILLARS + MEANING ── */}
      <section className="py-14 sm:py-20 bg-surface border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink tracking-tight">
              tepkimvar SEAL ne anlama gelir?
            </h2>
            <p className="mt-4 text-[14px] text-navy leading-relaxed">
              Resmi temsilin doğrulandığını, şikayet süreçlerine açık olunduğunu ve periyodik
              denetimlerden geçildiğini gösterir.
            </p>
            <Link
              to="/register/marka-basvuru"
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-brand hover:gap-3 transition-all"
            >
              Marka başvurusu <ArrowRight className="size-4" />
            </Link>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid sm:grid-cols-2 gap-3"
          >
            {[
              { icon: ScanLine, t: "Sürekli profil denetimi", p: "Marka bilgileri ve temsil yetkisi periyodik kontrol edilir." },
              { icon: BadgeCheck, t: "Resmi temsil doğrulaması", p: "Şirket belgeleri incelenir; onay eşleşme sonrası verilir." },
              { icon: QrCode, t: "Anında doğrulanabilir rozet", p: "QR kod marka profiline götürür; canlı durum görülür." },
              { icon: MessageCircle, t: "Çözüm odaklı görünürlük", p: "Şikayetlere resmi yanıt; süreç herkese açık ilerler." },
            ].map((p, i) => (
              <motion.div
                key={p.t}
                variants={fadeUp(i * 0.08)}
                whileHover={reduceMotion ? {} : { y: -4, transition: { duration: 0.2 } }}
                className="bg-card rounded-2xl p-4 ring-1 ring-rule hover:ring-brand/30 hover:shadow-soft transition-shadow"
              >
                <p.icon className="size-5 text-brand mb-2" />
                <div className="font-semibold text-[13px] text-ink">{p.t}</div>
                <p className="mt-1 text-[12px] text-navy-mid leading-relaxed">{p.p}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── USER VERIFY ── */}
      <VerifySection reduceMotion={!!reduceMotion} />

      {/* ── FAQ ── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal className="text-center mb-10">
            <h2 className="font-display font-black text-[26px] sm:text-[30px] text-ink">
              Sıkça sorulan sorular
            </h2>
          </Reveal>
          <div className="space-y-2">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} index={i} reduceMotion={!!reduceMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden site-cta-shell">
        <motion.div
          animate={reduceMotion ? {} : { scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/20 blur-3xl"
          aria-hidden
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 text-center relative">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="relative inline-flex mb-5">
              <span className="absolute inset-0 rounded-full bg-brand/30 animate-seal-pulse-ring" aria-hidden />
              <BadgeCheck className="size-14 text-brand relative" />
            </div>
            <h2 className="font-display font-black text-[26px] sm:text-[36px] text-paper tracking-tight">
              Güven görünür olsun.
            </h2>
            <p className="mt-3 text-[14px] text-paper/75 max-w-lg mx-auto">
              Oyuncuları koruyan ve marka güvenilirliğini artıran operatörlere katılın.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <motion.a
                href={siteContactMailto("tepkimvar SEAL — bilgi talebi")}
                whileHover={reduceMotion ? {} : { scale: 1.03 }}
                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-7 h-11 text-[13px] font-semibold hover:brightness-105 transition shadow-lg shadow-brand/30"
              >
                SEAL hakkında bilgi alın <ArrowRight className="size-4" />
              </motion.a>
              <Link
                to="/iletisim"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-paper/10 ring-1 ring-paper/20 text-paper px-7 h-11 text-[13px] font-semibold hover:bg-paper/15 transition"
              >
                İletişime geçin
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function HeroBackground({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return (
      <>
        <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-accent-purple/15 blur-3xl" aria-hidden />
      </>
    );
  }
  return (
    <>
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand/20 blur-3xl"
        aria-hidden
      />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-accent-purple/25 blur-3xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(0.55_0.14_158/0.12),transparent_50%)]" aria-hidden />
    </>
  );
}

function SealBadgeHero({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
      className="relative w-full max-w-md lg:max-w-lg mx-auto lg:ml-auto"
    >
      {/* Orbit ring */}
      {!reduceMotion && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="size-[115%] rounded-full border border-dashed border-brand/25 animate-seal-orbit" />
        </div>
      )}

      <div className={`relative ${reduceMotion ? "" : "animate-floaty"}`}>
        <div className="absolute -inset-3 rounded-3xl bg-brand/20 blur-2xl animate-seal-glow pointer-events-none" aria-hidden />

        <div className="relative overflow-hidden rounded-2xl p-1.5 bg-gradient-to-br from-paper/25 via-paper/10 to-brand/40 shadow-2xl ring-1 ring-paper/25">
          <div className="relative overflow-hidden rounded-[14px] ring-1 ring-paper/20 bg-ink/50">
            <img
              src="/dogrulama-rozeti.jpg"
              alt="tepkimvar SEAL doğrulama rozeti"
              width={1024}
              height={494}
              className="block w-full h-auto"
            />
            {!reduceMotion && (
              <>
                <div className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_12px_oklch(0.55_0.14_158)] animate-seal-scan pointer-events-none" aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 via-transparent to-transparent pointer-events-none" aria-hidden />
              </>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="absolute -bottom-4 left-4 right-4 sm:left-auto sm:right-2 sm:max-w-[240px] inline-flex items-center gap-2 rounded-xl bg-card text-ink px-4 py-2.5 shadow-lift ring-1 ring-rule text-[12px] font-medium"
        >
          <motion.span
            animate={reduceMotion ? {} : { scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <QrCode className="size-4 text-brand shrink-0" />
          </motion.span>
          QR ile anında doğrulama
        </motion.div>
      </div>
    </motion.div>
  );
}

function LogoMarquee() {
  const logos = [...BRAND_LOGOS, ...BRAND_LOGOS];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-surface to-transparent z-10" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-surface to-transparent z-10" aria-hidden />
      <div className="flex w-max animate-ticker hover:[animation-play-state:paused]">
        {logos.map((slug, i) => (
          <div
            key={`${slug}-${i}`}
            className="mx-3 sm:mx-5 flex items-center justify-center h-14 sm:h-16 w-28 sm:w-32 shrink-0 rounded-xl bg-card ring-1 ring-rule px-4 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300"
          >
            <img
              src={`/brand-logos/${slug}.png`}
              alt={slug}
              className="max-h-8 sm:max-h-9 w-auto object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  item,
  index,
  reduceMotion,
}: {
  item: { v: string; k: string; icon: typeof BadgeCheck; num?: number };
  index: number;
  reduceMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.55, ease: EASE, delay: index * 0.08 }}
      whileHover={reduceMotion ? {} : { y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl p-4 sm:p-6 ring-1 ring-rule text-center sm:text-left hover:ring-brand/25 hover:shadow-soft transition-shadow"
    >
      <span className="inline-grid place-items-center size-10 rounded-xl bg-brand-soft text-brand mb-3">
        <Icon className="size-4" />
      </span>
      <AnimatedValue value={item.v} num={item.num} active={inView && !reduceMotion} />
      <div className="text-[11px] sm:text-[12px] text-navy-mid mt-1">{item.k}</div>
    </motion.div>
  );
}

function AnimatedValue({ value, num, active }: { value: string; num?: number; active: boolean }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!active || num == null || Number.isNaN(num)) {
      setDisplay(value);
      return;
    }
    const isPercent = value.startsWith("%");
    const target = Math.round(num);
    const duration = 1200;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(target * eased);
      setDisplay(isPercent ? `%${current}` : current.toLocaleString("tr-TR"));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, num, value]);

  return (
    <div className="font-display font-black text-[24px] sm:text-[30px] text-ink tabular-nums">
      {display}
    </div>
  );
}

function BenefitCard({
  icon: Icon,
  t,
  p,
  index,
  reduceMotion,
}: {
  icon: typeof ShieldCheck;
  t: string;
  p: string;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.article
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: EASE, delay: index * 0.1 }}
      whileHover={reduceMotion ? {} : { y: -6, transition: { duration: 0.25 } }}
      className="group bg-card rounded-2xl p-5 sm:p-7 ring-1 ring-rule hover:ring-brand/30 hover:shadow-lift transition-shadow"
    >
      <span className="grid place-items-center size-12 rounded-2xl bg-brand-soft text-brand mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold text-[16px] sm:text-[17px] text-ink">{t}</h3>
      <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">{p}</p>
    </motion.article>
  );
}

function ComparisonSection({ reduceMotion }: { reduceMotion: boolean }) {
  const without = ["Belirsiz marka kimliği", "Sahte profil riski yüksek", "Oyuncu şüphesi artar", "Düşük dönüşüm", "Görünür güven sinyali yok"];
  const withSeal = ["Resmi temsil onaylı", "QR ile anında doğrulama", "Şeffaf çözüm geçmişi", "Profilde doğrulanmış rozeti", "Sahte hesaplara karşı koruma"];

  return (
    <section className="py-14 sm:py-20 bg-surface border-y border-rule overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="text-center mb-10 sm:mb-12">
          <h2 className="font-display font-black text-[26px] sm:text-[34px] text-ink">
            SEAL&apos;siz vs. SEAL ile
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="rounded-2xl bg-card ring-1 ring-rule p-6 sm:p-8"
          >
            <div className="flex items-center gap-2 text-danger font-semibold text-[13px] uppercase tracking-wider mb-6">
              <ShieldAlert className="size-4" /> SEAL&apos;siz
            </div>
            <ul className="space-y-3">
              {without.map((line, i) => (
                <motion.li
                  key={line}
                  initial={reduceMotion ? {} : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                  className="flex items-start gap-2.5 text-[13px] text-navy-mid"
                >
                  <X className="size-4 text-danger shrink-0 mt-0.5" />
                  {line}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="rounded-2xl bg-gradient-to-br from-brand/15 via-card to-brand-soft/40 ring-2 ring-brand/35 p-6 sm:p-8 relative overflow-hidden"
          >
            <motion.div
              animate={reduceMotion ? {} : { opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-0 right-0 size-32 bg-brand/20 rounded-full blur-2xl pointer-events-none"
              aria-hidden
            />
            <div className="flex items-center gap-2 text-brand font-semibold text-[13px] uppercase tracking-wider mb-6 relative">
              <BadgeCheck className="size-4" /> tepkimvar SEAL
            </div>
            <ul className="space-y-3 relative">
              {withSeal.map((line, i) => (
                <motion.li
                  key={line}
                  initial={reduceMotion ? {} : { opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
                  className="flex items-start gap-2.5 text-[13px] text-ink font-medium"
                >
                  <Check className="size-4 text-brand shrink-0 mt-0.5" />
                  {line}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function VerifySection({ reduceMotion }: { reduceMotion: boolean }) {
  const steps = [
    { n: "1", t: "QR kodu tarayın", d: "Rozet veya reklamdaki QR kod marka profiline götürür." },
    { n: "2", t: "Rozeti kontrol edin", d: "Profilde mavi doğrulanmış rozeti ve SEAL ibaresini görün." },
    { n: "3", t: "Geçmişe bakın", d: "Çözüm oranı, yanıt süresi ve şikayet geçmişini inceleyin." },
  ];

  return (
    <section className="py-14 sm:py-16 bg-ink text-paper relative overflow-hidden">
      {!reduceMotion && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 size-64 border border-dashed border-paper/10 rounded-full"
          aria-hidden
        />
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-5 gap-10 items-center relative">
        <Reveal className="md:col-span-2">
          <QrCode className="size-10 text-brand mb-4" />
          <h2 className="font-display font-bold text-[24px] sm:text-[28px]">Kullanıcılar için doğrulama</h2>
          <p className="mt-3 text-[13px] sm:text-[14px] text-paper/70 leading-relaxed">
            Bir markanın gerçekten doğrulanmış olup olmadığını saniyeler içinde kontrol edin.
          </p>
        </Reveal>
        <ol className="md:col-span-3 grid sm:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.li
              key={step.n}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
              whileHover={reduceMotion ? {} : { y: -4 }}
              className="rounded-2xl bg-paper/5 ring-1 ring-paper/10 p-5 backdrop-blur-sm hover:bg-paper/8 transition-colors list-none"
            >
              <div className="size-9 rounded-full bg-brand text-brand-foreground grid place-items-center text-[13px] font-bold mb-3 shadow-lg shadow-brand/30">
                {step.n}
              </div>
              <div className="font-semibold text-[14px]">{step.t}</div>
              <p className="mt-1.5 text-[12px] text-paper/65 leading-relaxed">{step.d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FaqItem({ q, a, index, reduceMotion }: { q: string; a: string; index: number; reduceMotion: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="bg-card rounded-xl ring-1 ring-rule overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left hover:bg-surface/60 transition"
        aria-expanded={open}
      >
        <span className="font-semibold text-[14px] text-ink">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="size-4 text-navy-mid shrink-0" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 text-[13px] text-navy-mid leading-relaxed border-t border-rule pt-3">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const FAQS = [
  {
    q: "tepkimvar SEAL nedir?",
    a: "tepkimvar SEAL, bir markanın platformdaki profilinin resmi temsilci tarafından yönetildiğini, şikayetlere yanıt verme yükümlülüğünü kabul ettiğini ve periyodik denetimlerden geçtiğini gösteren bağımsız doğrulama rozetidir.",
  },
  {
    q: "SEAL nasıl alınır?",
    a: "Marka başvurusu yapılır; şirket belgeleri incelenir. Onay sonrası profilinize SEAL rozeti ve QR kodu eklenir. Süreç genellikle 3–5 iş günü sürer.",
  },
  {
    q: "QR kod ne işe yarar?",
    a: "QR kod kullanıcıyı doğrudan markanın tepkimvar profiline götürür. Ekran görüntüsü veya kopyalanmış rozetler tek başına yeterli sayılmaz.",
  },
  {
    q: "SEAL'in gerçek olup olmadığını nasıl anlarım?",
    a: "QR kodu tarayın veya marka adını arayın. Profilde mavi doğrulanmış rozeti görmelisiniz.",
  },
  {
    q: "SEAL iptal edilir mi?",
    a: "Evet. Yanıltıcı bilgi, temsil yetkisi kaybı veya sistematik yanıtsızlık tespit edilirse SEAL derhal kaldırılır.",
  },
];
