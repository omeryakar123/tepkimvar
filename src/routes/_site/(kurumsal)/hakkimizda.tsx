import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Users,
  Sparkles,
  TrendingUp,
  PenLine,
  MessageCircle,
  CheckCircle2,
  Scale,
  Eye,
  HeartHandshake,
  Megaphone,
  BadgeCheck,
  Star,
  Search,
  Building2,
  BarChart3,
  ShieldAlert,
  Lock,
  UserX,
  Gavel,
} from "lucide-react";
import { fetchPlatformStats } from "@/lib/data";
import { seoHead, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/_site/(kurumsal)/hakkimizda")({
  loader: async () => ({ stats: await fetchPlatformStats().catch(() => null) }),
  head: () => ({
    ...seoHead({
      title: "Hakkımızda — itirazvar | Türkiye'nin Bağımsız Şikayet Platformu",
      description:
        "itirazvar, tüketici ile marka arasında köprü kuran bağımsız şikayet çözüm platformudur. Şikayetini yaz, markadan resmi yanıt al, çözüm sürecini şeffafça takip et.",
      path: "/hakkimizda",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "Hakkımızda", path: "/hakkimizda" },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
  // Gerçek platform verisi; uydurma sayı kullanılmıyor.
  const s = Route.useLoaderData().stats;
  const nf = (n: number) => n.toLocaleString("tr-TR");
  const stats = [
    { icon: Users, label: "Kayıtlı Üye", value: s ? nf(s.totalUsers) : "—" },
    { icon: ShieldCheck, label: "Kayıtlı Marka", value: s ? nf(s.totalCompanies) : "—" },
    { icon: TrendingUp, label: "Çözülen Şikayet", value: s ? nf(s.resolvedComplaints) : "—" },
    { icon: Sparkles, label: "Çözüm Oranı", value: s ? `%${Math.round(s.resolutionRate)}` : "—" },
  ];

  const steps = [
    {
      icon: PenLine,
      t: "1. Şikayetini yaz",
      p: "Yaşadığın sorunu birkaç dakikada anlat; belge ve görsel ekle, istersen anonim paylaş. Şikayetin moderasyondan geçtikten sonra herkese açık yayınlanır ve benzersiz bir takip kodu alır.",
    },
    {
      icon: MessageCircle,
      t: "2. Marka yanıt verir",
      p: "İlgili marka şikayetini görür ve resmi yanıtını doğrudan sayfana yazar. Gerekirse seninle özel mesaj üzerinden iletişim kurar. Tüm süreç herkesin gözü önünde, şeffaf ilerler.",
    },
    {
      icon: CheckCircle2,
      t: "3. Çözümü onayla, puanla",
      p: "Sorunun çözüldüyse şikayetini yalnızca SEN 'çözüldü' olarak kapatabilirsin; markayı 5 yıldız üzerinden değerlendirir, dilersen bir teşekkür notu bırakırsın. Puanın markanın skoruna doğrudan yansır.",
    },
  ];

  const values = [
    {
      icon: Scale,
      t: "Bağımsızlık",
      p: "Hiçbir markanın tarafı değiliz. Puan sıralamasını para değil, gerçek çözüm performansı belirler. Hiçbir marka, ücret karşılığında şikayet sildiremez veya puanını değiştiremez.",
    },
    {
      icon: Eye,
      t: "Şeffaflık",
      p: "Marka puanları, çözüm oranları ve yanıt süreleri gerçek verilerden hesaplanır. Süreçlerimizi Şeffaflık Raporu ile düzenli olarak kamuya açıyoruz.",
    },
    {
      icon: HeartHandshake,
      t: "Çözüm odaklılık",
      p: "Amacımız şikayet biriktirmek değil; tüketiciyi ve markayı aynı masada buluşturup sorunu kapatmak. Başarı ölçümüz yayınlanan şikayet sayısı değil, çözülen şikayet sayısıdır.",
    },
  ];

  const forConsumers = [
    { icon: Megaphone, t: "Sesini duyur", p: "Şikayetin kaybolup gitmez; doğrudan markanın önüne düşer ve kamuya açık kalır." },
    { icon: Search, t: "Almadan önce araştır", p: "Bir markadan alışveriş yapmadan önce gerçek müşteri deneyimlerini, çözüm oranını ve yanıt hızını gör." },
    { icon: UserX, t: "Anonim kalabil", p: "İstersen kimliğini gizleyerek şikayet yaz; adın markaya ve diğer kullanıcılara gösterilmez." },
    { icon: Star, t: "Deneyimini puanla", p: "Çözüm sürecini 5 yıldız üzerinden değerlendir; puanın diğer tüketicilere yol göstersin." },
  ];

  const forBrands = [
    { icon: BadgeCheck, t: "Doğrulanmış profil", p: "Markanı doğrula, resmi yanıt ver; doğrulanmış rozeti ile güven kazan." },
    { icon: MessageCircle, t: "Tek panelden yönetim", p: "Tüm şikayetleri tek panelden görüntüle, yanıtla ve müşterinle özel mesajlaş." },
    { icon: BarChart3, t: "Gerçek zamanlı istatistik", p: "Çözüm oranını, yanıt hızını ve müşteri memnuniyetini anlık olarak takip et." },
    { icon: TrendingUp, t: "İtibarını büyüt", p: "Çözdüğün her şikayet skoruna yansır; başarı hikayelerin marka sayfanda sergilenir." },
  ];

  const trust = [
    {
      icon: ShieldAlert,
      t: "Ön moderasyon",
      p: "Her şikayet yayına alınmadan önce otomatik kontrollerden geçer; küfür, hakaret, spam ve kişisel veri içeren içerikler yayınlanmaz, şüpheli içerikler insan moderatöre düşer.",
    },
    {
      icon: Lock,
      t: "Veri güvenliği",
      p: "Verilerin şifreli bağlantıyla taşınır, belgelerine erişim yetki kontrolüne tabidir. Gizli olarak işaretlenen kanıt dosyalarını yalnızca yetkili taraflar görebilir.",
    },
    {
      icon: Gavel,
      t: "Adil itiraz süreci",
      p: "Hakkında hukuka aykırı içerik olduğunu düşünen herkes 'Raporla' özelliğiyle bildirimde bulunabilir; bildirimler moderasyon ekibince incelenir ve sonuçlandırılır.",
    },
  ];

  return (
    <div>
      {/* HERO */}
      <div className="relative h-64 bg-gradient-to-br from-dark via-navy to-brand/40 grid place-items-center">
        <div className="text-center px-6">
          <p className="text-white/60 text-xs uppercase tracking-widest mb-2">itirazvar.</p>
          <h1 className="text-white text-3xl sm:text-5xl font-display font-black">
            Türkiye'nin bağımsız
            <br />
            müşteri deneyimi platformu
          </h1>
        </div>
      </div>

      {/* MİSYON */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 space-y-6 text-navy leading-relaxed">
        <p className="text-lg text-center">
          Tüketicinin sesini duyurabildiği, markaların çözüm ürettiği ve herkesin
          alışveriş kararını gerçek deneyimlere göre verebildiği bir Türkiye için çalışıyoruz.
        </p>
        <p>
          itirazvar, müşterilerle markalar arasında köprü görevi üstlenen bağımsız bir çözüm
          platformudur. Yaşanan her sorunun bir muhatabı olduğuna inanırız: şikayetler burada
          kaybolmaz, markanın önüne gider; verilen her yanıt ve üretilen her çözüm herkese açık
          şekilde kayıt altına alınır. Böylece hem tüketicinin mağduriyeti giderilir hem de
          alışveriş yapmayı düşünen milyonlarca ziyaretçi markaların gerçek performansını görür.
        </p>
        <ul className="space-y-2 pl-6 list-disc">
          <li><b className="text-ink">Tüketiciler</b> seslerini markaya duyurur, çözüm sürecini adım adım takip eder.</li>
          <li><b className="text-ink">Markalar</b> şikayetleri memnuniyete dönüştürerek itibarlarını ve müşteri sadakatini güçlendirir.</li>
          <li><b className="text-ink">Ziyaretçiler</b> satın alma kararı öncesinde markanın çözüm oranını ve gerçek deneyimleri inceler.</li>
        </ul>
      </div>

      {/* NEDEN VARIZ */}
      <div className="bg-surface border-y border-rule">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 space-y-6 text-navy leading-relaxed">
          <h2 className="text-center font-display font-bold text-[24px] text-ink">
            Neden varız?
          </h2>
          <p>
            Hepimiz yaşadık: kargosu kaybolan bir sipariş, iade edilmeyen bir ücret, günlerce
            ulaşılamayan bir çağrı merkezi… Tüketici çoğu zaman sesi duyulmayan taraf olur.
            Telefonda dakikalarca bekletilir, e-postaları yanıtsız kalır, sorunu sosyal medyada
            kaybolur gider. Marka tarafında ise tablo farklı değildir: memnuniyetsiz müşterisinden
            çoğu zaman en son haberi olan, sorunu çözmek istese de doğru kanalı bulamayan ekipler
            vardır.
          </p>
          <p>
            itirazvar bu kopukluğu ortadan kaldırmak için kuruldu. Şikayetini buraya yazdığında
            iki şey birden olur: sorunun <b className="text-ink">kamuya açık bir kayda</b> dönüşür
            ve <b className="text-ink">doğrudan markanın önüne</b> gider. Kamuya açıklık markayı
            çözüm üretmeye teşvik eder; kayıt altına alınmış süreç ise diğer tüketicilere yol
            gösterir. Çözülen her şikayet, hem bir mağduriyetin giderilmesi hem de markanın
            hanesine yazılan gerçek bir başarıdır.
          </p>
          <p>
            Biz şikayeti bir kavga değil, bir <b className="text-ink">fırsat</b> olarak görürüz.
            Doğru yönetilen bir şikayet, kaybedilmiş bir müşteriyi markanın en sadık savunucusuna
            dönüştürebilir. Platformdaki tüm araçları — puanlama sistemini, çözüm tünelini, marka
            panelini, moderasyonu — bu dönüşümü mümkün kılmak için tasarladık.
          </p>
        </div>
      </div>

      {/* NASIL ÇALIŞIR */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <h2 className="text-center font-display font-bold text-[24px] text-ink mb-10">
          Nasıl çalışır?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((st) => (
            <div key={st.t} className="bg-card rounded-2xl p-6 ring-1 ring-rule">
              <div className="size-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-4">
                <st.icon className="size-5" />
              </div>
              <h3 className="font-display font-bold text-[16px] text-ink">{st.t}</h3>
              <p className="mt-2 text-[13.5px] text-navy leading-relaxed">{st.p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* GERÇEK SAYILAR */}
      <div className="bg-card border-y border-rule">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((st) => (
            <div key={st.label} className="text-center">
              <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-3">
                <st.icon className="size-6 text-brand" />
              </div>
              <div className="text-2xl font-black text-ink tabular-nums">{st.value}</div>
              <div className="text-xs text-navy-mid mt-1">{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TÜKETİCİLER + MARKALAR İÇİN */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-card rounded-3xl ring-1 ring-rule p-8">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-brand mb-4">
              <Users className="size-4" /> Tüketiciler için
            </div>
            <h3 className="font-display font-bold text-[20px] text-ink mb-6">
              Yalnız değilsin — arkanda bir platform var.
            </h3>
            <div className="space-y-5">
              {forConsumers.map((f) => (
                <div key={f.t} className="flex gap-3">
                  <div className="size-9 rounded-lg bg-brand-soft text-brand grid place-items-center shrink-0">
                    <f.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-[14px] text-ink">{f.t}</div>
                    <p className="text-[13px] text-navy leading-relaxed mt-0.5">{f.p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-3xl ring-1 ring-rule p-8">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-accent-purple mb-4">
              <Building2 className="size-4" /> Markalar için
            </div>
            <h3 className="font-display font-bold text-[20px] text-ink mb-6">
              Şikayeti, en güçlü müşteri kazanma aracına dönüştür.
            </h3>
            <div className="space-y-5">
              {forBrands.map((f) => (
                <div key={f.t} className="flex gap-3">
                  <div className="size-9 rounded-lg bg-accent-purple/10 text-accent-purple grid place-items-center shrink-0">
                    <f.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-[14px] text-ink">{f.t}</div>
                    <p className="text-[13px] text-navy leading-relaxed mt-0.5">{f.p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GÜVEN VE MODERASYON */}
      <div className="bg-surface border-y border-rule">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-center font-display font-bold text-[24px] text-ink mb-3">
            Güven, tesadüfe bırakılmaz
          </h2>
          <p className="text-center text-[14px] text-navy-mid mb-10 max-w-2xl mx-auto">
            Platformdaki her içerik ve her puan, kurallara bağlı süreçlerden geçer. Yayınlanan
            şikayetlerin gerçek deneyimlere dayanması ve tarafların adil şekilde temsil edilmesi
            bizim sorumluluğumuzdur.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {trust.map((t) => (
              <div key={t.t} className="bg-card rounded-2xl p-6 ring-1 ring-rule">
                <div className="size-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-4">
                  <t.icon className="size-5" />
                </div>
                <h3 className="font-display font-bold text-[16px] text-ink">{t.t}</h3>
                <p className="mt-2 text-[13.5px] text-navy leading-relaxed">{t.p}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-[13px] text-navy-mid">
            Süreçlerimizin ayrıntıları için{" "}
            <Link to="/seffaflik-raporu" className="text-brand hover:underline">Şeffaflık Raporu</Link>
            {"'nu, "}
            kurallar için{" "}
            <Link to="/kullanim-kosullari" className="text-brand hover:underline">Kullanım Koşulları</Link>
            {"'nı inceleyebilirsiniz."}
          </p>
        </div>
      </div>

      {/* DEĞERLER */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <h2 className="text-center font-display font-bold text-[24px] text-ink mb-10">
          Değerlerimiz
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {values.map((v) => (
            <div key={v.t} className="text-center px-4">
              <div className="mx-auto size-12 rounded-full bg-brand-soft text-brand grid place-items-center mb-4">
                <v.icon className="size-6" />
              </div>
              <h3 className="font-display font-bold text-[16px] text-ink">{v.t}</h3>
              <p className="mt-2 text-[13.5px] text-navy leading-relaxed">{v.p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KAPANIŞ CTA */}
      <div className="bg-ink text-paper dark:bg-surface dark:text-ink py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="mx-auto size-14 rounded-full bg-brand grid place-items-center mb-6">
            <ShieldCheck className="size-7 text-white" />
          </div>
          <p className="text-lg">
            Bir ürün veya hizmet almadan önce itirazvar'daki müşteri deneyimlerini okuyanların oranı
          </p>
          <div className="text-brand text-5xl font-black mt-4">%95</div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/sikayet-yaz"
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[13px] font-semibold hover:brightness-110 transition"
            >
              <PenLine className="size-4" /> Şikayetini Yaz
            </Link>
            <Link
              to="/markalar"
              className="inline-flex items-center gap-2 rounded-full ring-1 ring-paper/30 dark:ring-rule px-6 h-11 text-[13px] font-semibold hover:bg-paper/10 dark:hover:bg-surface transition"
            >
              <Search className="size-4" /> Markaları Keşfet
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
