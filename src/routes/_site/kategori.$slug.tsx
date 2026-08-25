import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CompanyCard, ComplaintCard } from "@/components/cards";
import { Pagination } from "@/components/pagination";
import type { Company, Complaint } from "@/lib/mock-data";
import { fetchBrandsList, fetchCategoriesWithCount, fetchComplaintsPaged, PAGE_SIZE } from "@/lib/data";
import { seoHead, breadcrumbLd, clamp } from "@/lib/seo";

function slugToTitle(s: string) {
  return s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export const Route = createFileRoute("/_site/kategori/$slug")({
  loader: async ({ params }) => {
    const [cats, complaints] = await Promise.all([
      fetchCategoriesWithCount().catch(() => []),
      fetchComplaintsPaged({ categorySlug: params.slug, page: 1, pageSize: PAGE_SIZE }).catch(() => ({
        items: [] as Complaint[], total: 0, page: 1, pageSize: PAGE_SIZE,
      })),
    ]);
    const cat = cats.find((c) => c.slug === params.slug) ?? null;
    return { cat, complaints };
  },
  head: ({ loaderData, params }) => {
    const path = `/kategori/${params.slug}`;
    const name = loaderData?.cat?.name ?? slugToTitle(params.slug);
    const count = loaderData?.complaints?.total ?? 0;
    const title = `${name} Şikayetleri ve Firmaları — tepkimvar`;
    const description = clamp(
      `${name} kategorisinde ${count} müşteri şikayeti. Firmaların çözüm oranları, marka yanıtları ve puanları.`,
      155,
    );
    return {
      ...seoHead({ title, description, path }),
      scripts: [
        breadcrumbLd([
          { name: "Ana Sayfa", path: "/" },
          { name: "Şikayetler", path: "/sikayetler" },
          { name, path },
        ]),
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const [cat, setCat] = useState<{ name: string; count: number; slug: string } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const cats = await fetchCategoriesWithCount();
      const c = cats.find((x) => x.slug === slug);
      setCat(c ? { name: c.name, count: c.count, slug: c.slug } : null);
      setCompanies(await fetchBrandsList({ categorySlug: slug, limit: 12, sortBy: "rating" }));
    })();
    setPage(1);
  }, [slug]);

  useEffect(() => {
    fetchComplaintsPaged({ categorySlug: slug, page, pageSize: PAGE_SIZE }).then((r) => {
      setComplaints(r.items); setTotal(r.total);
    });
  }, [slug, page]);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="bg-card rounded-2xl ring-1 ring-rule p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand mb-2">Kategori</p>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">{cat?.name ?? "Yükleniyor..."}</h1>
          <p className="text-sm text-navy-mid">
            {total.toLocaleString("tr-TR")} şikayet · {companies.length} firma
          </p>
        </div>

        {companies.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight mb-4">Öne çıkan firmalar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {companies.map((c) => <CompanyCard key={c.slug} company={c} />)}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Şikayetler</h2>
          {complaints.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {complaints.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
            </>
          ) : (
            <div className="bg-card rounded-2xl ring-1 ring-rule p-8 text-center text-sm text-navy-mid">Bu kategoride henüz şikayet bulunmuyor.</div>
          )}
        </section>
      </div>
    </div>
  );
}
