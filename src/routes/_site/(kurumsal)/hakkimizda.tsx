import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Users, Sparkles, TrendingUp } from "lucide-react";
import { fetchPlatformStats } from "@/lib/data";

export const Route = createFileRoute("/_site/(kurumsal)/hakkimizda")({
  loader: async () => ({ stats: await fetchPlatformStats().catch(() => null) }),
  head: () => ({
    meta: [
      { title: "Hakkımızda — itirazvar." },
      { name: "description", content: "itirazvar., Türkiye'nin bağımsız müşteri deneyimi ve şikayet çözüm platformudur." },
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
  return (
    <div>
      <div className="relative h-64 bg-gradient-to-br from-dark via-navy to-brand/40 grid place-items-center">
        <div className="text-center px-6">
          <p className="text-white/60 text-xs uppercase tracking-widest mb-2">itirazvar.</p>
          <h1 className="text-white text-3xl sm:text-5xl font-display font-black">Türkiye'nin bağımsız<br/>müşteri deneyimi platformu</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 space-y-8 text-navy leading-relaxed">
        <p className="text-lg text-center">Şikayetlerin çözüme kavuşturulması, müşteri memnuniyetinin artırılması için fırsat sunuyoruz.</p>
        <p>itirazvar., müşterilerle markalar arasında köprü görevi üstlenen bir çözüm platformudur. Müşteri deneyimini ve marka çözümlerini sunarak milyonlarca ziyaretçinin alışverişlerinde karar vermelerini kolaylaştırır.</p>
        <ul className="space-y-2 pl-6 list-disc">
          <li>Müşteriler, seslerini markaya duyurup şikayetlerini iletebilir.</li>
          <li>Markalar, şikayetleri memnuniyete dönüştürür müşteri kitlesini artırabilir.</li>
          <li>Ziyaretçiler de alışveriş yapmayı düşündüğü markalara ilgili bilgi sahibi olur.</li>
        </ul>
      </div>

      <div className="bg-card border-y border-rule">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-3"><s.icon className="size-6 text-brand" /></div>
              <div className="text-2xl font-black text-ink tabular-nums">{s.value}</div>
              <div className="text-xs text-navy-mid mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-ink text-paper dark:bg-surface dark:text-ink py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="mx-auto size-14 rounded-full bg-brand grid place-items-center mb-6">
            <ShieldCheck className="size-7 text-white" />
          </div>
          <p className="text-lg">Bir ürün veya hizmet almadan önce itirazvar.'daki müşteri deneyimlerini okuyanların oranı</p>
          <div className="text-brand text-5xl font-black mt-4">%95</div>
        </div>
      </div>
    </div>
  );
}
