import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, ThumbsUp, Play, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Video = { id: string; slug: string; title: string; description: string | null; cover_url: string | null; video_url: string | null; views: number; likes: number; liked?: boolean };

export const Route = createFileRoute("/_site/video")({
  head: () => ({ meta: [{ title: "Videolar — itirazvar.com" }] }),
  component: VideoPage,
});

function VideoPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);

  async function toggleLike(v: Video) {
    if (!user) { toast.error("Beğenmek için giriş yapın"); return; }
    const res = await fetch("/api/videos/like", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: v.id }),
    });
    if (!res.ok) { toast.error("İşlem başarısız"); return; }
    const d = (await res.json()) as { liked: boolean; likes: number };
    const patch = (x: Video) => (x.id === v.id ? { ...x, liked: d.liked, likes: d.likes } : x);
    setVideos((prev) => prev.map(patch));
    setActive((prev) => (prev && prev.id === v.id ? { ...prev, liked: d.liked, likes: d.likes } : prev));
  }

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Video[]) => { setVideos(data ?? []); setActive(data?.[0] ?? null); })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {active ? (
            <div className="bg-black rounded-2xl overflow-hidden">
              <video key={active.id} controls poster={active.cover_url ?? undefined} className="w-full aspect-video bg-black">
                <source src={active.video_url ?? undefined} />
              </video>
              <div className="p-5 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-display text-2xl font-black tracking-tight">{active.title}</h1>
                  {isAdmin && (
                    <Link to="/admin/videolar" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline shrink-0">
                      <Pencil className="size-3.5" /> Yönet
                    </Link>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-4 text-[12px] text-navy-mid">
                  <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {active.views.toLocaleString("tr-TR")}</span>
                  <button onClick={() => toggleLike(active)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition ${active.liked ? "bg-brand-soft text-brand" : "hover:text-brand"}`}>
                    <ThumbsUp className={`size-3.5 ${active.liked ? "fill-brand" : ""}`} /> {active.likes.toLocaleString("tr-TR")}
                  </button>
                </div>
                {active.description && <p className="mt-3 text-sm text-navy leading-relaxed">{active.description}</p>}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-12 text-center text-navy-mid ring-1 ring-rule">Henüz video yok.</div>
          )}
        </div>
        <aside className="space-y-3">
          <h3 className="font-display font-bold text-[16px] mb-2">Daha fazla video</h3>
          {videos.map((v) => (
            <button key={v.id} onClick={() => setActive(v)} className={`w-full flex gap-3 text-left rounded-2xl p-2 transition ${active?.id === v.id ? "bg-brand-soft" : "bg-card hover:bg-surface"} ring-1 ring-rule`}>
              <div className="relative size-24 shrink-0 rounded-xl overflow-hidden bg-surface">
                {v.cover_url && <img src={v.cover_url} alt="" className="size-full object-cover" />}
                <span className="absolute inset-0 grid place-items-center text-white"><Play className="size-6 drop-shadow" /></span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink line-clamp-2">{v.title}</div>
                <div className="mt-1 text-[11px] text-navy-mid">{v.views.toLocaleString("tr-TR")} izlenme</div>
              </div>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
