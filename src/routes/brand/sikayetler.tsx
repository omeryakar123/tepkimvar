import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Send,
  Paperclip,
  AlertTriangle,
  Star,
  User,
  Phone,
  AtSign,
  History,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { EscalateModal } from "@/components/escalate-modal";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/data";
import { dbStatusToUi, statusLabel } from "@/lib/complaint-status";
import type { BrandMembership } from "@/routes/brand";

type Status = "pending" | "approved" | "in_review" | "answered" | "resolved" | "rejected" | "spam" | "user_replied" | "super_admin_review" | "escalated" | "archived";

type Complaint = {
  id: string;
  title: string;
  body: string;
  status: Status;
  created_at: string;
  short_id: string | null;
  public_id: string | null;
  brand_response: string | null;
  rating: number | null;
  platform_username: string | null;
  contact_phone: string | null;
  contact_phone_display: string | null;
  author_name: string | null;
  site_username: string | null;
  is_anonymous: boolean;
  other_complaints_count: number;
};

type OtherComplaint = {
  id: string;
  title: string;
  status: Status;
  created_at: string;
  short_id: string | null;
  public_id: string | null;
  rating: number | null;
};

type Attachment = {
  id: string;
  url: string;
  file_type: string;
  visibility: string;
  created_at: string;
};

type ComplaintDetail = {
  other_complaints: OtherComplaint[];
  attachments: Attachment[];
};

export const Route = createFileRoute("/brand/sikayetler")({
  component: BrandComplaintsPage,
});

function BrandComplaintsPage() {
  const { user } = useAuth();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [items, setItems] = useState<Complaint[]>([]);
  const [active, setActive] = useState<Complaint | null>(null);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [escOpen, setEscOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/brand/memberships", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((j: { memberships?: BrandMembership[] }) => {
        if (!cancelled) setBrandId(j.memberships?.[0]?.brand_id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    const qs = new URLSearchParams({ brandId, page: String(page), pageSize: String(PAGE_SIZE) });
    fetch(`/api/brand/complaints?${qs}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
      .then((j: { items?: Complaint[]; total?: number }) => {
        if (cancelled) return;
        setItems(j.items ?? []);
        setTotal(j.total ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandId, page]);

  useEffect(() => {
    if (!brandId || !active) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    const qs = new URLSearchParams({ brandId, id: active.id });
    fetch(`/api/brand/complaints?${qs}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { other_complaints?: OtherComplaint[]; attachments?: Attachment[] } | null) => {
        if (cancelled) return;
        setDetail({
          other_complaints: j?.other_complaints ?? [],
          attachments: j?.attachments ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId, active?.id]);


  async function setStatus(id: string, s: Status) {
    const res = await fetch("/api/brand/complaints", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: s }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "İşlem başarısız");
      return;
    }
    toast.success("Durum güncellendi");
    setItems((prev) => prev.map((c) => c.id === id ? { ...c, status: s } : c));
    if (active?.id === id) setActive({ ...active, status: s });
  }

  async function sendReply() {
    if (!active || !user || !reply.trim()) return;
    setSending(true);
    const res = await fetch("/api/brand/complaints", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId: active.id, body: reply }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSending(false);
      toast.error(j.error ?? "İşlem başarısız");
      return;
    }
    const { id: replyId } = (await res.json()) as { id: string };

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", file.type.startsWith("image/") ? "complaint-images" : "complaint-files");
      fd.append("complaintId", active.id);
      fd.append("replyId", replyId);
      const up = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      if (!up.ok) {
        const j = await up.json().catch(() => ({}));
        toast.error(j.error ?? "Dosya yüklenemedi");
      }
    }

    setReply(""); setFile(null); setSending(false); toast.success("Yanıt gönderildi");
    setItems((prev) => prev.map((c) => c.id === active.id ? { ...c, status: "answered", brand_response: reply.trim() } : c));
    setActive({ ...active, status: "answered", brand_response: reply.trim() });
  }

  if (!brandId) return <div className="px-6 lg:px-10 py-8 text-navy-mid">Firma bağlantısı bekleniyor…</div>;

  return (
    <div className="px-6 lg:px-10 py-8 grid lg:grid-cols-[360px_1fr] gap-4 min-h-[calc(100vh-2rem)]">
      <aside className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-rule">
          <div className="eyebrow text-navy-mid">Gelen Kutusu</div>
          <h2 className="font-display text-xl font-bold text-ink mt-1">Şikayetler ({total})</h2>
        </div>
        <ul className="overflow-y-auto divide-y divide-rule flex-1">
          {items.map((c) => (
            <li key={c.id}>
              <button onClick={() => setActive(c)} className={`w-full text-left px-4 py-3 hover:bg-surface ${active?.id === c.id ? "bg-brand-soft/40" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${badgeFor(c.status)}`}>{c.status}</span>
                  <span className="text-[11px] text-navy-mid">{new Date(c.created_at).toLocaleDateString("tr-TR")}</span>
                </div>
                <div className="mt-1 text-[14px] font-semibold text-ink line-clamp-2">{c.title}</div>
                {c.author_name ? (
                  <div className="mt-0.5 text-[11px] text-navy-mid truncate">{c.author_name}</div>
                ) : null}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="p-6 text-center text-navy-mid text-[13px]">Henüz şikayet yok.</li>}
        </ul>
        {total > PAGE_SIZE && (
          <div className="p-3 border-t border-rule">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </div>
        )}
      </aside>


      <section className="bg-card rounded-2xl ring-1 ring-rule flex flex-col">
        {active ? (
          <>
            <div className="p-6 border-b border-rule">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to="/sikayet/$id" params={{ id: active.id }} className="text-[12px] text-navy-mid hover:text-brand">Şikayet #{active.short_id ?? active.id.slice(0, 6)}</Link>
                  <h1 className="font-display text-2xl font-black tracking-tight text-ink mt-1">{active.title}</h1>
                </div>
                <select value={active.status} onChange={(e) => setStatus(active.id, e.target.value as Status)} className="h-9 rounded-lg ring-1 ring-rule px-3 text-[13px]">
                  {(["pending", "in_review", "answered", "rejected", "spam"] as Status[]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="mt-4 text-[14px] text-navy leading-relaxed whitespace-pre-wrap">{active.body}</p>
              {active.rating != null && active.rating > 0 ? (
                <div className="mt-4 inline-flex items-center gap-1.5 text-amber-600 text-[13px] font-semibold">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  Şikayet puanı: {active.rating}/5
                </div>
              ) : null}
              {active.brand_response ? (
                <div className="mt-4 rounded-xl bg-brand-soft/50 ring-1 ring-brand/15 p-4">
                  <p className="text-[11px] font-semibold text-brand mb-2">Mevcut firma yanıtınız</p>
                  <p className="text-[14px] text-navy whitespace-pre-wrap">{active.brand_response}</p>
                </div>
              ) : null}

              <div className="mt-6 rounded-xl bg-surface ring-1 ring-rule p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid mb-3">
                  Şikayetçi bilgileri
                </p>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                  <InfoRow
                    icon={<User className="size-3.5" />}
                    label="Ad Soyad"
                    value={active.author_name ?? "—"}
                  />
                  <InfoRow
                    icon={<Phone className="size-3.5" />}
                    label="Telefon"
                    value={active.contact_phone_display ?? active.contact_phone ?? "—"}
                  />
                  <InfoRow
                    icon={<AtSign className="size-3.5" />}
                    label="Site kullanıcı adı"
                    value={
                      active.site_username
                        ? `@${active.site_username}`
                        : active.is_anonymous
                          ? "Anonim"
                          : "—"
                    }
                  />
                  <InfoRow
                    icon={<AtSign className="size-3.5" />}
                    label="Platform kullanıcı adı"
                    value={active.platform_username ? `@${active.platform_username}` : "—"}
                  />
                </dl>
                {active.is_anonymous ? (
                  <p className="mt-3 text-[11px] text-navy-mid">
                    Bu şikayet anonim olarak yayınlanmış; iletişim bilgileri yalnızca firma panelinde görünür.
                  </p>
                ) : null}
              </div>

              {detailLoading ? (
                <div className="mt-4 flex items-center gap-2 text-[13px] text-navy-mid">
                  <Loader2 className="size-4 animate-spin" />
                  Ek bilgiler yükleniyor…
                </div>
              ) : null}

              {detail && detail.attachments.length > 0 ? (
                <div className="mt-4 rounded-xl bg-surface ring-1 ring-rule p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid mb-3">
                    Kanıt dosyaları ({detail.attachments.length})
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {detail.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg ring-1 ring-rule px-3 py-1.5 text-[12px] font-medium text-brand hover:bg-brand-soft/40"
                        >
                          <Paperclip className="size-3.5" />
                          {a.file_type.startsWith("image/") ? "Görsel" : a.file_type.startsWith("video/") ? "Video" : "Dosya"}
                          <ExternalLink className="size-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail && detail.other_complaints.length > 0 ? (
                <div className="mt-4 rounded-xl bg-surface ring-1 ring-rule p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid mb-3 flex items-center gap-1.5">
                    <History className="size-3.5" />
                    Bu kullanıcının diğer şikayetleri ({detail.other_complaints.length})
                  </p>
                  <ul className="divide-y divide-rule">
                    {detail.other_complaints.map((oc) => (
                      <li key={oc.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to="/sikayet/$id"
                              params={{ id: oc.public_id ?? oc.id }}
                              className="text-[13px] font-semibold text-ink hover:text-brand line-clamp-1"
                            >
                              {oc.title}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-navy-mid">
                              <span>{new Date(oc.created_at).toLocaleDateString("tr-TR")}</span>
                              <span>·</span>
                              <span>{statusLabel[dbStatusToUi(oc.status)]}</span>
                              {oc.rating != null && oc.rating > 0 ? (
                                <>
                                  <span>·</span>
                                  <span>{oc.rating}/5</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <Link
                            to="/sikayet/$id"
                            params={{ id: oc.public_id ?? oc.id }}
                            className="shrink-0 text-brand hover:text-brand/80"
                            title="Şikayeti görüntüle"
                          >
                            <ExternalLink className="size-4" />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : detail && !detailLoading && active.other_complaints_count === 0 ? (
                <p className="mt-4 text-[12px] text-navy-mid">
                  Bu kullanıcının firmanıza yönelik başka şikayeti bulunmuyor.
                </p>
              ) : null}
            </div>
            <div className="p-6 flex-1 flex flex-col gap-3">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} placeholder="Yanıtınızı yazın…" className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 text-[13px] text-navy cursor-pointer hover:text-brand">
                  <Paperclip className="size-4" /> {file ? file.name : "Dosya ekle"}
                  <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setEscOpen(true)} className="inline-flex items-center gap-2 rounded-full ring-1 ring-warning/30 text-warning bg-warning-soft px-4 h-10 text-[13px] font-semibold hover:bg-warning-soft">
                    <AlertTriangle className="size-4" /> Super Admin'e İlet
                  </button>
                  <button onClick={sendReply} disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-10 text-[13px] font-semibold hover:brightness-105 disabled:opacity-60">
                    <Send className="size-4" /> Yanıtla
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-navy-mid p-12 text-center">
            <div>
              <MessageSquareIcon />
              <p className="mt-3 text-[14px]">Yanıtlamak için soldan bir şikayet seçin.</p>
            </div>
          </div>
        )}
      </section>
      {active && brandId && (
        <EscalateModal open={escOpen} onClose={() => setEscOpen(false)} complaintId={active.id} brandId={brandId} onDone={() => setStatus(active.id, "escalated")} />
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-navy-mid text-[11px] font-medium mb-0.5">
        {icon}
        {label}
      </dt>
      <dd className="text-ink font-semibold break-all">{value}</dd>
    </div>
  );
}

function MessageSquareIcon() {
  return <div className="mx-auto size-12 rounded-2xl bg-brand-soft text-brand grid place-items-center"><Send className="size-5" /></div>;
}

function badgeFor(s: Status) {
  switch (s) {
    case "resolved": return "bg-brand-soft text-brand";
    case "pending": return "bg-warning-soft text-warning";
    case "answered": return "bg-surface text-ink";
    case "spam": case "rejected": return "bg-danger-soft text-danger";
    default: return "bg-surface text-navy-mid";
  }
}
