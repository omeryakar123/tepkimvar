import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PhoneInput } from "@/components/phone-input";
import { toE164Tr } from "@/lib/phone";
import { looksLikeFakePlatformUsername } from "@/lib/platform-username";
import { FileDropzone, hasRequiredVisualEvidence, type AcceptedFile } from "@/components/file-dropzone";
import { Combobox } from "@/components/combobox";
import { seoHead } from "@/lib/seo";
import { ComplaintShareModal } from "@/components/complaint-share-modal";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };

export const Route = createFileRoute("/_site/sikayet-yaz")({
  head: () => ({
    ...seoHead({
      title: "Şikayet Yaz — Sesini Duyur | tepkimvar",
      description: "Yaşadığınız sorunu birkaç dakikada yazın, markadan resmi yanıt alın. Çözüm sürecini adım adım takip edin.",
      path: "/sikayet-yaz",
    }),
  }),
  component: WriteComplaintPage,
});

function WriteComplaintPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      toast.info("Şikayet yazmak için giriş yapın");
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");
  const [rating, setRating] = useState(0);
  const [phone, setPhone] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [files, setFiles] = useState<AcceptedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [mediaPrivacy, setMediaPrivacy] = useState<"public" | "brand_only" | "super_admin_only">("public");

  useEffect(() => {
    (async () => {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/brands?limit=500"),
        fetch("/api/categories"),
      ]);
      const bJson = (await bRes.json()) as { items: { id: string; name: string }[] };
      const cJson = (await cRes.json()) as { categories: { id: string; name: string }[] };
      const bs = (bJson.items ?? [])
        .map((b) => ({ id: b.id, name: b.name }))
        .sort((x, y) => x.name.localeCompare(y.name, "tr"));
      setBrands(bs);
      const cs = cJson.categories ?? [];
      setCats(cs);
      if (cs[0]) setCategoryId(cs[0].id);
    })().catch(() => toast.error("Firma/kategori listesi yüklenemedi"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!brandId) return toast.error("Lütfen bir firma seçin.");
    if (!platformUsername.trim() || platformUsername.trim().length < 2)
      return toast.error("Platform kullanıcı adınızı girin.");
    if (looksLikeFakePlatformUsername(platformUsername))
      return toast.error("Lütfen bahis/casino sitesindeki gerçek kullanıcı adınızı yazın.");
    if (rating < 1) return toast.error("Lütfen 1–5 yıldız puan verin.");
    if (title.trim().length < 6) return toast.error("Başlık en az 6 karakter olmalı.");
    if (body.trim().length < 20) return toast.error("Şikayet detayı en az 20 karakter olmalı.");
    if (!kvkk) return toast.error("KVKK onayı zorunludur.");
    if (files.length === 0) return toast.error("En az bir kanıt dosyası (ekran görüntüsü veya video) zorunludur.");
    if (!hasRequiredVisualEvidence(files))
      return toast.error("En az bir ekran görüntüsü veya video yüklemelisiniz. Yalnızca PDF yeterli değildir.");
    const e164 = toE164Tr(phone);
    if (!e164) return toast.error("Geçerli bir cep telefonu numarası zorunludur.");

    setSubmitting(true);
    try {
      const attachmentIds: string[] = [];
      const uploadedFiles = [...files];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const af = uploadedFiles[i];
        af.progress = 15;
        af.error = undefined;
        setFiles([...uploadedFiles]);

        const fd = new FormData();
        fd.append("file", af.file);
        fd.append("folder", "complaint-evidence");
        fd.append("visibility", mediaPrivacy);

        const upRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
        const upJson = (await upRes.json().catch(() => ({}))) as {
          attachmentId?: string;
          error?: string;
        };

        if (!upRes.ok || !upJson.attachmentId) {
          af.error = upJson.error ?? "yüklenemedi";
          af.progress = 0;
          setFiles([...uploadedFiles]);
          throw new Error(`${af.file.name}: ${af.error}`);
        }

        af.attachmentId = upJson.attachmentId;
        attachmentIds.push(upJson.attachmentId);
        af.progress = 100;
        setFiles([...uploadedFiles]);
      }

      const res = await fetch("/api/complaints", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          brandId,
          categoryId: categoryId || null,
          contactPhone: e164,
          platformUsername: platformUsername.trim(),
          rating,
          attachmentIds,
        }),
      });
      const json = (await res.json()) as {
        id?: string;
        publicId?: string;
        status?: string;
        issues?: string[];
        error?: string;
      };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Şikayet oluşturulamadı.");
      setCreatedId(json.id);
      setCreatedSlug(json.publicId ?? json.id);
      setCreatedTitle(title.trim());
      setIssues(json.issues ?? []);
      setShareOpen(true);
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Şikayet oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {createdSlug && (
        <ComplaintShareModal
          open={shareOpen}
          complaintId={createdSlug}
          title={createdTitle}
          onClose={() => setShareOpen(false)}
          onView={() => navigate({ to: "/sikayet/$id", params: { id: createdSlug } })}
        />
      )}

      {issues.length > 0 && shareOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md">
          <ul className="space-y-2">
            {issues.map((m) => (
              <li key={m} className="rounded-lg bg-warning-soft text-warning px-3 py-2 text-[13px] shadow-lg ring-1 ring-warning/20">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="eyebrow text-navy-mid">Yeni Şikayet</div>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight text-ink">
          Sesini duyur, çözümü takip et.
        </h1>
        <p className="mt-2 text-[14.5px] text-navy max-w-xl">
          Şikayetiniz yalnızca <b className="text-ink">ekran görüntüsü veya video kanıtı</b> ile birlikte
          moderasyona alınır. Kanıtsız başvurular sistem tarafından kabul edilmez.
        </p>

        {!authLoading && !user && (
          <div className="mt-6 rounded-2xl bg-brand-soft text-brand p-4 text-[13.5px]">
            Şikayet göndermek için{" "}
            <Link to="/login" className="font-semibold underline">
              giriş yap
            </Link>{" "}
            veya{" "}
            <Link to="/register" className="font-semibold underline">
              üye ol
            </Link>
            .
          </div>
        )}

        <form onSubmit={submit} className="mt-8 bg-card rounded-2xl ring-1 ring-rule p-6 space-y-5">
          <div className="rounded-xl bg-brand-soft/60 ring-1 ring-brand/15 p-4 text-[13px] text-navy leading-relaxed">
            <p className="font-semibold text-ink">Kanıt zorunluluğu</p>
            <ul className="mt-2 space-y-1.5 list-disc pl-4">
              <li>
                <b>Ekran görüntüsü veya video</b> yüklemeniz zorunludur (sohbet, işlem geçmişi, hata ekranı vb.).
              </li>
              <li>Platform kullanıcı adınız ve cep telefonunuz eksiksiz olmalıdır.</li>
              <li>Telefon numaranız yalnızca admin ve ilgili firma tarafından görülür.</li>
            </ul>
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">Firma</label>
            <div className="mt-1">
              <Combobox
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
                value={brandId}
                onChange={setBrandId}
                placeholder="Şikayet ettiğiniz firmayı seçin"
                searchPlaceholder="Firma ara…"
                emptyText="Firma bulunamadı."
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">Kategori</label>
            <div className="mt-1">
              <Combobox
                options={cats.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Kategori seçin"
                searchPlaceholder="Kategori ara…"
                emptyText="Kategori bulunamadı."
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">
              Platform kullanıcı adınız <span className="text-danger">*</span>
            </label>
            <input
              required
              value={platformUsername}
              onChange={(e) => setPlatformUsername(e.target.value)}
              placeholder="Bahis/casino sitesindeki kullanıcı adınız"
              className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">
              Puanınız <span className="text-danger">*</span>
            </label>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 rounded hover:bg-surface transition"
                  aria-label={`${n} yıldız`}
                >
                  <Star
                    className={`size-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-navy-mid/40"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">Başlık</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kısa ve net bir başlık"
              className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">Şikayet Detayı</label>
            <textarea
              required
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Yaşadıklarınızı detaylıca anlatın…"
              className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">
              Telefon <span className="text-danger">*</span>
              <span className="text-navy-mid font-normal"> (sadece admin ve firma görür)</span>
            </label>
            <div className="mt-1">
              <PhoneInput value={phone} onChange={setPhone} required />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-navy-mid">
              Kanıt dosyaları <span className="text-danger">*</span>
            </label>
            <p className="mt-1 text-[12px] text-navy-mid leading-relaxed">
              Sorunu kanıtlayan ekran görüntüsü veya video ekleyin. PDF yalnızca ek belge olarak kullanılabilir.
            </p>
            <div className="mt-2">
              <FileDropzone files={files} onChange={setFiles} disabled={submitting} required />
            </div>
            {files.length > 0 && (
              <div className="mt-3">
                <div className="text-[12px] font-medium text-navy-mid mb-1.5">Medya gizliliği</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "public", label: "Herkese açık" },
                    { v: "brand_only", label: "Sadece firma" },
                    { v: "super_admin_only", label: "Sadece Super Admin" },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.v}
                      onClick={() => setMediaPrivacy(o.v as never)}
                      className={`h-9 rounded-lg text-[12px] font-medium ring-1 ${mediaPrivacy === o.v ? "bg-brand text-brand-foreground ring-brand" : "ring-rule hover:bg-surface"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-rule">
            <label className="flex items-start gap-3 text-[13px] text-navy cursor-pointer">
              <input
                type="checkbox"
                required
                checked={kvkk}
                onChange={(e) => setKvkk(e.target.checked)}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                KVKK kapsamında{" "}
                <Link to="/kvkk" className="text-brand underline">
                  aydınlatma metnini
                </Link>{" "}
                okudum, kişisel verilerimin işlenmesini onaylıyorum.
              </span>
            </label>
          </div>

          <button
            disabled={submitting || !user || !hasRequiredVisualEvidence(files)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-11 text-[14px] font-semibold hover:brightness-105 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />} Şikayeti Gönder
          </button>
          {!hasRequiredVisualEvidence(files) && files.length > 0 && (
            <p className="text-[12px] text-warning">Göndermek için en az bir görsel veya video ekleyin.</p>
          )}
        </form>
      </main>
    </div>
  );
}
