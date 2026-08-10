import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/_site/(kurumsal)/iletisim")({
  head: () => ({ meta: [{ title: "İletişim — itirazvar." }, { name: "description", content: "itirazvar. ile iletişime geçin." }] }),
  component: Page,
});

function Page() {
  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-3">İletişim</h1>
        <p className="text-navy-mid mb-10">Bize ulaşmak için aşağıdaki kanalları kullanabilirsiniz.</p>
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { i: Mail, t: "E-posta", v: "iletisim@itirazvar.com" },
            { i: Phone, t: "Telefon", v: "+90 850 000 00 00" },
            { i: MapPin, t: "Adres", v: "Levent, İstanbul" },
          ].map((c) => (
            <div key={c.t} className="bg-card rounded-2xl ring-1 ring-rule p-6">
              <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3"><c.i className="size-5" /></div>
              <div className="text-xs uppercase tracking-widest text-navy-mid">{c.t}</div>
              <div className="mt-1 font-semibold text-ink">{c.v}</div>
            </div>
          ))}
        </div>
        <form className="bg-card rounded-2xl ring-1 ring-rule p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Ad Soyad" className="h-12 px-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
            <input placeholder="E-posta" type="email" className="h-12 px-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
          </div>
          <input placeholder="Konu" className="h-12 w-full px-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
          <textarea placeholder="Mesajınız" rows={6} className="w-full p-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
          <button type="button" className="h-11 px-6 rounded-full bg-brand text-brand-foreground font-semibold hover:brightness-105">Gönder</button>
        </form>
      </div>
    </div>
  );
}
