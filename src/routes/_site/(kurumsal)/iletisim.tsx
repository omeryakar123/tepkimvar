import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail } from "lucide-react";
import { seoHead, breadcrumbLd } from "@/lib/seo";
import { SITE_CONTACT_EMAIL, siteContactMailto } from "@/lib/contact";

export const Route = createFileRoute("/_site/(kurumsal)/iletisim")({
  head: () => ({
    ...seoHead({
      title: "İletişim — tepkimvar",
      description:
        "tepkimvar ekibine ulaşın: soru, öneri, iş birliği ve marka başvuruları için info@tepkimvar.com adresine yazın.",
      path: "/iletisim",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "İletişim", path: "/iletisim" },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = `${message}\n\n— ${name || "İsimsiz"}`;
    window.location.href = siteContactMailto(subject || "tepkimvar iletişim", body);
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-3">İletişim</h1>
        <p className="text-navy-mid mb-10">
          Soru, öneri, iş birliği ve marka başvuruları için bize e-posta ile ulaşabilirsiniz.
        </p>
        <a
          href={siteContactMailto()}
          className="inline-flex bg-card rounded-2xl ring-1 ring-rule p-6 hover:ring-brand/40 transition mb-10"
        >
          <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center mr-4 shrink-0">
            <Mail className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-navy-mid">E-posta</div>
            <div className="mt-1 font-semibold text-ink break-all">{SITE_CONTACT_EMAIL}</div>
          </div>
        </a>
        <form onSubmit={submit} className="bg-card rounded-2xl ring-1 ring-rule p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className="h-12 px-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Konu" className="h-12 px-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Mesajınız" rows={6} className="w-full p-4 rounded-lg ring-1 ring-rule focus:outline-none focus:ring-brand/40" />
          <div className="flex items-center gap-4">
            <button className="h-11 px-6 rounded-full bg-brand text-brand-foreground font-semibold hover:brightness-105">
              E-posta ile Gönder
            </button>
            <span className="text-[12px] text-navy-mid">Gönder'e bastığınızda e-posta uygulamanız hazır mesajla açılır.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
