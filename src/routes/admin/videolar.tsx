import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, Eye, ThumbsUp, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend, uploadFile } from "@/lib/admin-api";
import { fetchMe } from "@/lib/me";
import type { AppRole } from "@/hooks/use-auth";
import { Pagination } from "@/components/pagination";
import { Modal } from "@/components/ui/modal";
import { PAGE_SIZE } from "@/lib/data";

type Video = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  video_url: string;
  status: string;
  views: number;
  likes: number;
  created_at: string;
};

export const Route = createFileRoute("/admin/videolar")({
  // UX guard'ı; gerçek yetki kontrolü /api/admin/videos ucunda (requireStaff).
  beforeLoad: async () => {
    const { user, roles } = await fetchMe();
    if (!user) throw redirect({ to: "/admin/login" });
    if (!roles.includes("admin" as AppRole) && !roles.includes("super_admin" as AppRole)) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: AdminVideosPage,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `v-${Date.now()}`;
}

function AdminVideosPage() {
  const [items, setItems] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Video | null>(null);
  const [creating, setCreating] = useState(false);

  async function load(p = page) {
    setLoading(true);
    const data = await apiGet<{ items: Video[]; total: number }>(
      `/api/admin/videos?page=${p}&pageSize=${PAGE_SIZE}`,
    );
    setItems(data?.items ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  async function remove(v: Video) {
    if (!confirm(`"${v.title}" silinsin mi?`)) return;
    if (await apiSend("/api/admin/videos", "DELETE", { id: v.id })) {
      toast.success("Video silindi"); load(page);
    }
  }

  async function togglePublish(v: Video) {
    const next = v.status === "published" ? "draft" : "published";
    if (await apiSend("/api/admin/videos", "PATCH", { id: v.id, status: next })) {
      toast.success(next === "published" ? "Yayınlandı" : "Taslağa alındı"); load(page);
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-navy-mid">İçerik</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Videolar</h1>
          <p className="text-[13px] text-navy-mid mt-1">{total.toLocaleString("tr-TR")} video — yayın durumlarını, kapaklarını ve içeriğini yönetin.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:brightness-105"
        >
          <Plus className="size-4" /> Yeni Video
        </button>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Kapak</th>
                <th className="px-4 py-3 font-semibold">Başlık</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">İstatistik</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-navy-mid">Yükleniyor…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-navy-mid">Henüz video yok.</td></tr>
              )}
              {items.map((v) => (
                <tr key={v.id} className="border-t border-rule hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="size-14 rounded-lg bg-surface overflow-hidden">
                      {v.cover_url && <img src={v.cover_url} alt="" className="size-full object-cover" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink max-w-[300px]">
                    <div className="line-clamp-1">{v.title}</div>
                    <div className="text-[11px] text-navy-mid">/{v.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(v)}
                      className={`text-[11px] uppercase tracking-wider font-bold px-2 py-1 rounded ${v.status === "published" ? "bg-brand-soft text-brand" : "bg-surface text-navy-mid"}`}
                    >
                      {v.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-navy">
                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {v.views.toLocaleString("tr-TR")}</span>
                      <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" /> {v.likes.toLocaleString("tr-TR")}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-navy-mid text-[12px]">{new Date(v.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditing(v)} className="p-2 rounded hover:bg-surface text-navy" title="Düzenle">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => remove(v)} className="p-2 rounded hover:bg-danger-soft text-danger" title="Sil">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-rule">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </div>
      </div>

      <VideoEditor
        open={!!(editing || creating)}
        value={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(page); }}
      />
    </div>
  );
}

function VideoEditor({
  open,
  value,
  onClose,
  onSaved,
}: {
  open: boolean;
  value: Video | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("published");
  const [isEdit, setIsEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<null | "cover" | "video">(null);

  // Açılışta alanları `value`'dan doldur. Kapanış animasyonu boyunca son
  // içerik ekranda kalsın diye sıfırlamayı yalnızca açılışta yapıyoruz.
  useEffect(() => {
    if (!open) return;
    setTitle(value?.title ?? ""); setSlug(value?.slug ?? ""); setDescription(value?.description ?? "");
    setCoverUrl(value?.cover_url ?? ""); setVideoUrl(value?.video_url ?? ""); setStatus(value?.status ?? "published");
    setIsEdit(!!value); setBusy(false); setUploadKind(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onCover(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Sadece görsel yükleyin");
    if (file.size > 8 * 1024 * 1024) return toast.error("Maks. 8 MB");
    setUploadKind("cover");
    const up = await uploadFile(file, "banner-images");
    setUploadKind(null);
    if (up) { setCoverUrl(up.url); toast.success("Kapak yüklendi"); }
  }
  async function onVideo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Sadece video yükleyin");
    if (file.size > 100 * 1024 * 1024) return toast.error("Maks. 100 MB");
    setUploadKind("video");
    const up = await uploadFile(file, "brand-videos");
    setUploadKind(null);
    if (up) { setVideoUrl(up.url); toast.success("Video yüklendi"); }
  }

  // author_id GÖNDERİLMEZ — sunucu oturumdan yazar.
  async function save() {
    if (!title.trim()) return toast.error("Başlık zorunlu");
    if (!videoUrl.trim()) return toast.error("Video URL veya yükleme zorunlu");
    const finalSlug = (slug.trim() || slugify(title));
    const payload = {
      title: title.trim(), slug: finalSlug, description: description || null,
      cover_url: coverUrl || null, video_url: videoUrl, status,
    };
    setBusy(true);
    const ok = value
      ? await apiSend("/api/admin/videos", "PATCH", { id: value.id, ...payload })
      : await apiSend("/api/admin/videos", "POST", payload);
    setBusy(false);
    if (!ok) return;
    toast.success(value ? "Güncellendi" : "Video oluşturuldu");
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="bg-card rounded-2xl ring-1 ring-rule w-full max-h-[90vh] overflow-y-auto shadow-lift">
        <div className="p-5 border-b border-rule flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{isEdit ? "Videoyu Düzenle" : "Yeni Video"}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-surface"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Başlık">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => !slug && setSlug(slugify(title))}
              className="w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </Field>
          <Field label="URL (slug)">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="otomatik oluşturulur"
              className="w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </Field>
          <Field label="Açıklama">
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </Field>

          <Field label="Kapak Görseli">
            <div className="flex items-center gap-3">
              <div className="size-20 rounded-lg bg-surface overflow-hidden flex-shrink-0">
                {coverUrl && <img src={coverUrl} alt="" className="size-full object-cover" />}
              </div>
              <div className="flex-1 space-y-2">
                <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..."
                  className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm" />
                <button onClick={() => coverRef.current?.click()} disabled={uploadKind === "cover"}
                  className="inline-flex items-center gap-2 text-[12px] text-brand font-semibold hover:underline">
                  {uploadKind === "cover" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  Görsel yükle
                </button>
                <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => onCover(e.target.files?.[0])} />
              </div>
            </div>
          </Field>

          <Field label="Video">
            <div className="space-y-2">
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://... veya yükle"
                className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm" />
              <button onClick={() => videoRef.current?.click()} disabled={uploadKind === "video"}
                className="inline-flex items-center gap-2 text-[12px] text-brand font-semibold hover:underline">
                {uploadKind === "video" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Video yükle (maks 100 MB)
              </button>
              <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => onVideo(e.target.files?.[0])} />
            </div>
          </Field>

          <Field label="Durum">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm bg-card">
              <option value="published">Yayında</option>
              <option value="draft">Taslak</option>
              <option value="archived">Arşiv</option>
            </select>
          </Field>
        </div>
        <div className="p-5 border-t border-rule flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-full ring-1 ring-rule text-[13px] font-semibold hover:bg-surface">İptal</button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand text-brand-foreground text-[13px] font-semibold hover:brightness-105 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
