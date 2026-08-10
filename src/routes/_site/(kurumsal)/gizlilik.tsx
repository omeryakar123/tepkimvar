import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/(kurumsal)/gizlilik")({
  head: () => ({ meta: [{ title: "Gizlilik Politikası — itirazvar." }] }),
  component: () => (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-6">
        <h1 className="text-3xl sm:text-4xl font-display font-black">Gizlilik Politikası</h1>
        <p className="text-navy leading-relaxed">itirazvar. olarak kullanıcılarımızın kişisel verilerinin gizliliğini önemsiyoruz. Toplanan veriler yalnızca hizmet kalitesini artırmak amacıyla kullanılır ve üçüncü taraflarla paylaşılmaz.</p>
        <h2 className="text-lg font-semibold mt-6">Toplanan Veriler</h2>
        <p className="text-navy">Ad, e-posta, telefon, IP adresi ve tarayıcı bilgileri.</p>
        <h2 className="text-lg font-semibold mt-6">Kullanım Amacı</h2>
        <p className="text-navy">Üyelik yönetimi, iletişim, bildirim ve moderasyon süreçleri.</p>
      </div>
    </div>
  ),
});
