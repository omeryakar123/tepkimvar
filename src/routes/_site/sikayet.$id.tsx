import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Calendar, MessageSquare, Pin, Share2, Tag, Star, Copy, Sparkles, AlertOctagon, Clock } from "lucide-react";
import { ReportButton } from "@/components/report-button";
import { ComplaintCard } from "@/components/cards";
import { ComplaintTimeline } from "@/components/complaint-timeline";
import { ResolutionTunnel } from "@/components/resolution-tunnel";
import { ComplaintRating } from "@/components/complaint-rating";
import { ComplaintSupportButton } from "@/components/complaint-support-button";
import { statusClasses, statusLabel, type Complaint } from "@/lib/mock-data";
import { fetchComplaintById, fetchComplaintsList, fetchComments, fetchComplaintResolution, formatAgo, type DbComment, type ResolutionRow } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { seoHead, jsonLd, breadcrumbLd, clamp, absUrl } from "@/lib/seo";
import { toast } from "sonner";

type ThreadReply = { id: string; body: string; is_brand: boolean; author: string; created_at: string };

export const Route = createFileRoute("/_site/sikayet/$id")({
  // SSR: içerik sunucuda yüklenir, böylece arama motorları gerçek şikayeti görür.
  loader: async ({ params }) => {
    const complaint = await fetchComplaintById(params.id).catch(() => null);
    return { complaint };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.complaint;
    if (!c) {
      return {
        ...seoHead({
          title: "Şikayet bulunamadı — tepkimvar",
          description: "Aradığınız şikayet yayında değil veya kaldırılmış olabilir.",
          path: `/sikayet/${params.id}`,
          noindex: true,
        }),
      };
    }
    const code = c.publicId ?? params.id;
    const title = `${c.title} — ${c.companyName} şikayeti | tepkimvar`;
    const description = clamp(c.body, 155);
    const path = `/sikayet/${code}`;

    return {
      ...seoHead({ title, description, path, type: "article" }),
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: c.title,
          articleBody: clamp(c.body, 500),
          url: absUrl(path),
          inLanguage: "tr-TR",
          author: { "@type": "Person", name: c.userName },
          about: { "@type": "Organization", name: c.companyName },
          interactionStatistic: [
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/ViewAction",
              userInteractionCount: c.views,
            },
          ],
        }),
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Şikayetler", path: "/sikayetler" },
          { name: c.companyName, path: `/firma/${c.companySlug}` },
        ]),
      ],
    };
  },
  component: ComplaintPage,
});


function ComplaintPage() {
  const { id } = Route.useParams();
  const { complaint: initialComplaint } = Route.useLoaderData();
  const { user, roles } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(initialComplaint);
  const [similar, setSimilar] = useState<Complaint[]>([]);
  const [comments, setComments] = useState<DbComment[]>([]);
  const [resolution, setResolution] = useState<ResolutionRow | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  async function loadReplies(cid: string) {
    const r = await fetch(`/api/complaint-replies?complaintId=${cid}`).then((x) => (x.ok ? x.json() : []));
    setReplies(r as ThreadReply[]);
  }

  async function load() {
    const c = await fetchComplaintById(id);
    setComplaint(c);
    if (c) {
      setSimilar((await fetchComplaintsList({ brandSlug: c.companySlug, limit: 4 })).filter((x) => x.id !== c.id).slice(0, 3));
      setComments(await fetchComments(c.id));
      setResolution(await fetchComplaintResolution(c.id));
      loadReplies(c.id);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);


  // Canlı güncelleme (SSE). Sunucu yalnızca "değişiklik oldu" sinyali yollar;
  // veriyi normal API'den çekeriz, böylece yetki kuralları tek yerde kalır.
  useEffect(() => {
    if (!complaint?.id) return;
    const es = new EventSource(`/api/events/${complaint.id}`);
    const onComment = () => { fetchComments(complaint.id).then(setComments).catch(() => {}); };
    const onComplaint = () => { load(); };
    es.addEventListener("comment", onComment);
    es.addEventListener("vote", onComment);
    es.addEventListener("complaint-support", onComplaint);
    es.addEventListener("complaint", onComplaint);
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaint?.id]);

  // Topluluk yorumları şikayetten saatler/günler sonra kademeli gelir — ara sıra yenile.
  useEffect(() => {
    if (!complaint?.id) return;
    const t = setInterval(() => {
      fetchComments(complaint.id).then(setComments).catch(() => {});
    }, 15 * 60_000);
    return () => clearInterval(t);
  }, [complaint?.id]);

  async function sendReply() {
    if (!replyBody.trim() || !complaint) return;
    const ok = await postJson("/api/complaint-replies", { complaintId: complaint.id, body: replyBody.trim() });
    if (ok) { setReplyBody(""); loadReplies(complaint.id); }
  }

  async function postJson(url: string, payload: unknown): Promise<boolean> {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "İşlem başarısız");
      return false;
    }
    return true;
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Yorum için giriş yapın"); return; }
    if (!body.trim()) return;
    const ok = await postJson("/api/comments", { complaintId: id, body: body.trim(), parentId: replyTo });
    if (ok) {
      setBody(""); setReplyTo(null);
      setComments(await fetchComments(id));
    }
  }

  async function vote(commentId: string, value: 1 | -1) {
    if (!user) { toast.error("Oy için giriş yapın"); return; }
    const ok = await postJson("/api/comments/vote", { commentId, vote: value });
    if (ok) setComments(await fetchComments(id));
  }

  async function togglePin(commentId: string, pinned: boolean) {
    const ok = await postJson("/api/comments/pin", { commentId, pinned: !pinned });
    if (ok) setComments(await fetchComments(id));
  }

  if (!complaint) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-navy-mid">Yükleniyor…</div>;
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => comments.filter((c) => c.parent_id === pid);
  const realCommentCount = comments.filter((c) => !c.is_preview).length;

  return (
    <div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-24">
        <div className="flex items-center gap-2 text-xs text-navy-mid mb-4">
          <Link to="/" className="hover:text-brand">Ana Sayfa</Link><span>/</span>
          <Link to="/firma/$slug" params={{ slug: complaint.companySlug }} className="hover:text-brand">{complaint.companyName}</Link>
          <span>/</span>
          {complaint.publicId ? (
            <button onClick={() => { navigator.clipboard.writeText(complaint.publicId!); toast.success("ID kopyalandı"); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand font-mono font-semibold hover:bg-brand/20">
              <Copy className="size-3" /> {complaint.publicId}
            </button>
          ) : (
            <span className="text-navy-mid truncate">#{complaint.id.slice(0, 6)}</span>
          )}
          {complaint.isHighPriority && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-danger-soft text-danger text-[10px] font-bold uppercase ring-1 ring-danger-soft">
              <AlertOctagon className="size-3" /> Yüksek Öncelik
            </span>
          )}
          {typeof complaint.firstResponseMinutes === "number" && complaint.firstResponseMinutes <= 120 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-soft text-warning text-[10px] font-bold uppercase ring-1 ring-warning/30">
              <Sparkles className="size-3" /> Işık Hızında
            </span>
          )}
          {typeof complaint.firstResponseMinutes === "number" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-navy-mid"><Clock className="size-3" /> {complaint.firstResponseMinutes} dk tepki</span>
          )}
        </div>


        <article className="bg-card rounded-2xl ring-1 ring-rule p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-surface flex items-center justify-center text-sm font-bold text-navy-mid">{complaint.userInitials}</span>
              <div>
                <p className="text-sm font-medium">{complaint.userName}</p>
                <p className="text-xs text-navy-mid flex items-center gap-1"><Calendar className="size-3" /> {complaint.createdAgo}</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ring-1 ring-inset ${statusClasses(complaint.status)}`}>{statusLabel[complaint.status]}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-4 text-balance">{complaint.title}</h1>

          {(complaint.platformUsername || complaint.contactPhoneDisplay) && (
            <div className="mb-5 rounded-xl bg-surface ring-1 ring-rule px-4 py-3 text-[13px] text-navy">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-mid mb-2">İletişim bilgileri</p>
              {complaint.platformUsername ? (
                <p><span className="text-navy-mid">Platform kullanıcı adı:</span> <b className="text-ink">{complaint.platformUsername}</b></p>
              ) : null}
              {complaint.contactPhoneDisplay ? (
                <p className={complaint.platformUsername ? "mt-1" : ""}>
                  <span className="text-navy-mid">Telefon:</span> <b className="text-ink font-mono">{complaint.contactPhoneDisplay}</b>
                  <span className="ml-2 text-[11px] text-navy-mid">(diğer kullanıcılar yıldızlı görür)</span>
                </p>
              ) : null}
            </div>
          )}

          {complaint.rating ? (
            <div className="mb-5 inline-flex items-center gap-1.5 text-sm text-navy">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`size-4 ${n <= (complaint.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-navy-mid"}`}
                />
              ))}
              <span className="ml-1 text-xs text-navy-mid">Şikayet sahibinin değerlendirmesi</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Link to="/firma/$slug" params={{ slug: complaint.companySlug }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-surface text-navy rounded-md font-medium hover:bg-rule">
              <Tag className="size-3" /> {complaint.companyName}
            </Link>
            <Link to="/kategori/$slug" params={{ slug: complaint.category }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-surface text-navy rounded-md font-medium hover:bg-rule">
              {complaint.categoryName}
            </Link>
          </div>

          <div className="prose prose-sm max-w-none text-navy leading-relaxed whitespace-pre-line">{complaint.body}</div>

          <div className="mt-6 pt-6 border-t border-rule flex flex-wrap items-center gap-3 text-sm">
            {complaint && (
              <ComplaintSupportButton
                complaintId={complaint.id}
                initialVotes={complaint.votes}
                initialSupported={complaint.supported}
                onChange={(votes, supported) =>
                  setComplaint((prev) => (prev ? { ...prev, votes, supported } : prev))
                }
              />
            )}
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-rule hover:bg-surface text-navy"><MessageSquare className="size-4" /> {realCommentCount || comments.length} yorum</button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Bağlantı kopyalandı"); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-rule hover:bg-surface text-navy"><Share2 className="size-4" /> Paylaş</button>
            <div className="ml-auto"><ReportButton targetType="complaint" targetId={id} /></div>
          </div>
        </article>

        {/* Yazışma thread'i: marka yanıtları + şikayet sahibinin takip cevapları */}
        {(replies.length > 0 || complaint.companyReply) && (
          <div className="mt-6 space-y-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-navy-mid">Yazışma</h3>
            {replies.length === 0 && complaint.companyReply ? (
              <ThreadBubble isBrand author={complaint.companyName} agoLabel={complaint.companyReply.agoLabel} body={complaint.companyReply.body} />
            ) : (
              replies.map((r) => (
                <ThreadBubble
                  key={r.id}
                  isBrand={r.is_brand}
                  author={r.author}
                  agoLabel={new Date(r.created_at).toLocaleDateString("tr-TR")}
                  body={r.body}
                />
              ))
            )}
          </div>
        )}

        {/* Şikayet sahibi takip cevabı (sunucu sahiplik doğrular) */}
        {user && (
          <div className="mt-4 bg-card rounded-2xl ring-1 ring-rule p-4">
            <label className="text-[12px] font-medium text-navy-mid">Şikayet sahibiyseniz cevap yazabilirsiniz</label>
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={3} placeholder="Sürecin son durumunu ekleyin…" className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            <div className="mt-2 flex justify-end">
              <button onClick={sendReply} disabled={!replyBody.trim()} className="rounded-full bg-brand text-brand-foreground px-5 h-9 text-[13px] font-semibold disabled:opacity-50">Cevap Gönder</button>
            </div>
          </div>
        )}

        {/* Şikayet sahibinin memnuniyet oyu — marka ortalamasını besler.
            Kutu yalnızca sahibine görünür (karar sunucuda verilir). */}
        <ComplaintRating complaintId={complaint.id} onChange={() => load()} />

        {/* Resolution stories / mark resolved */}
        {resolution ? (
          <div className="mt-6 bg-gradient-to-br from-success-soft to-white rounded-2xl ring-1 ring-success/30 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Star className="size-4 text-amber-500 fill-amber-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-success">Çözüm Hikayesi · {resolution.resolution_rating}/5</span>
            </div>
            <p className="text-sm text-navy italic">"{resolution.thanks_message ?? "Teşekkür ederim."}"</p>
          </div>
        ) : user && complaint.status !== "cozuldu" && (
          <div className="mt-6 flex items-center justify-between bg-card rounded-2xl ring-1 ring-rule p-5">
            <div>
              <p className="text-sm font-semibold text-ink">Sorunun çözüldü mü?</p>
              <p className="text-xs text-navy-mid">Markayı puanla ve teşekkür mesajını paylaş.</p>
            </div>
            <button onClick={() => setResolveOpen(true)} className="rounded-full bg-emerald-600 text-white px-4 h-9 text-[13px] font-semibold hover:brightness-110">Çözüldü olarak işaretle</button>
          </div>
        )}

        {/* Timeline */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Zaman Tüneli</h2>
          <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
            <ComplaintTimeline complaintId={complaint.id} />
          </div>
        </section>

        <ResolutionTunnel
          open={resolveOpen}
          onClose={() => setResolveOpen(false)}
          complaintId={complaint.id}
          brandName={complaint.companyName}
          onDone={() => load()}
        />


        {/* Comments */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Yorumlar ({comments.length})</h2>

          <form onSubmit={sendComment} className="bg-card rounded-2xl ring-1 ring-rule p-4 mb-4">
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={user ? (replyTo ? "Yanıtınızı yazın…" : "Yorumunuzu yazın…") : "Yorum yapmak için giriş yapın"}
              disabled={!user}
              className="w-full min-h-[80px] text-sm bg-transparent focus:outline-none resize-y" />
            <div className="mt-2 flex items-center justify-between">
              {replyTo ? <button type="button" onClick={() => setReplyTo(null)} className="text-[12px] text-navy-mid hover:text-ink">Yanıtı iptal et</button> : <span />}
              <button disabled={!user || !body.trim()} className="ml-auto rounded-full bg-brand text-brand-foreground px-4 h-9 text-[13px] font-semibold disabled:opacity-50 hover:brightness-105">Gönder</button>
            </div>
          </form>

          {topLevel.length === 0 && (
            <div className="bg-card rounded-2xl ring-1 ring-rule p-8 text-center text-sm text-navy-mid">
              Henüz yorum yok. İlk yorumu siz yapın.
            </div>
          )}

          <div className="space-y-3">
            {topLevel.map((c) => (
              <CommentNode key={c.id} c={c} replies={childrenOf(c.id)} onReply={setReplyTo} onVote={vote} onPin={isAdmin ? togglePin : undefined} />
            ))}
          </div>
        </section>

        {similar.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight mb-4">Benzer Şikayetler</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {similar.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function ThreadBubble({ isBrand, author, agoLabel, body }: { isBrand: boolean; author: string; agoLabel: string; body: string }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${isBrand ? "bg-card ring-brand/20" : "bg-surface ring-rule"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isBrand ? "bg-brand text-brand-foreground" : "bg-ink text-paper"}`}>
          {isBrand ? "Firma" : "Kullanıcı"}
        </span>
        <span className="text-sm font-medium text-ink">{author}</span>
        <span className="text-xs text-navy-mid">· {agoLabel}</span>
      </div>
      <p className="text-sm text-navy leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

function CommentNode({ c, replies, onReply, onVote, onPin }: {
  c: DbComment; replies: DbComment[];
  onReply: (id: string) => void;
  onVote: (id: string, v: 1 | -1) => void;
  onPin?: (id: string, pinned: boolean) => void;
}) {
  const name = c.profiles?.full_name ?? c.profiles?.username ?? "Kullanıcı";
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`bg-card rounded-2xl ring-1 ring-rule p-4 ${c.pinned ? "ring-brand/40 bg-brand-soft/20" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-full bg-surface grid place-items-center text-xs font-bold text-navy-mid">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[12px] text-navy-mid mb-1">
            <span className="font-semibold text-ink">{name}</span>
            <span>·</span>
            <span>{formatAgo(c.created_at)}</span>
            {c.pinned && <span className="inline-flex items-center gap-1 text-brand"><Pin className="size-3" /> Sabit</span>}
          </div>
          <p className="text-sm text-ink whitespace-pre-line">{c.body}</p>
          {!c.is_preview && (
            <div className="mt-2 flex items-center gap-3 text-[12px] text-navy-mid">
              <button onClick={() => onVote(c.id, 1)} className="inline-flex items-center gap-1 hover:text-brand"><ArrowUp className="size-3.5" /> {c.upvotes}</button>
              <button onClick={() => onVote(c.id, -1)} className="inline-flex items-center gap-1 hover:text-danger"><ArrowDown className="size-3.5" /> {c.downvotes}</button>
              <button onClick={() => onReply(c.id)} className="hover:text-ink">Yanıtla</button>
              {onPin && <button onClick={() => onPin(c.id, c.pinned)} className="hover:text-brand">{c.pinned ? "Sabiti kaldır" : "Sabitle"}</button>}
            </div>
          )}
          {replies.length > 0 && (
            <div className="mt-3 space-y-2 pl-4 border-l-2 border-rule">
              {replies.map((r) => (
                <div key={r.id} className="bg-surface/60 rounded-xl p-3">
                  <div className="text-[12px] text-navy-mid mb-1 flex items-center gap-2">
                    <span className="font-semibold text-ink">{r.profiles?.full_name ?? r.profiles?.username ?? "Kullanıcı"}</span>
                    <span>·</span>
                    <span>{formatAgo(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink">{r.body}</p>
                  <div className="mt-1 flex items-center gap-3 text-[12px] text-navy-mid">
                    <button onClick={() => onVote(r.id, 1)} className="inline-flex items-center gap-1 hover:text-brand"><ArrowUp className="size-3" /> {r.upvotes}</button>
                    <button onClick={() => onVote(r.id, -1)} className="inline-flex items-center gap-1 hover:text-danger"><ArrowDown className="size-3" /> {r.downvotes}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Unused star icon import guard
void Star;
