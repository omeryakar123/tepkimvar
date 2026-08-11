import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { Modal } from "@/components/ui/modal";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

const DEFAULTS = [
  { name: "E-Ticaret", icon: "ShoppingCart", sortOrder: 1 },
  { name: "Telekomünikasyon", icon: "Phone", sortOrder: 2 },
  { name: "Bankacılık", icon: "Landmark", sortOrder: 3 },
  { name: "Kargo", icon: "Truck", sortOrder: 4 },
  { name: "Market", icon: "Store", sortOrder: 5 },
];

export const Route = createFileRoute("/admin/kategoriler")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoading(true);
    const d = await apiGet<{ items: Category[]; brandCounts: Record<string, number> }>("/api/admin/categories");
    setItems(d?.items ?? []);
    setBrandCounts(d?.brandCounts ?? {});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(c: Category) {
    if (await apiSend("/api/admin/categories", "PATCH", { id: c.id, isActive: !c.is_active })) {
      toast.success(c.is_active ? "Pasife alındı" : "Aktifleştirildi");
      load();
    }
  }

  async function remove(c: Category) {
    const n = brandCounts[c.id] ?? 0;
    const warn = n > 0 ? `\n\nBu kategoriye bağlı ${n} firma "kategorisiz" olacak (silinmez).` : "";
    if (!confirm(`"${c.name}" kategorisini silmek istiyor musun?${warn}`)) return;
    if (await apiSend("/api/admin/categories", "DELETE", { id: c.id })) {
      toast.success("Kategori silindi");
      load();
    }
  }

  async function seedDefaults() {
    setSeeding(true);
    let added = 0;
    for (const d of DEFAULTS) {
      if (items.some((c) => c.name.toLowerCase() === d.name.toLowerCase())) continue;
      if (await apiSend("/api/admin/categories", "POST", d)) added++;
    }
    setSeeding(false);
    toast.success(added ? `${added} kategori eklendi` : "Zaten mevcutlar");
    load();
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-navy-mid">İçerik Yapısı</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Kategoriler</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-brand text-brand-foreground text-[13px] font-semibold hover:brightness-110"
        >
          <Plus className="size-4" /> Yeni Kategori
        </button>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-semibold w-16">Sıra</th>
              <th className="px-4 py-3 font-semibold">Ad</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">İkon</th>
              <th className="px-4 py-3 font-semibold">Firma</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
              <th className="px-4 py-3 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-rule">
                <td className="px-4 py-3 text-navy-mid tabular-nums">{c.sort_order}</td>
                <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-navy-mid">/{c.slug}</td>
                <td className="px-4 py-3 text-navy-mid">{c.icon || "—"}</td>
                <td className="px-4 py-3 text-navy-mid tabular-nums">{brandCounts[c.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-full ${c.is_active ? "bg-brand-soft text-brand" : "bg-surface text-navy-mid"}`}
                  >
                    {c.is_active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {c.is_active ? "Aktif" : "Pasif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                  <button onClick={() => setEditing(c)} className="text-[12px] text-brand hover:underline inline-flex items-center gap-1">
                    <Pencil className="size-3.5" /> Düzenle
                  </button>
                  <button onClick={() => remove(c)} className="text-[12px] text-danger hover:underline inline-flex items-center gap-1">
                    <Trash2 className="size-3.5" /> Sil
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <p className="text-navy-mid">Henüz kategori yok. Firma oluştururken seçim çıkması için en az bir tane ekle.</p>
                  <button
                    onClick={seedDefaults}
                    disabled={seeding}
                    className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full ring-1 ring-rule text-[13px] font-semibold hover:bg-surface disabled:opacity-60"
                  >
                    <Sparkles className="size-4" /> {seeding ? "Ekleniyor…" : "5 varsayılan kategoriyi ekle"}
                  </button>
                </td>
              </tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-navy-mid">Yükleniyor…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CategoryModal
        open={creating || !!editing}
        value={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function CategoryModal({
  open, value, onClose, onSaved,
}: { open: boolean; value: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isEdit, setIsEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  // Açılışta alanları doldur; kapanış animasyonu boyunca içerik ekranda kalsın.
  useEffect(() => {
    if (!open) return;
    setName(value?.name ?? "");
    setSlug(value?.slug ?? "");
    setIcon(value?.icon ?? "");
    setSortOrder(value?.sort_order ?? 0);
    setIsEdit(!!value);
    setBusy(false);
  }, [open, value]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Kategori adı en az 2 karakter");
    setBusy(true);
    const payload = { name: name.trim(), slug: slug.trim() || undefined, icon: icon.trim() || null, sortOrder };
    const ok = value
      ? await apiSend("/api/admin/categories", "PATCH", { id: value.id, ...payload })
      : await apiSend("/api/admin/categories", "POST", payload);
    setBusy(false);
    if (ok) { toast.success(value ? "Güncellendi" : "Kategori oluşturuldu"); onSaved(); }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <form onSubmit={save} className="bg-card rounded-2xl p-6 space-y-4 shadow-lift">
        <h2 className="font-display text-xl font-bold text-ink">{isEdit ? "Kategoriyi Düzenle" : "Yeni Kategori"}</h2>

        <Field label="Kategori adı *">
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </Field>
        <Field label="Slug (boşsa addan üretilir)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="otomatik"
            className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="İkon (lucide adı)">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="ShoppingCart"
              className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </Field>
          <Field label="Sıra">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </Field>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={busy} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-60">
            {value ? "Kaydet" : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      {children}
    </div>
  );
}
