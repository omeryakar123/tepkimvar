import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/(kurumsal)/kvkk")({
  head: () => ({ meta: [{ title: "KVKK Aydınlatma Metni — itirazvar." }] }),
  component: () => (
    <div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-6">
        <h1 className="text-3xl sm:text-4xl font-display font-black">KVKK Aydınlatma Metni</h1>
        <p className="text-navy leading-relaxed">6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, itirazvar. veri sorumlusu sıfatıyla kişisel verilerinizi işlemektedir.</p>
        <p className="text-navy">Verileriniz; üyelik oluşturma, şikayet yayınlama, moderasyon süreçleri ve iletişim faaliyetleri için işlenir.</p>
        <p className="text-navy">Haklarınız kapsamında verilerinize erişme, düzeltme ve silme talebinde bulunabilirsiniz. Talep için iletisim@itirazvar.com adresine yazabilirsiniz.</p>
      </div>
    </div>
  ),
});
