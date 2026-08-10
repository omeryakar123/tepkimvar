import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ayarlar")({
  component: () => (
    <div className="px-6 lg:px-10 py-8">
      <div className="eyebrow text-navy-mid">Süper Admin</div>
      <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Sistem Ayarları</h1>
      <p className="mt-2 text-[14px] text-navy-mid">Audit log, rate-limit, captcha ve genel ayarlar buradan yönetilir.</p>
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {["Rate Limit", "Captcha", "Audit Log", "Email SMTP", "Webhooks", "API Anahtarları"].map((s) => (
          <div key={s} className="bg-card rounded-2xl ring-1 ring-rule p-5">
            <div className="text-[13px] font-semibold text-ink">{s}</div>
            <div className="mt-1 text-[12.5px] text-navy-mid">Yakında konfigüre edilebilir.</div>
          </div>
        ))}
      </div>
    </div>
  ),
});
