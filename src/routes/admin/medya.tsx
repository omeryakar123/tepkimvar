import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend, uploadFile } from "@/lib/admin-api";

type Item = { name: string; id: string | null; updated_at: string | null; metadata: { size?: number; mimetype?: string } | null };

export const Route = createFileRoute("/admin/medya")({
  component: AdminMediaPage,
});

// Eski "cms-media" bucket'ının MinIO karşılığı (tek bucket içinde prefix).
const FOLDER = "banner-images";

function AdminMediaPage() {
  const [items, setItems] = useState<Item[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await apiGet<{ items: Item[] }>(`/api/admin/media?folder=${FOLDER}`);
    setItems(data?.items ?? []);
  }
  useEffect(() => { load(); }, []);

  async function upload(files: FileList | null) {
    if (!files) return;
    let ok = false;
    for (const file of Array.from(files)) {
      if (await uploadFile(file, FOLDER)) ok = true;
    }
    if (ok) toast.success("Yüklendi");
    load();
  }

  async function remove(name: string) {
    if (!confirm("Dosya silinsin mi?")) return;
    if (await apiSend("/api/admin/media", "DELETE", { key: name })) { toast.success("Silindi"); load(); }
  }

  function urlOf(name: string) {
    return `/api/files/${name}`;
  }

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-navy-mid">Medya Kütüphanesi</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Medya</h1>
        </div>
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:brightness-105">
          <Upload className="size-4" /> Yükle
        </button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {items.map((it) => {
          const url = urlOf(it.name);
          const isImg = (it.metadata?.mimetype ?? "").startsWith("image/");
          return (
            <div key={it.name} className="group bg-card rounded-2xl ring-1 ring-rule overflow-hidden">
              <div className="aspect-square bg-surface grid place-items-center overflow-hidden">
                {isImg ? <img src={url} alt={it.name} className="size-full object-cover" /> : <div className="text-[11px] text-navy-mid p-3 break-all">{it.name}</div>}
              </div>
              <div className="p-2 flex items-center gap-1">
                <a href={url} target="_blank" rel="noreferrer" className="flex-1 text-[11px] text-navy hover:text-brand truncate">{it.name}</a>
                <button onClick={() => remove(it.name)} className="text-danger hover:bg-danger-soft rounded p-1"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="col-span-full text-center text-navy-mid py-10">Henüz medya yok.</div>}
      </div>
    </div>
  );
}
