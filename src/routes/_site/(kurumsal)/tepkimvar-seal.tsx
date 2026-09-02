import { createFileRoute } from "@tanstack/react-router";
import { fetchPlatformStats } from "@/lib/data";
import { seoHead, breadcrumbLd } from "@/lib/seo";
import { TepkimvarSealPage } from "@/components/tepkimvar-seal-page";

export const Route = createFileRoute("/_site/(kurumsal)/tepkimvar-seal")({
  loader: async () => ({ stats: await fetchPlatformStats().catch(() => null) }),
  head: () => ({
    ...seoHead({
      title: "tepkimvar SEAL — Marka Doğrulama ve Güven Rozeti",
      description:
        "tepkimvar SEAL, markanızın resmi temsilcisi olduğunu ve şikayetlere şeffaf yanıt verdiğini gösterir. Oyuncular QR kod ile anında doğrular.",
      path: "/tepkimvar-seal",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "tepkimvar SEAL", path: "/tepkimvar-seal" },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
  const { stats } = Route.useLoaderData();
  return <TepkimvarSealPage stats={stats} />;
}
