import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldX, ArrowLeft } from "lucide-react";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/(kurumsal)/erisim-yok")({
  head: () => ({
    ...seoHead({
      title: "Erişim Yok — tepkimvar",
      description: "Bu sayfayı görüntülemek için yetkiniz yok.",
      path: "/erisim-yok",
      noindex: true,
    }),
  }),
  component: AccessDenied,
});

function AccessDenied() {
  return (
    <div className="flex flex-col">
      <main className="flex-1 grid place-items-center px-6 py-20">
        <div className="text-center max-w-md">
          <div className="mx-auto size-20 rounded-full bg-danger-soft grid place-items-center mb-6 animate-pulse">
            <ShieldX className="size-10 text-danger" />
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink mb-2">Erişim Reddedildi</h1>
          <p className="text-navy-mid text-[15px] leading-relaxed mb-6">
            Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Eğer bir hata olduğunu düşünüyorsanız hesabınızla giriş yapın veya yönetici ile iletişime geçin.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-11 text-sm font-semibold shadow-soft hover:brightness-105">
            <ArrowLeft className="size-4" /> Ana sayfaya dön
          </Link>
        </div>
      </main>
    </div>
  );
}
