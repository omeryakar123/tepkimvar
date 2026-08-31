import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { seoHead, jsonLd, breadcrumbLd, clamp, absUrl } from "@/lib/seo";
import { fetchBlogPost } from "@/lib/blog";

export const Route = createFileRoute("/_site/blog/$slug")({
  loader: async ({ params }) => {
    const post = await fetchBlogPost(params.slug).catch(() => null);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    const path = `/blog/${params.slug}`;
    if (!p) {
      return seoHead({
        title: "Yazı bulunamadı — tepkimvar",
        description: "Aradığınız yazı yayında değil.",
        path,
        noindex: true,
      });
    }
    const title = p.seo_title || `${p.title} | tepkimvar Blog`;
    const description = clamp(p.seo_description || p.excerpt || p.body, 155);
    return {
      ...seoHead({
        title,
        description,
        path,
        type: "article",
        image: p.cover_url,
        publishedTime: p.published_at,
      }),
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.title,
          description,
          url: absUrl(path),
          datePublished: p.published_at,
          inLanguage: "tr-TR",
          ...(p.cover_url ? { image: p.cover_url } : {}),
          publisher: { "@type": "Organization", name: "tepkimvar" },
        }),
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: p.title, path },
        ]),
      ],
    };
  },
  component: BlogPostPage,
});

function renderBlogBlock(block: string, index: number) {
  const trimmed = block.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("## ")) {
    return (
      <h2 key={index} className="font-display text-xl sm:text-2xl font-bold text-ink mt-8 mb-3">
        {trimmed.slice(3)}
      </h2>
    );
  }
  if (trimmed.startsWith("# ")) {
    return (
      <h2 key={index} className="font-display text-2xl font-bold text-ink mt-8 mb-3">
        {trimmed.slice(2)}
      </h2>
    );
  }
  return (
    <p key={index} className="whitespace-pre-line text-[15.5px] leading-[1.75] text-navy">
      {trimmed}
    </p>
  );
}

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-navy-mid hover:text-brand transition-colors"
      >
        <ArrowLeft className="size-4" /> Blog
      </Link>

      <header className="mt-6 rounded-2xl bg-gradient-to-br from-brand-soft/40 via-card to-card ring-1 ring-rule p-6 sm:p-8">
        {post.category && (
          <span className="inline-flex rounded-full bg-brand-soft text-brand px-2.5 py-1 text-[11px] font-semibold">
            {post.category}
          </span>
        )}
        <h1 className="mt-3 font-display text-3xl sm:text-[2.35rem] font-black tracking-tight text-ink leading-tight">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-3 text-[15px] text-navy leading-relaxed">{post.excerpt}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-1.5 text-[13px] text-navy-mid">
          <CalendarDays className="size-4" />
          {new Date(post.published_at).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </header>

      {post.cover_url && (
        <img
          src={post.cover_url}
          alt=""
          className="mt-8 w-full rounded-2xl aspect-[16/9] object-cover ring-1 ring-rule"
        />
      )}

      <div className="mt-8 space-y-4">
        {post.body.split(/\n{2,}/).map((para, i) => renderBlogBlock(para, i))}
      </div>

      <div className="mt-10 rounded-2xl bg-surface ring-1 ring-rule p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold text-ink">Şikayetin mi var?</p>
          <p className="text-[13px] text-navy-mid mt-1">Sesini duyur, çözüm sürecini tepkimvar üzerinden takip et.</p>
        </div>
        <Link
          to="/sikayet-yaz"
          className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-brand text-brand-foreground text-[13px] font-semibold hover:brightness-105 transition shrink-0"
        >
          Şikayet Yaz
        </Link>
      </div>
    </article>
  );
}
