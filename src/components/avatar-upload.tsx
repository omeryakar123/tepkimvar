import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { proxyImage } from "@/lib/img";
import { toast } from "sonner";

export function AvatarUpload({
  url, userId, bucket = "avatars", onChange, size = 96, label = "Avatar",
}: {
  url: string | null;
  userId: string;
  bucket?: string;
  onChange: (newUrl: string | null) => void;
  size?: number;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    // Nihai tür/boyut doğrulaması sunucuda; bu sadece hızlı geri bildirim.
    if (!file.type.startsWith("image/")) return toast.error("Sadece görsel yükleyin");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", bucket);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Yükleme başarısız");
      onChange(json.url);
      toast.success(`${label} güncellendi`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükleme başarısız");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="size-full rounded-full ring-2 ring-white shadow-soft overflow-hidden bg-brand-soft grid place-items-center">
          {url ? <img src={proxyImage(url) ?? url} alt="" className="size-full object-cover" /> : <Camera className="size-6 text-brand" />}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 size-8 rounded-full bg-brand text-brand-foreground grid place-items-center shadow-soft hover:brightness-110 disabled:opacity-60"
          aria-label="Yükle"
        >
          <Camera className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-[12px] text-brand hover:underline">Değiştir</button>
          {url && (
            <button type="button" onClick={() => onChange(null)} disabled={busy} className="text-[12px] text-danger hover:underline inline-flex items-center gap-1">
              <Trash2 className="size-3" /> Sil
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
