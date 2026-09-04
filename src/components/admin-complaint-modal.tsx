import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { apiGet, apiSend } from "@/lib/admin-api";
import { dbStatusToUi, statusLabel } from "@/lib/complaint-status";

export type AdminComplaintDetail = {
  id: string;
  public_id: string | null;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  user_id: string;
  user_email: string;
  is_anonymous: boolean;
  anon_name: string | null;
  platform_username: string | null;
  contact_phone: string | null;
  contact_phone_display: string | null;
  city: string | null;
  rating: number | null;
  is_public: boolean;
  is_synthetic: boolean;
  hidden: boolean;
  sensitive: boolean;
  admin_notes: string | null;
  brand_response: string | null;
  brand_response_at: string | null;
  tags: string[];
  author: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
  attachments?: {
    id: string;
    url: string;
    file_type: string | null;
    visibility: string;
    sensitive: boolean;
  }[];
};

type Props = {
  complaintId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  /** Moderasyon kuyruğu — onay/red butonları */
  moderationItemId?: string | null;
  onModerationAction?: (action: "approve" | "reject") => Promise<boolean>;
  startEditing?: boolean;
};

const INPUT =
  "w-full rounded-lg ring-1 ring-rule px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand/40";

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AdminComplaintModal({
  complaintId,
  open,
  onClose,
  onUpdated,
  moderationItemId,
  onModerationAction,
  startEditing = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<AdminComplaintDetail | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const data = await apiGet<{ complaint: AdminComplaintDetail }>(`/api/admin/complaints?id=${id}`);
    setLoading(false);
    if (data?.complaint) {
      setDetail(data.complaint);
      setTitle(data.complaint.title);
      setBody(data.complaint.body);
      setAdminNotes(data.complaint.admin_notes ?? "");
      setPlatformUsername(data.complaint.platform_username ?? "");
    }
  }, []);

  useEffect(() => {
    if (!open || !complaintId) {
      setDetail(null);
      setEditing(false);
      return;
    }
    setEditing(startEditing);
    load(complaintId);
  }, [open, complaintId, startEditing, load]);

  async function toggleAttachmentSensitive(id: string, sensitive: boolean) {
    if (!detail) return;
    setSaving(true);
    const ok = await apiSend("/api/admin/complaint-attachments", "PATCH", { id, sensitive });
    setSaving(false);
    if (ok) {
      toast.success(sensitive ? "Görsel hassas olarak işaretlendi" : "Hassas işaret kaldırıldı");
      await load(detail.id);
    }
  }

  async function deleteAttachment(id: string) {
    if (!detail || !confirm("Bu kanıt dosyasını silmek istediğinize emin misiniz?")) return;
    setSaving(true);
    const ok = await apiSend("/api/admin/complaint-attachments", "DELETE", { id });
    setSaving(false);
    if (ok) {
      toast.success("Kanıt silindi");
      await load(detail.id);
    }
  }

  async function save() {
    if (!detail) return;
    setSaving(true);
    const ok = await apiSend("/api/admin/complaints", "PATCH", {
      id: detail.id,
      title,
      body,
      admin_notes: adminNotes || null,
      platform_username: platformUsername || null,
    });
    setSaving(false);
    if (ok) {
      toast.success("Şikayet güncellendi");
      setEditing(false);
      await load(detail.id);
      onUpdated?.();
    }
  }

  async function moderate(action: "approve" | "reject") {
    if (!onModerationAction) return;
    setSaving(true);
    const ok = await onModerationAction(action);
    setSaving(false);
    if (ok) onClose();
  }

  const c = detail;
  const uiStatus = c ? dbStatusToUi(c.status) : null;
  const publicPath = c?.public_id ?? c?.id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      align="top"
      className="max-w-2xl bg-card rounded-2xl ring-1 ring-rule shadow-lift max-h-[90vh] overflow-y-auto"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-navy-mid">
              <Eye className="size-3.5 shrink-0" />
              Şikayet önizleme
            </div>
            {loading ? (
              <div className="mt-3 flex items-center gap-2 text-navy-mid text-sm">
                <Loader2 className="size-4 animate-spin" /> Yükleniyor…
              </div>
            ) : c ? (
              <>
                <div className="text-[12px] text-navy-mid mt-1">{c.brand_name}</div>
                {editing ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`${INPUT} mt-2 font-display font-bold text-lg`}
                    maxLength={200}
                  />
                ) : (
                  <h3 className="font-display text-xl font-bold text-ink mt-0.5">{c.title}</h3>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-navy-mid">Şikayet yüklenemedi.</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-navy-mid hover:text-ink shrink-0">
            <X className="size-5" />
          </button>
        </div>

        {c && !loading && (
          <>
            <div className="flex flex-wrap gap-2 text-[12px]">
              {uiStatus && (
                <Chip>{statusLabel[uiStatus]}</Chip>
              )}
              <Chip>{c.is_public ? "Yayında" : "Yayında değil"}</Chip>
              {c.is_synthetic && <Chip>Bot</Chip>}
              {c.sensitive && <Chip>Hassas</Chip>}
              {c.hidden && <Chip>Gizli</Chip>}
              {c.rating != null && <Chip>{c.rating} ★</Chip>}
            </div>

            <div>
              <div className="text-[12px] font-medium text-navy-mid mb-1.5">Şikayet metni</div>
              {editing ? (
                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className={`${INPUT} resize-y min-h-[160px]`}
                  maxLength={5000}
                />
              ) : (
                <div className="rounded-xl bg-surface p-4 text-[13.5px] text-navy whitespace-pre-line leading-relaxed max-h-[320px] overflow-y-auto">
                  {c.body}
                </div>
              )}
            </div>

            {c.attachments && c.attachments.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-navy-mid mb-2">
                  Kanıt dosyaları ({c.attachments.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {c.attachments.map((a) => {
                    const isVideo = (a.file_type ?? "").startsWith("video/");
                    return (
                      <div key={a.id} className="rounded-xl ring-1 ring-rule overflow-hidden bg-surface">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-black/5">
                          {isVideo ? (
                            <video src={a.url} className="size-full object-cover" muted playsInline />
                          ) : (
                            <img src={a.url} alt="" className="size-full object-cover" loading="lazy" />
                          )}
                        </a>
                        <div className="flex items-center gap-1 p-2 border-t border-rule">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => toggleAttachmentSensitive(a.id, !a.sensitive)}
                            className="flex-1 h-8 rounded-lg text-[11px] font-semibold ring-1 ring-rule hover:bg-card inline-flex items-center justify-center gap-1 disabled:opacity-50"
                            title={a.sensitive ? "Hassas işareti kaldır" : "Hassas bilgiyi gizle"}
                          >
                            {a.sensitive ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                            {a.sensitive ? "Gizli" : "Gizle"}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => deleteAttachment(a.id)}
                            className="h-8 px-2 rounded-lg text-[11px] font-semibold ring-1 ring-rule hover:bg-danger-soft/40 text-danger disabled:opacity-50"
                            title="Sil"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-navy-mid">
                  «Gizle» ile hassas bilgiler yayında bulanık görünür. Onay sonrası kanıtlar herkese açık olur.
                </p>
              </div>
            )}

            {c.brand_response && (
              <div>
                <div className="text-[12px] font-medium text-navy-mid mb-1.5">Marka yanıtı</div>
                <div className="rounded-xl bg-brand-soft/30 ring-1 ring-brand/15 p-4 text-[13px] text-navy whitespace-pre-line">
                  {c.brand_response}
                </div>
                <div className="text-[11px] text-navy-mid mt-1">{fmtDate(c.brand_response_at)}</div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-[12.5px]">
              <Meta label="Yazar">
                {c.is_anonymous
                  ? c.anon_name ?? "Anonim"
                  : c.author?.full_name ?? c.author?.username ?? "—"}
              </Meta>
              {!c.is_anonymous && (
                <Meta label="E-posta">
                  <span className="break-all">{c.user_email}</span>
                </Meta>
              )}
              <Meta label="Platform kullanıcı adı">
                {editing ? (
                  <input
                    value={platformUsername}
                    onChange={(e) => setPlatformUsername(e.target.value)}
                    className={INPUT}
                    maxLength={80}
                  />
                ) : (
                  c.platform_username ?? "—"
                )}
              </Meta>
              <Meta label="Telefon">{c.contact_phone_display ?? "—"}</Meta>
              <Meta label="Şehir">{c.city ?? "—"}</Meta>
              <Meta label="Oluşturma">{fmtDate(c.created_at)}</Meta>
            </div>

            <div>
              <div className="text-[12px] font-medium text-navy-mid mb-1.5">Admin notları</div>
              {editing ? (
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="İç not — kullanıcıya görünmez"
                  className={`${INPUT} resize-y`}
                  maxLength={5000}
                />
              ) : (
                <div className="rounded-xl bg-surface/80 ring-1 ring-rule p-3 text-[13px] text-navy-mid whitespace-pre-line min-h-[48px]">
                  {c.admin_notes || "—"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rule">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="h-9 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <Save className="size-3.5" /> Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setTitle(c.title);
                      setBody(c.body);
                      setAdminNotes(c.admin_notes ?? "");
                      setPlatformUsername(c.platform_username ?? "");
                    }}
                    className="h-9 px-4 rounded-lg ring-1 ring-rule text-[13px] font-semibold hover:bg-surface"
                  >
                    İptal
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="h-9 px-4 rounded-lg ring-1 ring-rule text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-surface"
                >
                  <Pencil className="size-3.5" /> Düzenle
                </button>
              )}

              {publicPath && (
                <Link
                  to="/sikayet/$id"
                  params={{ id: publicPath }}
                  target="_blank"
                  className="h-9 px-4 rounded-lg ring-1 ring-rule text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-surface text-ink"
                >
                  Sayfayı aç <ExternalLink className="size-3.5" />
                </Link>
              )}

              {moderationItemId && onModerationAction && (
                <>
                  <div className="w-full sm:w-auto sm:ml-auto flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => moderate("approve")}
                      disabled={saving}
                      className="h-9 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <CheckCircle2 className="size-3.5" /> Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => moderate("reject")}
                      disabled={saving}
                      className="h-9 px-4 rounded-lg ring-1 ring-rule text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-danger-soft/40 text-danger disabled:opacity-60"
                    >
                      <XCircle className="size-3.5" /> Reddet
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface ring-1 ring-rule px-2.5 h-7 font-medium text-navy">
      {children}
    </span>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-navy-mid">{label}</div>
      <div className="text-ink font-medium mt-0.5">{children}</div>
    </div>
  );
}
