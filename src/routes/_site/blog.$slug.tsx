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
        title: "Yazı bulunamadı — itirazvar",
        description: "Aradığınız yazı yayında değil.",
        path,
        noindex: true,
      });
    }
    const title = p.seo_title || `${p.title} | itirazvar Blog`;
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
          publisher: { "@type": "Organization", name: "itirazvar" },
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

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-navy-mid hover:text-brand transition-colors"
      >
        <ArrowLeft className="size-4" /> Blog
      </Link>

      <header className="mt-6">
        {post.category && (
          <span className="inline-flex rounded-full bg-brand-soft text-brand px-2.5 py-1 text-[11px] font-semibold">
            {post.category}
          </span>
        )}
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-black tracking-tight text-ink leading-tight">
          {post.title}
        </h1>
        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-navy-mid">
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

      {/*
        Gövde düz metin olarak render ediliyor (dangerouslySetInnerHTML YOK).
        Admin HTML girse bile çalıştırılmaz — stored-XSS riski kapalı.
        Paragraf/satır aralıkları whitespace-pre-line ile korunur.
      */}
      <div className="mt-8 space-y-4 text-[15.5px] leading-[1.75] text-navy">
        {post.body
          .split(/\n{2,}/)
          .map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
      </div>
    </article>
  );
}
