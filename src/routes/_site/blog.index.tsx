import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { seoHead, breadcrumbLd, clamp } from "@/lib/seo";
import { fetchBlogList, type BlogListItem } from "@/lib/blog";

const PAGE_SIZE = 12;

export const Route = createFileRoute("/_site/blog/")({
  validateSearch: (s: Record<string, unknown>): { sayfa?: number } => ({
    sayfa: Number(s.sayfa) > 1 ? Number(s.sayfa) : undefined,
  }),
  loaderDeps: ({ search }) => ({ sayfa: search.sayfa ?? 1 }),
  loader: async ({ deps }) =>
    await fetchBlogList(deps.sayfa, PAGE_SIZE).catch(() => ({ items: [], total: 0 })),
  head: ({ loaderData }) => ({
    ...seoHead({
      title: "Blog — Tüketici Hakları ve Rehberler | itirazvar",
      description: clamp(
        `Tüketici hakları, şikayet süreçleri ve marka rehberleri. ${loaderData?.total ?? 0} yazı.`,
        155,
      ),
      path: "/blog",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "Blog", path: "/blog" },
      ]),
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { items, total } = Route.useLoaderData();
  const { sayfa } = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = sayfa ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <header className="max-w-2xl">
        <p className="eyebrow text-brand">Blog</p>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight text-ink">
          Tüketici hakları ve rehberler
        </h1>
        <p className="mt-3 text-[15px] text-navy leading-relaxed">
          Şikayet süreçleri, haklarınız ve markalarla iletişim üzerine yazılar.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-10 card-surface p-10 text-center text-sm text-navy-mid">
          Henüz yayınlanmış yazı yok.
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={(p) => navigate({ search: { sayfa: p > 1 ? p : undefined } })}
          />
        </>
      )}
    </div>
  );
}

function BlogCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group card-interactive overflow-hidden hover:shadow-pop hover:border-brand/40 hover:-translate-y-0.5"
    >
      {post.cover_url ? (
        <img src={post.cover_url} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="aspect-[16/9] w-full bg-brand-soft" />
      )}
      <div className="p-5">
        {post.category && (
          <span className="inline-flex rounded-full bg-brand-soft text-brand px-2.5 py-1 text-[11px] font-semibold">
            {post.category}
          </span>
        )}
        <h2 className="mt-2 font-semibold text-[16px] leading-snug text-ink line-clamp-2 group-hover:text-brand transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-1.5 text-[13px] text-navy line-clamp-2 leading-relaxed">{post.excerpt}</p>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-[12px] text-navy-mid">
          <CalendarDays className="size-3.5" />
          {new Date(post.published_at).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
    </Link>
  );
}
