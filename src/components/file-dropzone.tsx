import { useRef, useState, type DragEvent } from "react";
import { Upload, X, FileText, Image as ImageIcon, Film } from "lucide-react";

export type AcceptedFile = {
  file: File;
  preview?: string;
  progress: number; // 0-100
};

const IMG = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const VID = ["video/mp4", "video/webm", "video/quicktime"];
const DOC = ["application/pdf"];

export const ACCEPTED_MIME = [...IMG, ...VID, ...DOC];
export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_FILES = 6;

export function validateFile(f: File): string | null {
  if (!ACCEPTED_MIME.includes(f.type)) return `${f.name}: desteklenmeyen tür`;
  if (f.size > MAX_BYTES) return `${f.name}: 25MB sınırını aşıyor`;
  return null;
}

export function FileDropzone({
  files, onChange, disabled, max = MAX_FILES,
}: { files: AcceptedFile[]; onChange: (next: AcceptedFile[]) => void; disabled?: boolean; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const next: AcceptedFile[] = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= max) { setErr(`Maksimum ${max} dosya`); break; }
      const v = validateFile(f);
      if (v) { setErr(v); continue; }
      next.push({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined, progress: 0 });
    }
    onChange(next);
  }

  function remove(i: number) {
    const cp = files.slice();
    cp.splice(i, 1);
    onChange(cp);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDrag(false);
    if (disabled) return;
    add(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        onClick={() => !disabled && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
          drag ? "border-brand bg-brand-soft/40" : "border-rule hover:border-brand/40 hover:bg-surface"
        } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      >
        <Upload className="mx-auto size-6 text-brand" />
        <div className="mt-2 text-[13.5px] font-medium text-ink">Dosyaları sürükle bırak veya tıkla</div>
        <div className="text-[12px] text-navy-mid mt-0.5">Görsel, video, PDF • max {max} dosya • her biri 25MB'a kadar</div>
        <input ref={ref} type="file" multiple hidden accept={ACCEPTED_MIME.join(",")} onChange={(e) => add(e.target.files)} />
      </div>
      {err && <div className="mt-2 text-[12px] text-danger">{err}</div>}

      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((af, i) => (
            <li key={i} className="relative rounded-lg ring-1 ring-rule bg-card overflow-hidden">
              <button type="button" onClick={() => remove(i)} className="absolute top-1 right-1 z-10 size-6 grid place-items-center rounded-full bg-card/90 ring-1 ring-rule hover:bg-card">
                <X className="size-3.5" />
              </button>
              {af.preview ? (
                <img src={af.preview} alt="" className="h-24 w-full object-cover" />
              ) : (
                <div className="h-24 grid place-items-center text-navy-mid">
                  {af.file.type.startsWith("video/") ? <Film className="size-6" /> : af.file.type === "application/pdf" ? <FileText className="size-6" /> : <ImageIcon className="size-6" />}
                </div>
              )}
              <div className="p-2">
                <div className="text-[11px] font-medium text-ink truncate">{af.file.name}</div>
                <div className="text-[10px] text-navy-mid">{(af.file.size / 1024 / 1024).toFixed(2)} MB</div>
                {af.progress > 0 && af.progress < 100 && (
                  <div className="mt-1 h-1 bg-surface rounded">
                    <div className="h-1 bg-brand rounded transition-all" style={{ width: `${af.progress}%` }} />
                  </div>
                )}
                {af.progress === 100 && <div className="mt-1 text-[10px] text-brand font-semibold">Yüklendi</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
