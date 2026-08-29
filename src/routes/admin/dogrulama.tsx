import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, X, Check, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSendJson } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/dogrulama")({ component: VerificationsPage });

type Verif = {
  id: string; brand_id: string; submitted_by: string;
  company_name: string; contact_name: string; phone: string; email: string;
  website: string | null; message: string | null; status: string;
  telegram: string | null; address: string | null; photo_url: string | null;
  request_type: string; reviewer_note: string | null; created_at: string;
  brands?: { name: string; slug: string } | null;
};

type BrandRow = { id: string; name: string; slug: string };

type Credentials = { email: string; password: string };

function VerificationsPage() {
  const [items, setItems] = useState<Verif[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [active, setActive] = useState<Verif | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [docs, setDocs] = useState<{ id: string; doc_type: string; storage_path: string; created_at: string }[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [assignBrandId, setAssignBrandId] = useState("");
  const [createNewBrand, setCreateNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandSlug, setNewBrandSlug] = useState("");
  const [newBrandWebsite, setNewBrandWebsite] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [filter, setFilter] = useState<"all" | "brand_application" | "verification">("all");

  async function load() {
    const [v, b] = await Promise.all([
      apiGet<{ items: Verif[] }>("/api/admin/verification"),
      apiGet<{ items: BrandRow[] }>("/api/admin/brands"),
    ]);
    setItems(v?.items ?? []);
    setBrands(b?.items ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active) return;
    setAssignBrandId(active.brand_id);
    setCreateNewBrand(false);
    setNewBrandName(active.company_name);
    setNewBrandSlug("");
    setNewBrandWebsite(active.website ?? "");
    setReviewerNote("");
    apiGet<{ documents: typeof docs }>(`/api/admin/verification?brandId=${active.brand_id}`)
      .then((d) => setDocs(d?.documents ?? []));
  }, [active]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.request_type === filter);
  }, [items, filter]);

  const brandOptions = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands.slice(0, 50);
    return brands.filter((b) => b.name.toLowerCase().includes(q) || b.slug.includes(q)).slice(0, 50);
  }, [brands, brandSearch]);

  async function decide(approve: boolean) {
    if (!active) return;
    const body: Record<string, unknown> = {
      id: active.id,
      approve,
      reviewerNote: reviewerNote || null,
    };
    if (approve && active.request_type === "brand_application") {
      if (createNewBrand) {
        if (!newBrandName.trim()) return toast.error("Yeni marka adı girin");
        body.createBrand = {
          name: newBrandName.trim(),
          slug: newBrandSlug.trim() || null,
          website: newBrandWebsite.trim() || null,
        };
      } else if (assignBrandId) {
        body.assignBrandId = assignBrandId;
      }
    }

    const res = await apiSendJson<{ ok: boolean; credentials?: Credentials | null }>(
      "/api/admin/verification",
      "PATCH",
      body,
    );
    if (!res) return;

    if (approve && res.credentials) {
      setCredentials(res.credentials);
      toast.success("Onaylandı — giriş bilgileri oluşturuldu");
    } else {
      toast.success(approve ? "Onaylandı" : "Reddedildi");
      setActive(null);
    }
    load();
  }

  function viewDoc(path: string) {
    window.open(`/api/files/${path}`, "_blank");
  }

  function copyCredentials() {
    if (!credentials) return;
    const text = `E-posta: ${credentials.email}\nŞifre: ${credentials.password}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Panoya kopyalandı"));
  }

  return (
    <div className="px-6 lg:px-10 py-8 grid lg:grid-cols-[420px_1fr] gap-4">
      <aside className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-rule">
          <div className="eyebrow text-navy-mid">Super Admin</div>
          <h2 className="font-display text-xl font-bold text-ink mt-1">Marka Başvuruları</h2>
          <p className="text-[12px] text-navy-mid mt-1">{filtered.length} kayıt</p>
          <div className="flex gap-1 mt-3">
            {(["all", "brand_application", "verification"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                  filter === f ? "bg-brand text-brand-foreground" : "bg-surface text-navy-mid"
                }`}
              >
                {f === "all" ? "Tümü" : f === "brand_application" ? "Başvuru" : "Doğrulama"}
              </button>
            ))}
          </div>
        </div>
        <ul className="overflow-y-auto divide-y divide-rule">
          {filtered.map((it) => (
            <li key={it.id}>
              <button onClick={() => setActive(it)} className={`w-full text-left px-4 py-3 hover:bg-surface ${active?.id === it.id ? "bg-info-soft/60" : ""}`}>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-3.5 text-info" />
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${statusTone(it.status)}`}>{it.status}</span>
                  {it.request_type === "brand_application" && (
                    <span className="text-[9px] bg-brand-soft text-brand px-1.5 py-0.5 rounded font-bold">BAŞVURU</span>
                  )}
                </div>
                <div className="mt-1 text-[13.5px] font-semibold text-ink line-clamp-1">{it.company_name}</div>
                <div className="text-[11px] text-navy-mid">{it.contact_name} · {new Date(it.created_at).toLocaleDateString("tr-TR")}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="p-8 text-center text-navy-mid text-[13px]">Başvuru yok.</li>}
        </ul>
      </aside>

      <section className="bg-card rounded-2xl ring-1 ring-rule p-6">
        {credentials ? (
          <div className="space-y-4 max-w-md mx-auto py-8">
            <h2 className="font-display text-xl font-bold text-ink">Portal Giriş Bilgileri</h2>
            <p className="text-[13px] text-navy-mid">Bu bilgileri marka yetkilisine iletin. Şifre bir daha gösterilmeyecek.</p>
            <div className="bg-surface rounded-xl p-4 font-mono text-[13px] space-y-2">
              <div><span className="text-navy-mid">E-posta:</span> {credentials.email}</div>
              <div><span className="text-navy-mid">Şifre:</span> {credentials.password}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={copyCredentials} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Copy className="size-4" /> Kopyala
              </button>
              <button onClick={() => { setCredentials(null); setActive(null); }} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-semibold hover:bg-surface">
                Kapat
              </button>
            </div>
          </div>
        ) : active ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-2xl font-black text-ink">{active.company_name}</h1>
              {active.brands && (
                <Link to="/firma/$slug" params={{ slug: active.brands.slug }} className="text-[12px] text-brand inline-flex items-center gap-0.5">
                  Firma sayfası <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13.5px]">
              <Field label="Yetkili" value={active.contact_name} />
              <Field label="Telefon" value={active.phone} />
              <Field label="E-posta" value={active.email} />
              <Field label="Website" value={active.website ?? "—"} />
              {active.telegram && <Field label="Telegram" value={`@${active.telegram.replace(/^@/, "")}`} />}
              {active.address && <div className="col-span-2"><Field label="Adres" value={active.address} /></div>}
            </div>
            {active.photo_url && (
              <div>
                <h3 className="font-display text-sm font-bold text-ink mb-2">Başvuru Fotoğrafı</h3>
                <a href={active.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                  <img src={active.photo_url} alt="Başvuru fotoğrafı" className="max-h-48 rounded-xl ring-1 ring-rule object-cover" />
                </a>
              </div>
            )}
            {active.message && <div className="bg-surface rounded-xl p-4 text-[13.5px] whitespace-pre-wrap">{active.message}</div>}

            {active.request_type === "brand_application" && active.status === "pending" && (
              <div className="border border-rule rounded-xl p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-ink">Marka Ataması</h3>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={createNewBrand} onChange={(e) => setCreateNewBrand(e.target.checked)} />
                  Listede yok — yeni marka oluştur
                </label>
                {createNewBrand ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Marka adı" className="col-span-2 rounded-lg ring-1 ring-rule px-3 h-10 text-sm" />
                    <input value={newBrandSlug} onChange={(e) => setNewBrandSlug(e.target.value)} placeholder="Slug (opsiyonel)" className="rounded-lg ring-1 ring-rule px-3 h-10 text-sm" />
                    <input value={newBrandWebsite} onChange={(e) => setNewBrandWebsite(e.target.value)} placeholder="Website" className="rounded-lg ring-1 ring-rule px-3 h-10 text-sm" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
                      <input
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        placeholder="Marka ara…"
                        className="w-full rounded-lg ring-1 ring-rule pl-10 pr-3 h-10 text-sm"
                      />
                    </div>
                    <select
                      value={assignBrandId}
                      onChange={(e) => setAssignBrandId(e.target.value)}
                      className="w-full rounded-lg ring-1 ring-rule px-3 h-10 text-sm bg-card"
                    >
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} (/{b.slug})</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}

            <div>
              <h3 className="font-display text-sm font-bold text-ink mb-2">Yüklenen Belgeler ({docs.length})</h3>
              {docs.length === 0 ? <p className="text-[13px] text-navy-mid">Bu firma henüz belge yüklememiş.</p> : (
                <ul className="space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-[13px]">
                      <span><b>{d.doc_type}</b> · {new Date(d.created_at).toLocaleDateString("tr-TR")}</span>
                      <button onClick={() => viewDoc(d.storage_path)} className="text-brand hover:underline inline-flex items-center gap-0.5">Görüntüle <ExternalLink className="size-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-[12px] font-medium text-navy-mid">İnceleme notu</label>
              <textarea value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>

            {active.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => decide(false)} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-semibold hover:bg-surface inline-flex items-center justify-center gap-2">
                  <X className="size-4" /> Reddet
                </button>
                <button onClick={() => decide(true)} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-110 inline-flex items-center justify-center gap-2">
                  <Check className="size-4" />
                  {active.request_type === "brand_application" ? "Onayla & Giriş Ver" : "Onayla & Rozeti Ver"}
                </button>
              </div>
            )}
            {active.status !== "pending" && (
              <p className="text-[13px] text-navy-mid">Bu başvuru zaten {active.status === "approved" ? "onaylanmış" : "reddedilmiş"}.</p>
            )}
          </div>
        ) : (
          <div className="h-full grid place-items-center text-navy-mid">Soldan bir başvuru seçin.</div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-navy-mid font-semibold">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

function statusTone(s: string) {
  if (s === "approved") return "text-brand";
  if (s === "rejected") return "text-danger";
  if (s === "reviewing") return "text-warning";
  return "text-navy-mid";
}
