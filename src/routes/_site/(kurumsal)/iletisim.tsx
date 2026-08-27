import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { seoHead, breadcrumbLd } from "@/lib/seo";

const CONTACT_EMAIL = "iletisim@tepkimvarplus.com";
const TELEGRAM_URL = "https://t.me/tepkimvarplus";

export const Route = createFileRoute("/_site/(kurumsal)/iletisim")({
  head: () => ({
    ...seoHead({
      title: "İletişim — tepkimvar",
      description:
        "tepkimvar ekibine ulaşın: soru, öneri, iş birliği ve marka başvuruları için e-posta veya Telegram üzerinden iletişime geçin.",
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

  // Form, varsayılan e-posta uygulamasında hazır bir mesaj açar.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = `${message}\n\n— ${name || "İsimsiz"}`;
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject || "tepkimvar iletişim")}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-black mb-3">İletişim</h1>
        <p className="text-navy-mid mb-10">
          Soru, öneri, iş birliği ve marka başvuruları için bize aşağıdaki kanallardan ulaşabilirsiniz.
        </p>
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <a href={`mailto:${CONTACT_EMAIL}`} className="bg-card rounded-2xl ring-1 ring-rule p-6 hover:ring-brand/40 transition">
            <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3">
              <Mail className="size-5" />
            </div>
            <div className="text-xs uppercase tracking-widest text-navy-mid">E-posta</div>
            <div className="mt-1 font-semibold text-ink break-all">{CONTACT_EMAIL}</div>
          </a>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="bg-card rounded-2xl ring-1 ring-rule p-6 hover:ring-brand/40 transition">
            <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3">
              <Send className="size-5" />
            </div>
            <div className="text-xs uppercase tracking-widest text-navy-mid">Telegram</div>
            <div className="mt-1 font-semibold text-ink">@tepkimvarplus</div>
          </a>
        </div>
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
