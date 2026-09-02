import { createFileRoute } from "@tanstack/react-router";
import { seoHead, breadcrumbLd } from "@/lib/seo";
import { TepkimvarHowItWorksPage } from "@/components/tepkimvar-how-it-works-page";

export const Route = createFileRoute("/_site/(kurumsal)/nasil-calisir")({
  head: () => ({
    ...seoHead({
      title: "tepkimvar Nasıl Çalışır? — Şikayet ve Çözüm Rehberi",
      description:
        "tepkimvar'da marka arayın, şikayetinizi yazın, moderasyon ve marka yanıtı sürecini takip edin. Kullanıcılar ve markalar için adım adım rehber.",
      path: "/nasil-calisir",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Ana Sayfa", path: "/" },
        { name: "Nasıl Çalışır", path: "/nasil-calisir" },
      ]),
    ],
  }),
  component: TepkimvarHowItWorksPage,
});
