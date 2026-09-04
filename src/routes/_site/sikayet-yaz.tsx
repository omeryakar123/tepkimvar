import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { seoHead } from "@/lib/seo";
import { ComplaintShareModal } from "@/components/complaint-share-modal";
import { ComplaintWizard, type ComplaintWizardResult } from "@/components/complaint-wizard";

export const Route = createFileRoute("/_site/sikayet-yaz")({
  validateSearch: (s: Record<string, unknown>) => ({
    brand: typeof s.brand === "string" ? s.brand : undefined,
  }),
  head: () => ({
    ...seoHead({
      title: "Şikayet Yaz — Sesini Duyur | tepkimvar",
      description:
        "Yaşadığınız sorunu adım adım anlatın, kanıt ekleyin ve markadan resmi yanıt alın.",
      path: "/sikayet-yaz",
    }),
  }),
  component: WriteComplaintPage,
});

function WriteComplaintPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { brand: brandSlug } = Route.useSearch();

  const [initialBrandId, setInitialBrandId] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [created, setCreated] = useState<ComplaintWizardResult | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.info("Şikayet yazmak için giriş yapın");
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!brandSlug) return;
    let cancelled = false;
    fetch(`/api/brands?slug=${encodeURIComponent(brandSlug)}&limit=1`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: { id: string }[] }) => {
        if (cancelled) return;
        if (j.items?.[0]) setInitialBrandId(j.items[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [brandSlug]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-navy-mid text-[14px]">
        {!authLoading && !user ? (
          <p>
            Şikayet göndermek için{" "}
            <Link to="/login" className="text-brand font-semibold underline">
              giriş yapın
            </Link>
            .
          </p>
        ) : (
          "Yükleniyor…"
        )}
      </div>
    );
  }

  return (
    <>
      {created && (
        <ComplaintShareModal
          open={shareOpen}
          complaintId={created.publicId}
          title={created.title}
          onClose={() => setShareOpen(false)}
          onView={() => navigate({ to: "/sikayet/$id", params: { id: created.publicId } })}
        />
      )}

      {created && shareOpen && created.issues.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md">
          <ul className="space-y-2">
            {created.issues.map((m) => (
              <li
                key={m}
                className="rounded-lg bg-warning-soft text-warning px-3 py-2 text-[13px] shadow-lg ring-1 ring-warning/20"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ComplaintWizard
        initialBrandId={initialBrandId}
        onSuccess={(result) => {
          setCreated(result);
          setShareOpen(true);
        }}
      />
    </>
  );
}
