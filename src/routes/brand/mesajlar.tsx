import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Messenger } from "@/components/messenger";
import type { BrandMembership } from "@/routes/brand";

export const Route = createFileRoute("/brand/mesajlar")({
  component: BrandMessages,
});

function BrandMessages() {
  const { user } = useAuth();
  const [brandId, setBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/brand/memberships", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((j: { memberships?: BrandMembership[] }) => setBrandId(j.memberships?.[0]?.brand_id ?? null))
      .catch(() => {});
  }, [user]);

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div>
        <div className="eyebrow text-navy-mid">Brand Panel</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Mesajlar</h1>
      </div>
      {brandId ? (
        <Messenger brandId={brandId} />
      ) : (
        <div className="card-surface p-10 text-center text-sm text-navy-mid">Hesabınız bir firmaya bağlı değil.</div>
      )}
    </div>
  );
}
