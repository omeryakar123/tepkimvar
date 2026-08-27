import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, KeyRound, MessageSquare, Eye, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/avatar-upload";
import { Messenger } from "@/components/messenger";
import { PhoneInput } from "@/components/phone-input";
import { toE164Tr, fromE164 } from "@/lib/phone";

export const Route = createFileRoute("/_site/profile")({
  head: () => ({ meta: [{ title: "Profilim — tepkimvar" }] }),
  validateSearch: (s: Record<string, unknown>): { sekme?: "mesajlar" } => ({
    sekme: s.sekme === "mesajlar" ? "mesajlar" : undefined,
  }),
  component: ProfilePage,
});

type Profile = {
  id: string; fullName: string | null; username: string | null;
  avatarUrl: string | null; phone: string | null; city: string | null; bio: string | null;
};

type Complaint = { id: string; title: string; status: string; views: number; createdAt: string };

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const { sekme } = Route.useSearch();
  const [tab, setTab] = useState<"info" | "complaints" | "messages" | "security">(sekme === "mesajlar" ? "messages" : "info");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, answered: 0, resolved: 0, views: 0 });
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        const data = (await res.json()) as { profile: Profile | null; email: string; emailVerified: boolean };
        if (data.profile) {
          setProfile(data.profile);
          setPhone(fromE164(data.profile.phone));
        }
        setEmail(data.email ?? "");
        setEmailVerified(!!data.emailVerified);

        const cres = await fetch("/api/me/complaints", { credentials: "include" });
        const cjson = (await cres.json()) as { complaints: Complaint[] };
        const list = cjson.complaints ?? [];
        setComplaints(list);
        setStats({
          total: list.length,
          pending: list.filter((c) => c.status === "pending" || c.status === "in_review").length,
          answered: list.filter((c) => c.status === "answered").length,
          resolved: list.filter((c) => c.status === "resolved").length,
          views: list.reduce((s, c) => s + (c.views ?? 0), 0),
        });
      } catch {
        toast.error("Profil yüklenemedi");
      } finally {
        setLoaded(true);
      }
    })();
  }, [user]);

  async function save() {
    if (!profile) return;
    const e164 = phone ? toE164Tr(phone) : null;
    if (phone && !e164) return toast.error("Telefon geçersiz");
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: profile.fullName, username: profile.username,
        avatarUrl: profile.avatarUrl, phone: e164,
        city: profile.city, bio: profile.bio,
      }),
    });
    setBusy(false);
    if (!res.ok) toast.error("Kaydedilemedi"); else toast.success("Profil güncellendi");
  }

  async function changePassword() {
    if (newPw.length < 6) return toast.error("Şifre en az 6 karakter");
    if (newPw !== newPw2) return toast.error("Şifreler eşleşmiyor");
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: curPw,
      newPassword: newPw,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) toast.error(error.message ?? "Şifre güncellenemedi");
    else { toast.success("Şifre güncellendi"); setCurPw(""); setNewPw(""); setNewPw2(""); }
  }

  if (authLoading || !loaded) {
    return (
      <div>
        <div className="mx-auto max-w-5xl px-4 py-20 text-center text-navy-mid">
          <Loader2 className="mx-auto size-6 animate-spin" /> Yükleniyor…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <div className="mx-auto max-w-5xl px-4 py-20 text-center text-navy-mid">
          Profil bulunamadı.
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* Header card */}
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <AvatarUpload
            url={profile.avatarUrl}
            userId={profile.id}
            onChange={async (newUrl) => {
              setProfile({ ...profile, avatarUrl: newUrl });
              await fetch("/api/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fullName: profile.fullName, username: profile.username,
                  avatarUrl: newUrl, phone: profile.phone,
                  city: profile.city, bio: profile.bio,
                }),
              });
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="eyebrow text-navy-mid">Profilim</div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-black tracking-tight text-ink truncate">
              {profile.fullName || email}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-[12px] text-navy-mid">
              <span>{email}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emailVerified ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning"}`}>
                {emailVerified ? "E-posta doğrulandı" : "E-posta doğrulanmadı"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={MessageSquare} label="Toplam Şikayet" v={stats.total} />
          <Stat icon={Clock} label="Beklemede" v={stats.pending} tone="warn" />
          <Stat icon={MessageSquare} label="Yanıtlandı" v={stats.answered} />
          <Stat icon={CheckCircle2} label="Çözüldü" v={stats.resolved} tone="brand" />
          <Stat icon={Eye} label="Görüntülenme" v={stats.views} />
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-rule">
          {([["info", "Bilgilerim"], ["complaints", "Şikayetlerim"], ["messages", "Mesajlar"], ["security", "Güvenlik"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 h-10 text-[13.5px] font-semibold border-b-2 -mb-px ${tab === k ? "border-brand text-brand" : "border-transparent text-navy-mid hover:text-ink"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="mt-5 bg-card rounded-2xl ring-1 ring-rule p-6 grid sm:grid-cols-2 gap-4">
            <Field label="Ad Soyad" value={profile.fullName ?? ""} onChange={(v) => setProfile({ ...profile, fullName: v })} />
            <Field label="Kullanıcı Adı" value={profile.username ?? ""} onChange={(v) => setProfile({ ...profile, username: v })} />
            <div>
              <label className="text-[12px] font-medium text-navy-mid">Telefon</label>
              <div className="mt-1"><PhoneInput value={phone} onChange={setPhone} /></div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[12px] font-medium text-navy-mid">Hakkımda</label>
              <textarea rows={4} value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <div className="sm:col-span-2">
              <button onClick={save} disabled={busy} className="rounded-full bg-brand text-brand-foreground px-6 h-10 text-[13px] font-semibold hover:brightness-105 disabled:opacity-60 inline-flex items-center gap-2">
                {busy && <Loader2 className="size-4 animate-spin" />} Kaydet
              </button>
            </div>
          </div>
        )}

        {tab === "complaints" && (
          <ComplaintsTab complaints={complaints} />
        )}

        {tab === "messages" && (
          <div className="mt-5"><Messenger /></div>
        )}

        {tab === "security" && (
          <div className="mt-5 bg-card rounded-2xl ring-1 ring-rule p-6 space-y-4 max-w-md">
            <div className="flex items-center gap-2 text-ink font-semibold"><KeyRound className="size-4" /> Şifre değiştir</div>
            <div>
              <label className="text-[12px] font-medium text-navy-mid">Mevcut şifre</label>
              <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
              <p className="mt-1 text-[11px] text-navy-mid">Google ile giriş yaptıysan şifren yoktur; bu alanı kullanamazsın.</p>
            </div>
            <div>
              <label className="text-[12px] font-medium text-navy-mid">Yeni şifre</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-navy-mid">Yeni şifre (tekrar)</label>
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <button onClick={changePassword} disabled={busy} className="rounded-full bg-brand text-brand-foreground px-6 h-10 text-[13px] font-semibold hover:brightness-105 disabled:opacity-60 inline-flex items-center gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />} Şifreyi Güncelle
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-11 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
    </div>
  );
}

function Stat({ icon: Icon, label, v, tone = "ink" }: { icon: typeof MessageSquare; label: string; v: number; tone?: "ink" | "brand" | "warn" }) {
  const map = { ink: "bg-surface text-ink", brand: "bg-brand-soft text-brand", warn: "bg-warning-soft text-warning" } as const;
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-4">
      <div className={`size-8 rounded-lg grid place-items-center ${map[tone]}`}><Icon className="size-4" /></div>
      <div className="mt-2 text-[11px] text-navy-mid font-medium">{label}</div>
      <div className="mt-0.5 font-display text-xl font-black text-ink tabular-nums">{v.toLocaleString("tr-TR")}</div>
    </div>
  );
}

import { Pagination } from "@/components/pagination";
import { PAGE_SIZE } from "@/lib/data";

function ComplaintsTab({ complaints }: { complaints: Complaint[] }) {
  const [page, setPage] = useState(1);
  const start = (page - 1) * PAGE_SIZE;
  const slice = complaints.slice(start, start + PAGE_SIZE);
  return (
    <div className="mt-5 space-y-3">
      <div className="bg-card rounded-2xl ring-1 ring-rule divide-y divide-rule">
        {complaints.length === 0 && (
          <div className="p-10 text-center text-navy-mid text-[14px]">
            Henüz şikayetiniz yok. <Link to="/sikayet-yaz" className="text-brand font-semibold hover:underline">İlk şikayetini yaz</Link>
          </div>
        )}
        {slice.map((c) => (
          <Link key={c.id} to="/sikayet/$id" params={{ id: c.id }} className="flex items-center gap-4 p-4 hover:bg-surface">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${badge(c.status)}`}>{c.status}</span>
                <span className="text-[11px] text-navy-mid">{new Date(c.createdAt).toLocaleDateString("tr-TR")}</span>
              </div>
              <div className="mt-1 font-medium text-ink line-clamp-1">{c.title}</div>
            </div>
            <div className="text-[11px] text-navy-mid flex items-center gap-1"><Eye className="size-3.5" /> {c.views}</div>
          </Link>
        ))}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={complaints.length} onChange={setPage} />
    </div>
  );
}

function badge(s: string) {
  switch (s) {
    case "resolved": return "bg-brand-soft text-brand";
    case "pending": return "bg-warning-soft text-warning";
    case "answered": return "bg-surface text-ink";
    case "in_review": return "bg-info-soft text-info";
    case "spam":
    case "rejected": return "bg-danger-soft text-danger";
    default: return "bg-surface text-navy-mid";
  }
}
