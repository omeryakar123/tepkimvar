import { createFileRoute } from "@tanstack/react-router";

function InfoPage({ title, sections }: { title: string; sections: { h: string; p: string }[] }) {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-8">{title}</h1>
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-ink mb-2">{s.h}</h2>
              <p className="text-navy leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_site/(kurumsal)/kullanim-kosullari")({
  head: () => ({ meta: [{ title: "Kullanım Koşulları — itirazvar." }] }),
  component: () => (
    <InfoPage title="Kullanım Koşulları" sections={[
      { h: "1. Genel", p: "itirazvar. hizmetlerini kullanarak bu koşulları kabul etmiş sayılırsınız." },
      { h: "2. Üyelik", p: "Üyelik gerçek kimlik bilgileri ile yapılır. Sahte hesaplar askıya alınır." },
      { h: "3. İçerik", p: "Küfür, hakaret, iftira ve kişisel veri içeren şikayetler yayınlanmaz." },
      { h: "4. Sorumluluk", p: "Kullanıcı yayımladığı içerikten şahsen sorumludur." },
    ]} />
  ),
});
