import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { fetchPlatformStats } from "@/lib/data";
import { seoHead, breadcrumbLd } from "@/lib/seo";
import { siteContactMailto } from "@/lib/contact";

export const Route = createFileRoute("/_site/(kurumsal)/tepkimvar-seal")({
  loader: async () => ({ stats: await fetchPlatformStats().catch(() => null) }),
  head: () => ({
    ...seoHead({
      title: "tepkimvar SEAL — Marka Doğrulama ve Güven Rozeti",
      description:
        "tepkimvar SEAL, markanızın resmi temsilcisi olduğunu ve şikayetlere şeffaf yanıt verdiğini gösterir. Oyuncular QR kod ile anında doğrular.",
      path: "/tepkimvar-seal",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "tepkimvar SEAL", path: "/tepkimvar-seal" },
      ]),
    ],
  }),
  component: SealPage,
});

function SealPage() {
  const s = Route.useLoaderData().stats;
  const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("tr-TR") : "—");

  const stats = [
    { v: s ? nf(s.totalCompanies) : "—", k: "Kayıtlı marka", icon: BadgeCheck },
    { v: s ? `%${Math.round(s.resolutionRate)}` : "—", k: "Ortalama çözüm oranı", icon: TrendingUp },
    { v: s ? nf(s.resolvedComplaints) : "—", k: "Çözülen şikayet", icon: MessageCircle },
    { v: s ? nf(s.totalUsers) : "—", k: "Platform üyesi", icon: Users },
  ];

  const benefits = [
    {
      icon: ShieldCheck,
      t: "Oyuncu güvenini artırın",
      p: "Doğrulanmış rozet, kullanıcılara doğru adrese geldiklerini ve resmi temsilcilerle konuştuklarını gösterir.",
    },
    {
      icon: TrendingUp,
      t: "Dönüşüm ve tutmayı güçlendirin",
      p: "Görsel güven sinyalleri tereddütü azaltır; marka profilinize gelen ziyaretçiler daha hızlı karar verir.",
    },
    {
      icon: Eye,
      t: "Sahte profillere karşı koruma",
      p: "SEAL yalnızca doğrulanmış markalara verilir; taklit siteler ve sahte hesaplar ayırt edilir.",
    },
    {
      icon: BarChart3,
      t: "Şeffaf itibar yönetimi",
      p: "Çözüm oranınız, yanıt süreniz ve müşteri puanınız tek profilde görünür; güven ölçülebilir hale gelir.",
    },
  ];

  const pillars = [
    {
      icon: ScanLine,
      t: "Sürekli profil denetimi",
      p: "Tek seferlik onay değil: marka bilgileriniz, iletişim kanallarınız ve temsil yetkiniz periyodik olarak kontrol edilir.",
    },
    {
      icon: BadgeCheck,
      t: "Resmi temsil doğrulaması",
      p: "Şirket unvanı, vergi/ ticaret kaydı ve yetkili temsil belgeleri incelenir; onay yalnızca eşleşme sonrası verilir.",
    },
    {
      icon: QrCode,
      t: "Anında doğrulanabilir rozet",
      p: "Her SEAL benzersiz QR kod içerir; kullanıcılar marka profilinize giderek canlı durumu kontrol edebilir.",
    },
    {
      icon: MessageCircle,
      t: "Çözüm odaklı görünürlük",
      p: "Doğrulanmış markalar şikayetlere resmi yanıt verir; süreç herkese açık ilerler ve güven pekişir.",
    },
  ];

  const withoutSeal = [
    "Belirsiz marka kimliği",
    "Sahte profil riski yüksek",
    "Oyuncu şüphesi artar",
    "Düşük dönüşüm",
    "Görünür güven sinyali yok",
  ];

  const withSeal = [
    "Resmi temsil onaylı",
    "QR ile anında doğrulama",
    "Şeffaf çözüm geçmişi",
    "Profilde doğrulanmış rozeti",
    "Sahte hesaplara karşı koruma",
  ];

  const faqs = [
    {
      q: "tepkimvar SEAL nedir?",
      a: "tepkimvar SEAL, bir markanın platformdaki profilinin resmi temsilci tarafından yönetildiğini, şikayetlere yanıt verme yükümlülüğünü kabul ettiğini ve periyodik denetimlerden geçtiğini gösteren bağımsız doğrulama rozetidir.",
    },
    {
      q: "SEAL nasıl alınır?",
      a: "Marka başvurusu yapılır; şirket belgeleri ve yetkili temsil bilgileri incelenir. İlk doğrulama tamamlandıktan sonra profilinize SEAL rozeti ve QR kodu eklenir. Süreç genellikle 3–5 iş günü sürer.",
    },
    {
      q: "QR kod ne işe yarar?",
      a: "Rozet üzerindeki QR kod, kullanıcıyı doğrudan markanın tepkimvar profiline götürür. Böylece 'doğru firma mı?' sorusu saniyeler içinde yanıtlanır; ekran görüntüsü veya kopyalanmış rozetler tek başına yeterli sayılmaz.",
    },
    {
      q: "Bir markanın SEAL'inin gerçek olup olmadığını nasıl anlarım?",
      a: "QR kodu tarayın veya marka adını tepkimvar'da arayın. Profilde mavi doğrulanmış rozeti ve 'Doğrulanmış marka' ibaresini görmelisiniz. Rozet yalnızca profil sayfasında aktif görünür.",
    },
    {
      q: "SEAL iptal edilir mi?",
      a: "Evet. Yanıltıcı bilgi, temsil yetkisi kaybı, sistematik yanıtsızlık veya kötüye kullanım tespit edilirse SEAL derhal kaldırılır ve profil güncellenir.",
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-rule bg-gradient-to-br from-ink via-[oklch(0.28_0.04_262)] to-brand/40 text-paper">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-accent-purple/20 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center relative">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-paper/10 backdrop-blur px-3 h-8 text-[11px] sm:text-[12px] font-semibold ring-1 ring-paper/20 mb-5">
              <Sparkles className="size-3.5 text-brand" /> Markalar için doğrulama
            </span>
            <h1 className="font-display font-black text-[28px] sm:text-[44px] leading-[1.06] tracking-[-0.02em]">
              Oyuncu güvenini inşa edin.
              <span className="block text-brand mt-1">tepkimvar SEAL ile kanıtlayın.</span>
            </h1>
            <p className="mt-5 text-[14px] sm:text-[16px] text-paper/75 leading-relaxed max-w-xl">
              tepkimvar SEAL, markanızın resmi temsilcisi olduğunu, şikayetlere şeffaf yanıt verdiğini
              ve sürekli denetlendiğini gösterir — tıpkı bağımsız oyun doğrulama mührleri gibi,
              ancak müşteri deneyimi ve çözüm odaklı.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a
                href={siteContactMailto("tepkimvar SEAL başvurusu")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:brightness-105 transition"
              >
                SEAL başvurusu yap <ArrowRight className="size-4" />
              </a>
              <Link
                to="/markalar"
                search={{ dogrulanmis: true }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-paper/10 ring-1 ring-paper/25 px-6 h-11 text-[13px] font-semibold hover:bg-paper/15 transition"
              >
                Doğrulanmış markalar
              </Link>
            </div>
          </div>

          <div className="relative w-full max-w-md lg:max-w-lg mx-auto lg:ml-auto">
            <div className="relative overflow-hidden rounded-2xl p-1.5 bg-gradient-to-br from-paper/20 via-paper/5 to-brand/30 shadow-2xl ring-1 ring-paper/20">
              <div className="overflow-hidden rounded-[14px] ring-1 ring-paper/15 bg-ink/40">
                <img
                  src="/dogrulama-rozeti.jpg"
                  alt="tepkimvar SEAL doğrulama rozeti — QR kod ile marka profili doğrulama"
                  width={1024}
                  height={494}
                  className="block w-full h-auto"
                  loading="eager"
                />
              </div>
            </div>
            <div className="absolute -bottom-3 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto inline-flex items-center gap-2 rounded-xl bg-card text-ink px-4 py-2.5 shadow-lift ring-1 ring-rule text-[12px] font-medium">
              <QrCode className="size-4 text-brand shrink-0" />
              QR kod ile anında profil doğrulama
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-navy-mid mb-6">
            Platform verileri
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.k} className="bg-card rounded-2xl p-4 sm:p-5 ring-1 ring-rule text-center sm:text-left">
                  <span className="inline-grid place-items-center size-9 rounded-xl bg-brand-soft text-brand mb-3">
                    <Icon className="size-4" />
                  </span>
                  <div className="font-display font-black text-[22px] sm:text-[28px] text-ink tabular-nums">{item.v}</div>
                  <div className="text-[11px] sm:text-[12px] text-navy-mid mt-1">{item.k}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display font-black text-[24px] sm:text-[32px] text-ink tracking-tight">
              Oyuncuların doğrulayabileceği basit bir güven katmanı
            </h2>
            <p className="mt-3 text-[14px] text-navy leading-relaxed">
              SEAL, markanıza özgünlük ileten, oyuncu güvenini artıran ve sahte profillere karşı
              koruma sağlayan bağımsız bir sertifikasyon rozetidir.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <article key={b.t} className="bg-card rounded-2xl p-5 sm:p-6 ring-1 ring-rule hover:ring-brand/25 transition">
                  <span className="grid place-items-center size-11 rounded-xl bg-brand-soft text-brand mb-4">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold text-[16px] text-ink">{b.t}</h3>
                  <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">{b.p}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-12 sm:py-16 bg-surface border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center font-display font-black text-[24px] sm:text-[30px] text-ink mb-8 sm:mb-10">
            SEAL'siz vs. SEAL ile
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl bg-card ring-1 ring-rule p-6 sm:p-7">
              <div className="flex items-center gap-2 text-danger font-semibold text-[13px] uppercase tracking-wider mb-5">
                <ShieldAlert className="size-4" /> SEAL'siz
              </div>
              <ul className="space-y-3">
                {withoutSeal.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[13px] text-navy-mid">
                    <X className="size-4 text-danger shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-brand/10 via-card to-brand-soft/30 ring-2 ring-brand/30 p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 size-24 bg-brand/10 rounded-full blur-2xl pointer-events-none" aria-hidden />
              <div className="flex items-center gap-2 text-brand font-semibold text-[13px] uppercase tracking-wider mb-5 relative">
                <BadgeCheck className="size-4" /> tepkimvar SEAL
              </div>
              <ul className="space-y-3 relative">
                {withSeal.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[13px] text-ink">
                    <Check className="size-4 text-brand shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display font-black text-[24px] sm:text-[32px] text-ink tracking-tight">
              tepkimvar SEAL ne anlama gelir?
            </h2>
            <p className="mt-3 text-[14px] text-navy leading-relaxed">
              Bir markanın resmi temsilcisinin doğrulandığını, şikayet süreçlerine açık olduğunu
              ve periyodik denetimlerden geçtiğini gösterir. Oyunculara güvenle tercih yapacakları
              yeri seçmeleri için basit ve güvenilir bir sinyal sunar.
            </p>
            <Link
              to="/register/marka-basvuru"
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-brand hover:gap-3 transition-all"
            >
              Marka başvurusu <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.t} className="bg-card rounded-2xl p-4 ring-1 ring-rule">
                  <Icon className="size-5 text-brand mb-2" />
                  <div className="font-semibold text-[13px] text-ink">{p.t}</div>
                  <p className="mt-1 text-[12px] text-navy-mid leading-relaxed">{p.p}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* USER VERIFY */}
      <section className="py-12 sm:py-14 bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-1">
            <QrCode className="size-10 text-brand mb-4" />
            <h2 className="font-display font-bold text-[22px] sm:text-[26px]">Kullanıcılar için doğrulama</h2>
            <p className="mt-2 text-[13px] text-paper/70 leading-relaxed">
              Bir markanın gerçekten doğrulanmış olup olmadığını kontrol etmek için QR kodu tarayın
              veya marka adını arama kutusuna yazın.
            </p>
          </div>
          <ol className="md:col-span-2 grid sm:grid-cols-3 gap-4">
            {[
              { n: "1", t: "QR kodu tarayın", d: "Rozet veya reklamdaki QR kod marka profiline götürür." },
              { n: "2", t: "Rozeti kontrol edin", d: "Profilde mavi doğrulanmış rozeti ve SEAL ibaresini görün." },
              { n: "3", t: "Geçmişe bakın", d: "Çözüm oranı, yanıt süresi ve şikayet geçmişini inceleyin." },
            ].map((step) => (
              <li key={step.n} className="rounded-2xl bg-paper/5 ring-1 ring-paper/10 p-4">
                <div className="size-8 rounded-full bg-brand text-brand-foreground grid place-items-center text-[13px] font-bold mb-3">
                  {step.n}
                </div>
                <div className="font-semibold text-[14px]">{step.t}</div>
                <p className="mt-1 text-[12px] text-paper/65 leading-relaxed">{step.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="font-display font-black text-[24px] sm:text-[28px] text-ink text-center mb-8">
            Sıkça sorulan sorular
          </h2>
          <div className="space-y-2">
            {faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden site-cta-shell">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/14 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-16 text-center relative">
          <BadgeCheck className="size-12 text-brand mx-auto mb-4" />
          <h2 className="font-display font-black text-[24px] sm:text-[34px] text-paper tracking-tight">
            Güven görünür olsun.
          </h2>
          <p className="mt-3 text-[14px] text-paper/75 max-w-lg mx-auto">
            Oyuncuları koruyan ve marka güvenilirliğini artıran operatörlere katılın.
            tepkimvar SEAL ile farkınızı gösterin.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={siteContactMailto("tepkimvar SEAL — bilgi talebi")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-7 h-11 text-[13px] font-semibold hover:brightness-105 transition"
            >
              SEAL hakkında bilgi alın <ArrowRight className="size-4" />
            </a>
            <Link
              to="/iletisim"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-paper/10 ring-1 ring-paper/20 text-paper px-7 h-11 text-[13px] font-semibold hover:bg-paper/15 transition"
            >
              İletişime geçin
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl ring-1 ring-rule overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left hover:bg-surface/60 transition"
        aria-expanded={open}
      >
        <span className="font-semibold text-[14px] text-ink">{q}</span>
        <ChevronDown className={`size-4 text-navy-mid shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 text-[13px] text-navy-mid leading-relaxed border-t border-rule pt-3">
          {a}
        </div>
      )}
    </div>
  );
}
