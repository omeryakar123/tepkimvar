import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";
import { Modal } from "@/components/ui/modal";

type Blog = { id: string; title: string; slug: string; status: string; published_at: string | null; created_at: string };

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlogPage,
});

function AdminBlogPage() {
  const [items, setItems] = useState<Blog[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const data = await apiGet<{ items: Blog[] }>("/api/admin/blogs");
    setItems(data?.items ?? []);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Yazı silinsin mi?")) return;
    if (await apiSend("/api/admin/blogs", "DELETE", { id })) { toast.success("Silindi"); load(); }
  }
  // published_at sunucuda ayarlanır.
  async function togglePublish(b: Blog) {
    const next = b.status === "published" ? "draft" : "published";
    if (await apiSend("/api/admin/blogs", "PATCH", { id: b.id, status: next })) { toast.success(next); load(); }
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-navy-mid">İçerik</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Blog</h1>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:brightness-105">
          <Plus className="size-4" /> Yeni Yazı
        </button>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-semibold">Başlık</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
              <th className="px-4 py-3 font-semibold">Yayın</th>
              <th className="px-4 py-3 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-t border-rule">
                <td className="px-4 py-3 font-medium text-ink">{b.title}</td>
                <td className="px-4 py-3">
                  <span className={`text-[12px] px-2 py-1 rounded-full ${b.status === "published" ? "bg-brand-soft text-brand" : "bg-surface text-navy-mid"}`}>{b.status}</span>
                </td>
                <td className="px-4 py-3 text-navy-mid">{b.published_at ? new Date(b.published_at).toLocaleDateString("tr-TR") : "—"}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => togglePublish(b)} className="text-[12px] text-brand hover:underline">{b.status === "published" ? "Taslak yap" : "Yayınla"}</button>
                  <button onClick={() => remove(b.id)} className="text-[12px] text-danger hover:underline">Sil</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-mid">Henüz yazı yok.</td></tr>}
          </tbody>
        </table>
      </div>

      <BlogCreateModal open={open} onClose={() => { setOpen(false); load(); }} />
    </div>
  );
}

function BlogCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setTitle(""); setExcerpt(""); setContent(""); } }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // author_id GÖNDERİLMEZ — sunucu oturumdan yazar.
    const ok = await apiSend("/api/admin/blogs", "POST", { title, slug, excerpt, body: content });
    setLoading(false);
    if (ok) { toast.success("Oluşturuldu"); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg">
      <form onSubmit={save} className="bg-card rounded-2xl p-6 space-y-4 shadow-lift">
        <h2 className="font-display text-xl font-bold text-ink">Yeni Blog Yazısı</h2>
        <div>
          <label className="text-[12px] font-medium text-navy-mid">Başlık</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
        <div>
          <label className="text-[12px] font-medium text-navy-mid">Özet</label>
          <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm" />
        </div>
        <div>
          <label className="text-[12px] font-medium text-navy-mid">İçerik (Markdown)</label>
          <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-medium hover:bg-surface">İptal</button>
          <button disabled={loading} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-60">Kaydet</button>
        </div>
      </form>
    </Modal>
  );
}
