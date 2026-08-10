import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export const Route = createFileRoute("/_site/(kurumsal)/yardim")({
  head: () => ({ meta: [{ title: "Yardım — itirazvar." }, { name: "description", content: "Sıkça sorulan sorular ve yardım merkezi." }] }),
  component: Page,
});

const groups = [
  { id: "uyelik", title: "Üyelik", items: [
    { q: "Nasıl üye olurum?", a: "Sağ üstteki 'Giriş / Üye Ol' bağlantısından e-postanızla saniyeler içinde üye olabilirsiniz." },
    { q: "Şifremi unuttum, ne yapmalıyım?", a: "Giriş ekranındaki 'Şifremi Unuttum' bağlantısından e-postanıza 6 haneli kod gönderilir." },
  ]},
  { id: "cozum", title: "Çözüm Aşaması", items: [
    { q: "Şikayetim ne zaman çözülür?", a: "Doğrulanmış markalar ortalama 2 saat içinde ilk yanıtı verir." },
    { q: "Marka cevap vermezse ne olur?", a: "Süper Admin'e escalate ederek incelemeye alabilirsiniz." },
  ]},
  { id: "sikayet", title: "Şikayet Süreci", items: [
    { q: "Şikayetim neden yayınlanmadı?", a: "İçerik moderasyondan geçmediğinde yayınlanmaz — küfür, kişisel veri, spam içerikler reddedilir." },
    { q: "Şikayetimi nasıl silerim?", a: "Profilinizden şikayetinize giderek 'Sil' düğmesini kullanabilirsiniz." },
  ]},
  { id: "markalar", title: "Markalar", items: [
    { q: "Marka nasıl doğrulanır?", o: "Marka profilinden 'Doğrulama Başvurusu' yaparak ticari belgelerinizi yükleyebilirsiniz." },
  ]},
];

function Page() {
  const [open, setOpen] = useState<string | null>("uyelik");
  const [activeGroup, setActiveGroup] = useState("uyelik");
  return (
    <div>
      <div className="bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-navy-mid mb-3">Yardım</p>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-ink mb-6">Size Nasıl Yardımcı Olabiliriz?</h1>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-navy-mid" />
            <input placeholder="Yardım almak istediğiniz konuyu yazın" className="w-full h-14 pl-12 pr-4 rounded-full bg-card ring-1 ring-rule shadow-soft focus:outline-none focus:ring-brand/40" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid md:grid-cols-[220px,1fr] gap-8">
        <aside className="space-y-2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => setActiveGroup(g.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${activeGroup===g.id ? "text-brand font-semibold" : "text-navy-mid hover:text-ink"}`}>
              {activeGroup===g.id && <span className="text-brand mr-2">•</span>}{g.title}
            </button>
          ))}
        </aside>
        <div className="space-y-3">
          {groups.find((g)=>g.id===activeGroup)?.items.map((it) => (
            <details key={it.q} open={open===it.q} onToggle={(e)=>e.currentTarget.open && setOpen(it.q)}
              className="bg-surface rounded-xl px-5 py-4 group">
              <summary className="flex items-center justify-between cursor-pointer list-none text-ink font-medium">
                {it.q}
                <ChevronDown className="size-4 text-navy-mid group-open:rotate-180 transition" />
              </summary>
              <p className="mt-3 text-sm text-navy leading-relaxed">{('a' in it ? it.a : it.o) as string}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
