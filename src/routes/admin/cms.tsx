import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";

type Block = { key: string; content: Record<string, unknown> };

const BLOCKS = [
  { key: "hero", label: "Hero" },
  { key: "slider", label: "Slider" },
  { key: "banner", label: "Banner" },
  { key: "stats", label: "İstatistik" },
  { key: "categories", label: "Kategori" },
  { key: "footer", label: "Footer" },
  { key: "header", label: "Header" },
  { key: "about", label: "Hakkımızda" },
  { key: "contact", label: "İletişim" },
  { key: "faq", label: "SSS" },
];

export const Route = createFileRoute("/admin/cms")({
  component: AdminCmsPage,
});

function AdminCmsPage() {
  const [active, setActive] = useState(BLOCKS[0].key);
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(key: string) {
    const res = await apiGet<{ data: Block["content"] }>(`/api/admin/cms?key=${encodeURIComponent(key)}`);
    setJson(JSON.stringify(res?.data ?? {}, null, 2));
  }
  useEffect(() => { load(active); }, [active]);

  async function save() {
    setLoading(true);
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { setLoading(false); return toast.error("Geçersiz JSON"); }
    const ok = await apiSend("/api/admin/cms", "PUT", { key: active, data: parsed });
    setLoading(false);
    if (ok) toast.success("Kaydedildi");
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">İçerik Yönetimi</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">CMS Blokları</h1>
        <p className="mt-1 text-[14px] text-navy-mid">Sitenin tüm bloklarını kod yazmadan düzenle.</p>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <aside className="bg-card rounded-2xl ring-1 ring-rule p-2 h-fit">
          {BLOCKS.map((b) => (
            <button key={b.key} onClick={() => setActive(b.key)} className={`w-full text-left px-3 py-2 rounded-lg text-[13.5px] ${active === b.key ? "bg-brand-soft text-brand font-semibold" : "text-navy hover:bg-surface"}`}>
              {b.label}
            </button>
          ))}
        </aside>
        <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold text-ink">{BLOCKS.find((b) => b.key === active)?.label}</h2>
            <button onClick={save} disabled={loading} className="rounded-full bg-brand text-brand-foreground px-5 h-9 text-[13px] font-semibold hover:brightness-105 disabled:opacity-60">Kaydet</button>
          </div>
          <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={20} className="w-full font-mono text-[12.5px] rounded-lg ring-1 ring-rule p-3 focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
      </div>
    </div>
  );
}
