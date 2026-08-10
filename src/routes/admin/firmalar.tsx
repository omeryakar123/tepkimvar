import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck, Crown } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { Modal } from "@/components/ui/modal";

type Brand = { id: string; name: string; slug: string; logo_url: string | null; verified: boolean; premium: boolean; created_at: string };
type Category = { id: string; name: string; slug: string };

export const Route = createFileRoute("/admin/firmalar")({
  component: AdminBrandsPage,
});

function AdminBrandsPage() {
  const [items, setItems] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    const data = await apiGet<{ items: Brand[] }>("/api/admin/brands");
    setItems(data?.items ?? []);
  }
  useEffect(() => {
    load();
    apiGet<{ categories: Category[] }>("/api/categories").then((d) => setCats(d?.categories ?? []));
  }, []);

  const filtered = items.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  async function setVerified(id: string, value: boolean) {
    if (await apiSend("/api/admin/brands", "PATCH", { id, verified: value })) { toast.success("Güncellendi"); load(); }
  }
  async function setPremium(id: string, value: boolean) {
    if (await apiSend("/api/admin/brands", "PATCH", { id, premium: value })) { toast.success("Güncellendi"); load(); }
  }
  async function remove(id: string) {
    if (!confirm("Firma silinsin mi?")) return;
    if (await apiSend("/api/admin/brands", "DELETE", { id })) { toast.success("Silindi"); load(); }
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <div className="eyebrow text-navy-mid">Firma Yönetimi</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Firmalar</h1>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:brightness-105">
          <Plus className="size-4" /> Yeni Firma
        </button>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <div className="p-4 border-b border-rule flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma ara..." className="w-full h-10 rounded-lg ring-1 ring-rule pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>
          <div className="text-[12px] text-navy-mid">{filtered.length} kayıt</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Firma</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Doğrulama</th>
                <th className="px-4 py-3 font-semibold">Premium</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-rule hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link to="/firma/$slug" params={{ slug: b.slug }} className="hover:text-brand">{b.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-navy-mid">/{b.slug}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setVerified(b.id, !b.verified)} className={`inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full ${b.verified ? "bg-brand-soft text-brand" : "bg-surface text-navy-mid"}`}>
                      <ShieldCheck className="size-3" />{b.verified ? "Doğrulandı" : "Bekliyor"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setPremium(b.id, !b.premium)} className={`inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full ${b.premium ? "bg-warning-soft text-warning" : "bg-surface text-navy-mid"}`}>
                      <Crown className="size-3" />{b.premium ? "Premium" : "Standart"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-navy-mid">{new Date(b.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link to="/admin/firma/$id" params={{ id: b.id }} className="text-[12px] text-brand hover:underline">Düzenle</Link>
                    <button onClick={() => remove(b.id)} className="text-[12px] text-danger hover:underline">Sil</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-navy-mid">Henüz firma yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BrandCreateModal open={open} cats={cats} onClose={() => { setOpen(false); load(); }} />
    </div>
  );
}

function BrandCreateModal({ open, cats, onClose }: { open: boolean; cats: Category[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [categoryId, setCategoryId] = useState<string>(cats[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setName(""); setSlug(""); setWebsite(""); setCategoryId(cats[0]?.id ?? ""); } /* eslint-disable-next-line */ }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const s = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ok = await apiSend("/api/admin/brands", "POST", { name, slug: s, website: website || null, categoryId: categoryId || null });
    setLoading(false);
    if (ok) { toast.success("Firma oluşturuldu"); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <form onSubmit={save} className="bg-card rounded-2xl p-6 space-y-4 shadow-lift">
        <h2 className="font-display text-xl font-bold text-ink">Yeni Firma</h2>
        <Input label="Firma adı" value={name} onChange={setName} required />
        <Input label="Slug (opsiyonel)" value={slug} onChange={setSlug} placeholder="otomatik" />
        <Input label="Website" value={website} onChange={setWebsite} placeholder="https://" />
        <div>
          <label className="text-[12px] font-medium text-navy-mid">Kategori</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={loading} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-60">Oluştur</button>
        </div>
      </form>
    </Modal>
  );
}

function Input({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
    </div>
  );
}
