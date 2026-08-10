import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, X, Check } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/dogrulama")({ component: VerificationsPage });

type Verif = {
  id: string; brand_id: string; submitted_by: string;
  company_name: string; contact_name: string; phone: string; email: string;
  website: string | null; message: string | null; status: string;
  reviewer_note: string | null; created_at: string;
  brands?: { name: string; slug: string } | null;
};

function VerificationsPage() {
  const [items, setItems] = useState<Verif[]>([]);
  const [active, setActive] = useState<Verif | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [docs, setDocs] = useState<{ id: string; doc_type: string; storage_path: string; created_at: string }[]>([]);

  async function load() {
    const data = await apiGet<{ items: Verif[] }>("/api/admin/verification");
    setItems(data?.items ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active) return;
    apiGet<{ documents: typeof docs }>(`/api/admin/verification?brandId=${active.brand_id}`)
      .then((d) => setDocs(d?.documents ?? []));
  }, [active]);

  async function decide(approve: boolean) {
    if (!active) return;
    // reviewer_id + rozet SUNUCUDA ayarlanır.
    if (!(await apiSend("/api/admin/verification", "PATCH", { id: active.id, approve, reviewerNote: reviewerNote || null }))) return;
    toast.success(approve ? "Onaylandı, doğrulama rozeti verildi" : "Reddedildi");
    setActive(null); setReviewerNote(""); load();
  }

  // Belgeler /api/files ucundan servis edilir (yetki orada zorlanır).
  function viewDoc(path: string) {
    window.open(`/api/files/${path}`, "_blank");
  }

  return (
    <div className="px-6 lg:px-10 py-8 grid lg:grid-cols-[420px_1fr] gap-4">
      <aside className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-rule">
          <div className="eyebrow text-navy-mid">Super Admin</div>
          <h2 className="font-display text-xl font-bold text-ink mt-1">Doğrulama Başvuruları</h2>
          <p className="text-[12px] text-navy-mid mt-1">{items.length} kayıt</p>
        </div>
        <ul className="overflow-y-auto divide-y divide-rule">
          {items.map((it) => (
            <li key={it.id}>
              <button onClick={() => setActive(it)} className={`w-full text-left px-4 py-3 hover:bg-surface ${active?.id === it.id ? "bg-info-soft/60" : ""}`}>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-3.5 text-info" />
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${statusTone(it.status)}`}>{it.status}</span>
                </div>
                <div className="mt-1 text-[13.5px] font-semibold text-ink line-clamp-1">{it.company_name}</div>
                <div className="text-[11px] text-navy-mid">{it.contact_name} · {new Date(it.created_at).toLocaleDateString("tr-TR")}</div>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="p-8 text-center text-navy-mid text-[13px]">Başvuru yok.</li>}
        </ul>
      </aside>

      <section className="bg-card rounded-2xl ring-1 ring-rule p-6">
        {active ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-2xl font-black text-ink">{active.company_name}</h1>
              {active.brands && <Link to="/firma/$slug" params={{ slug: active.brands.slug }} className="text-[12px] text-brand inline-flex items-center gap-0.5">Firma sayfası <ExternalLink className="size-3" /></Link>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13.5px]">
              <Field label="Yetkili" value={active.contact_name} />
              <Field label="Telefon" value={active.phone} />
              <Field label="E-posta" value={active.email} />
              <Field label="Website" value={active.website ?? "—"} />
            </div>
            {active.message && <div className="bg-surface rounded-xl p-4 text-[13.5px] whitespace-pre-wrap">{active.message}</div>}

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

            <div className="flex gap-2">
              <button onClick={() => decide(false)} className="flex-1 h-10 rounded-lg ring-1 ring-rule text-sm font-semibold hover:bg-surface inline-flex items-center justify-center gap-2"><X className="size-4" /> Reddet</button>
              <button onClick={() => decide(true)} className="flex-1 h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-110 inline-flex items-center justify-center gap-2"><Check className="size-4" /> Onayla & Rozeti Ver</button>
            </div>
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
