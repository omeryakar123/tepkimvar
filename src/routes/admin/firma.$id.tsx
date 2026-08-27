import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Video as VideoIcon, ArrowLeft, Crown, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend, uploadFile } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/firma/$id")({ component: AdminBrandEditPage });

type Brand = {
  id: string; name: string; slug: string; about: string | null; website: string | null;
  phone: string | null; email: string | null; address: string | null; city: string | null;
  logo_url: string | null; cover_url: string | null; cover_video: string | null;
  gallery: string[] | null; seo_title: string | null; seo_description: string | null;
  verified: boolean; premium: boolean; is_active: boolean;
  premium_until: string | null;
};

function AdminBrandEditPage() {
  const { id } = useParams({ from: "/admin/firma/$id" });
  const [b, setB] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await apiGet<Brand>(`/api/admin/brands/${id}`);
    if (data) setB(data);
  }
  useEffect(() => { load(); }, [id]);

  /** Tek noktadan güncelleme — sunucu alanları doğrular. */
  async function patch(body: Record<string, unknown>) {
    if (!b) return false;
    return apiSend(`/api/admin/brands/${b.id}`, "PATCH", body);
  }

  async function save() {
    if (!b) return;
    setBusy(true);
    const ok = await patch({
      name: b.name, about: b.about, website: b.website, phone: b.phone, email: b.email,
      address: b.address, city: b.city, seo_title: b.seo_title, seo_description: b.seo_description,
      verified: b.verified, premium: b.premium, is_active: b.is_active,
      premium_until: b.premium_until,
    });
    setBusy(false);
    if (!ok) return;
    toast.success("Kaydedildi");
    load();
  }

  async function uploadImage(file: File, kind: "logo" | "cover") {
    if (!b) return;
    const up = await uploadFile(file, kind === "logo" ? "brand-logos" : "brand-covers");
    if (!up) return;
    const field = kind === "logo" ? "logo_url" : "cover_url";
    if (!(await patch({ [field]: up.url }))) return;
    toast.success(`${kind === "logo" ? "Logo" : "Kapak"} güncellendi`);
    load();
  }

  async function uploadVideo(file: File) {
    if (!b) return;
    const up = await uploadFile(file, "brand-videos");
    if (!up) return;
    if (!(await patch({ cover_video: up.url }))) return;
    toast.success("Video yüklendi");
    load();
  }

  async function removeVideo() {
    if (!b) return;
    if (!(await patch({ cover_video: null }))) return;
    toast.success("Video silindi");
    load();
  }

  async function addGalleryImage(file: File) {
    if (!b) return;
    const up = await uploadFile(file, "brand-gallery");
    if (!up) return;
    const next = [...(b.gallery ?? []), up.url];
    if (!(await patch({ gallery: next }))) return;
    toast.success("Galeriye eklendi");
    load();
  }

  async function removeGalleryItem(url: string) {
    if (!b) return;
    const next = (b.gallery ?? []).filter((u) => u !== url);
    if (!(await patch({ gallery: next }))) return;
    toast.success("Silindi");
    load();
  }

  async function setPremiumDays(days: number) {
    if (!b) return;
    const until = new Date(Date.now() + days * 86400000).toISOString();
    if (!(await patch({ premium: true, premium_until: until }))) return;
    toast.success(`Premium başlatıldı (${days} gün)`);
    load();
  }

  async function cancelPremium() {
    if (!b) return;
    if (!(await patch({ premium: false, premium_until: null }))) return;
    toast.success("Premium iptal edildi");
    load();
  }

  if (!b) return <div className="px-6 lg:px-10 py-8 text-navy-mid">Yükleniyor…</div>;

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6 max-w-5xl">
      <Link to="/admin/firmalar" className="text-[12px] text-navy-mid hover:text-brand inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> Firmalar</Link>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow text-navy-mid">Firma Düzenle</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">{b.name}</h1>
          <p className="text-[12px] text-navy-mid mt-1">/{b.slug}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setB({ ...b, is_active: !b.is_active }); }} className={`h-10 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 ${b.is_active ? "bg-brand text-brand-foreground" : "bg-rule text-ink"}`}>
            {b.is_active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />} {b.is_active ? "Aktif" : "Pasif"}
          </button>
          <button onClick={() => { setB({ ...b, verified: !b.verified }); }} className={`h-10 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 ${b.verified ? "bg-blue-500 text-white" : "ring-1 ring-rule text-ink"}`}>
            <ShieldCheck className="size-4" /> {b.verified ? "Doğrulandı" : "Doğrulanmadı"}
          </button>
          <button onClick={save} disabled={busy} className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold disabled:opacity-60">Kaydet</button>
        </div>
      </div>

      <Section title="Görseller">
        <div className="grid sm:grid-cols-3 gap-3">
          <ImageSlot label="Logo" url={b.logo_url} onUpload={(f) => uploadImage(f, "logo")} icon={ImageIcon} />
          <ImageSlot label="Kapak" url={b.cover_url} onUpload={(f) => uploadImage(f, "cover")} icon={ImageIcon} />
          <div className="rounded-xl ring-1 ring-rule p-3 flex flex-col">
            <div className="text-[11px] uppercase tracking-wider text-navy-mid font-semibold mb-2">Video</div>
            {b.cover_video ? (
              <>
                <video src={b.cover_video} controls className="w-full rounded-lg bg-black aspect-video" />
                <button onClick={removeVideo} className="mt-2 text-[12px] text-danger inline-flex items-center gap-1 hover:underline"><Trash2 className="size-3" /> Sil</button>
              </>
            ) : (
              <label className="flex-1 grid place-items-center rounded-lg border-2 border-dashed border-rule cursor-pointer hover:bg-surface text-navy-mid text-[12px]">
                <div className="text-center"><VideoIcon className="size-5 mx-auto mb-1" />Video yükle</div>
                <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section title="Galeri">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {(b.gallery ?? []).map((g) => (
            <div key={g} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-rule group">
              <img src={g} alt="" className="size-full object-cover" />
              <button onClick={() => removeGalleryItem(g)} className="absolute top-1 right-1 bg-black/60 text-white rounded-md p-1 opacity-0 group-hover:opacity-100"><Trash2 className="size-3" /></button>
            </div>
          ))}
          <label className="aspect-square rounded-lg border-2 border-dashed border-rule grid place-items-center cursor-pointer hover:bg-surface text-navy-mid">
            <Upload className="size-4" />
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && addGalleryImage(e.target.files[0])} />
          </label>
        </div>
      </Section>

      <Section title="İçerik & İletişim">
        <div className="grid sm:grid-cols-2 gap-3">
          <Text label="Firma adı" value={b.name} onChange={(v) => setB({ ...b, name: v })} />
          <Text label="Website" value={b.website ?? ""} onChange={(v) => setB({ ...b, website: v })} />
          <Text label="Telefon" value={b.phone ?? ""} onChange={(v) => setB({ ...b, phone: v })} />
          <Text label="E-posta" value={b.email ?? ""} onChange={(v) => setB({ ...b, email: v })} />
          <Text label="Adres" value={b.address ?? ""} onChange={(v) => setB({ ...b, address: v })} />
        </div>
        <div className="mt-3">
          <label className="text-[12px] font-medium text-navy-mid">Hakkında</label>
          <textarea value={b.about ?? ""} onChange={(e) => setB({ ...b, about: e.target.value })} rows={5} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
      </Section>

      <Section title="SEO">
        <Text label="SEO başlık" value={b.seo_title ?? ""} onChange={(v) => setB({ ...b, seo_title: v })} />
        <div className="mt-3">
          <label className="text-[12px] font-medium text-navy-mid">SEO açıklama</label>
          <textarea value={b.seo_description ?? ""} onChange={(e) => setB({ ...b, seo_description: e.target.value })} rows={3} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
      </Section>

      <Section title="Premium">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold ${b.premium ? "bg-warning-soft text-warning" : "bg-surface text-navy-mid"}`}>
            <Crown className="size-3.5" /> {b.premium ? `Premium ${b.premium_until ? "(" + new Date(b.premium_until).toLocaleDateString("tr-TR") + ")" : ""}` : "Standart"}
          </span>
          <button onClick={() => setPremiumDays(30)} className="h-9 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-semibold">30 gün başlat</button>
          <button onClick={() => setPremiumDays(365)} className="h-9 px-3 rounded-lg bg-amber-600 text-white text-[12px] font-semibold">1 yıl başlat</button>
          {b.premium && <button onClick={cancelPremium} className="h-9 px-3 rounded-lg ring-1 ring-rule text-[12px] font-semibold hover:bg-surface">İptal et</button>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-5">
      <h2 className="font-display text-base font-bold text-ink mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
    </div>
  );
}
function ImageSlot({ label, url, onUpload, icon: Icon }: { label: string; url: string | null; onUpload: (f: File) => void; icon: typeof Upload }) {
  return (
    <div className="rounded-xl ring-1 ring-rule p-3">
      <div className="text-[11px] uppercase tracking-wider text-navy-mid font-semibold mb-2">{label}</div>
      {url ? <img src={url} alt="" className="w-full aspect-video object-cover rounded-lg bg-surface" /> : <div className="aspect-video grid place-items-center rounded-lg bg-surface text-navy-mid"><Icon className="size-5" /></div>}
      <label className="mt-2 inline-flex items-center gap-1 text-[12px] text-brand hover:underline cursor-pointer">
        <Upload className="size-3" /> Yeni yükle
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
    </div>
  );
}
