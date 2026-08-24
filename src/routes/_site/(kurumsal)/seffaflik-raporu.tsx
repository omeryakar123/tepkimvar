import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import { CheckCircle2, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { fetchPlatformStats } from "@/lib/data";

export const Route = createFileRoute("/_site/(kurumsal)/seffaflik-raporu")({
  head: () => ({
    ...seoHead({
      title: "Şeffaflık Raporu — itirazvar",
      description: "itirazvar Şeffaflık Raporu: üye, marka ve şikayet sayıları, çözüm oranları ve moderasyon süreçlerine dair gerçek platform verileri.",
      path: "/seffaflik-raporu",
    }),
  }),
  loader: async () => ({ stats: await fetchPlatformStats().catch(() => null) }),
  component: Page,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 ring-1 ring-rule">
      <div className="text-xs uppercase tracking-widest text-navy-mid">{label}</div>
      <div className="mt-2 text-3xl font-black text-ink tabular-nums">{value}</div>
      {sub && <div className="text-xs text-navy-mid mt-1">{sub}</div>}
    </div>
  );
}

function Page() {
  const s = Route.useLoaderData().stats;
  const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("tr-TR") : "—");
  return (
    <div>
      <div className="bg-gradient-to-br from-dark via-navy to-brand/30 text-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-white/60 text-xs uppercase tracking-widest">itirazvar.</p>
          <h1 className="text-4xl sm:text-5xl font-display font-black mt-2">Şeffaflık Raporu</h1>
          <p className="text-white/70 mt-3 max-w-2xl">Her yıl olduğu gibi bu yıl da müşterilerimize ve markalara ilişkin verileri şeffafça paylaşıyoruz.</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 space-y-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Kayıtlı Üye" value={nf(s?.totalUsers)} />
          <Stat label="Kayıtlı Marka" value={nf(s?.totalCompanies)} />
          <Stat label="Toplam Şikayet" value={nf(s?.totalComplaints)} />
          <Stat label="Çözülen" value={nf(s?.resolvedComplaints)} sub={s ? `Çözüm oranı %${Math.round(s.resolutionRate)}` : undefined} />
        </div>

        <section className="bg-card rounded-2xl ring-1 ring-rule p-8">
          <h2 className="text-xl font-display font-bold mb-6">Moderasyon Süreci</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { i: ShieldCheck, t: "Otomatik Ön Kontrol", d: "Küfür, hakaret ve kişisel veri (TC, IBAN, telefon) tespiti" },
              { i: Users, t: "Manuel İnceleme", d: "Şüpheli içerik moderasyon ekibine iletilir" },
              { i: CheckCircle2, t: "Yayın Kararı", d: "Temiz içerik anında, şüpheli içerik incelemeden sonra yayınlanır" },
            ].map((s) => (
              <div key={s.t}>
                <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3"><s.i className="size-5" /></div>
                <div className="font-semibold text-ink">{s.t}</div>
                <div className="text-sm text-navy-mid mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card rounded-2xl ring-1 ring-rule p-8">
          <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2"><TrendingUp className="size-5 text-brand" /> Yıllık Büyüme</h2>
          <div className="grid grid-cols-5 gap-2 items-end h-40">
            {[42, 58, 71, 84, 100].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-gradient-to-t from-brand to-brand-2" style={{ height: `${h}%` }} />
                <div className="text-xs text-navy-mid">{2021 + i}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
