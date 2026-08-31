import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { BrandMembership } from "@/routes/brand";
import {
  Loader2,
  Facebook,
  Instagram,
  Twitter,
  Send as TelegramIcon,
  Globe,
} from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { BrandAvatar } from "@/components/cards";
import { proxyImage } from "@/lib/img";
import { toE164Tr, fromE164 } from "@/lib/phone";

type Socials = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  telegram?: string;
};
type Hours = Record<string, { open: string; close: string; closed?: boolean }>;

type Brand = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  socials: Socials | null;
  business_hours: Hours | null;
};

const DAYS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const Route = createFileRoute("/brand/profil")({
  component: BrandProfilePage,
});

function BrandProfilePage() {
  const { user } = useAuth();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const mres = await fetch("/api/brand/memberships", {
        credentials: "include",
      });
      const mj = mres.ok
        ? ((await mres.json()) as { memberships?: BrandMembership[] })
        : { memberships: [] };
      const id = mj.memberships?.[0]?.brand_id;
      if (!id || cancelled) return;

      const res = await fetch(
        `/api/brand/profile?brandId=${encodeURIComponent(id)}`,
        {
          credentials: "include",
        },
      );
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { brand?: Brand };
      if (j.brand && !cancelled) {
        setBrand(j.brand);
        setPhone(fromE164(j.brand.phone));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Beyaz listeli PATCH — sunucu da ayrıca kolon bazında doğruluyor. */
  async function patchBrand(
    brandId: string,
    patch: Record<string, unknown>,
  ): Promise<Brand | null> {
    const res = await fetch("/api/brand/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "İşlem başarısız");
      return null;
    }
    const j = (await res.json()) as { brand?: Brand };
    return j.brand ?? null;
  }

  async function save() {
    if (!brand) return;
    const e164 = phone ? toE164Tr(phone) : null;
    if (phone && !e164) return toast.error("Telefon geçersiz");
    setLoading(true);
    const updated = await patchBrand(brand.id, {
      name: brand.name,
      website: brand.website,
      phone: e164,
      email: brand.email,
      address: brand.address,
      about: brand.about,
      socials: brand.socials ?? {},
      business_hours: brand.business_hours ?? {},
    });
    setLoading(false);
    if (updated) {
      setBrand(updated);
      setPhone(fromE164(updated.phone));
      toast.success("Profil kaydedildi");
    }
  }

  async function uploadImage(field: "logo_url" | "cover_url", file: File) {
    if (!brand) return;
    if (!file.type.startsWith("image/")) return toast.error("Sadece görsel");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", field === "logo_url" ? "brand-logos" : "brand-covers");
    fd.append("brandId", brand.id);
    const up = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!up.ok) {
      const j = await up.json().catch(() => ({}));
      toast.error(j.error ?? "İşlem başarısız");
      return;
    }
    const { url } = (await up.json()) as { url: string };

    const updated = await patchBrand(
      brand.id,
      field === "logo_url" ? { logo_url: url } : { cover_url: url },
    );
    if (!updated) return;
    setBrand({ ...brand, [field]: url });
    toast.success("Yüklendi");
  }

  function setSocial(key: keyof Socials, v: string) {
    if (!brand) return;
    setBrand({ ...brand, socials: { ...(brand.socials ?? {}), [key]: v } });
  }

  function setHour(
    dayKey: string,
    field: "open" | "close" | "closed",
    val: string | boolean,
  ) {
    if (!brand) return;
    const cur = brand.business_hours ?? {};
    const day = cur[dayKey] ?? { open: "09:00", close: "18:00" };
    cur[dayKey] = { ...day, [field]: val };
    setBrand({ ...brand, business_hours: { ...cur } });
  }

  if (!brand)
    return (
      <div className="px-6 lg:px-10 py-8 text-navy-mid">Firma yükleniyor…</div>
    );

  const socials = brand.socials ?? {};
  const hours = brand.business_hours ?? {};

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6 max-w-4xl">
      <div>
        <div className="eyebrow text-navy-mid">Brand Profil</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">
          {brand.name}
        </h1>
        <p className="mt-1 text-[14px] text-navy-mid">/firma/{brand.slug}</p>
      </div>

      {/* Cover + logo */}
      <div className="bg-card rounded-2xl ring-1 ring-rule overflow-hidden">
        <div className="relative h-48 bg-gradient-to-br from-brand-soft to-surface">
          {brand.cover_url && (
            <img
              src={proxyImage(brand.cover_url) ?? brand.cover_url}
              alt=""
              className="size-full object-cover"
            />
          )}
          <label className="absolute right-3 top-3 text-[11px] bg-card/95 px-3 py-1.5 rounded-full cursor-pointer hover:bg-card shadow-soft font-semibold">
            Kapak değiştir
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files?.[0] &&
                uploadImage("cover_url", e.target.files[0])
              }
            />
          </label>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="-mt-14 shadow-soft">
            <BrandAvatar
              name={brand.name}
              slug={brand.slug}
              logoUrl={brand.logo_url}
              website={brand.website}
              size={80}
              className="ring-2 ring-white shadow-soft"
            />
          </div>
          <label className="text-[12px] font-semibold text-brand hover:underline cursor-pointer">
            Logo değiştir
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files?.[0] &&
                uploadImage("logo_url", e.target.files[0])
              }
            />
          </label>
        </div>
      </div>

      {/* Contact */}
      <Card title="İletişim & Genel">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Firma adı"
            value={brand.name}
            onChange={(v) => setBrand({ ...brand, name: v })}
          />
          <Field
            label="Website"
            value={brand.website ?? ""}
            onChange={(v) => setBrand({ ...brand, website: v })}
            placeholder="https://"
          />
          <div>
            <label className="text-[12px] font-medium text-navy-mid">
              Telefon
            </label>
            <div className="mt-1">
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
          </div>
          <Field
            label="E-posta"
            value={brand.email ?? ""}
            onChange={(v) => setBrand({ ...brand, email: v })}
          />
          <Field
            label="Adres"
            value={brand.address ?? ""}
            onChange={(v) => setBrand({ ...brand, address: v })}
          />
          <div className="sm:col-span-2">
            <label className="text-[12px] font-medium text-navy-mid">
              Hakkında
            </label>
            <textarea
              rows={5}
              value={brand.about ?? ""}
              onChange={(e) => setBrand({ ...brand, about: e.target.value })}
              className="mt-1 w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
        </div>
      </Card>

      {/* Socials */}
      <Card title="Sosyal Medya">
        <div className="grid sm:grid-cols-2 gap-4">
          <SocialField
            icon={Facebook}
            label="Facebook"
            value={socials.facebook ?? ""}
            onChange={(v) => setSocial("facebook", v)}
          />
          <SocialField
            icon={Instagram}
            label="Instagram"
            value={socials.instagram ?? ""}
            onChange={(v) => setSocial("instagram", v)}
          />
          <SocialField
            icon={Twitter}
            label="Twitter / X"
            value={socials.twitter ?? ""}
            onChange={(v) => setSocial("twitter", v)}
          />
          <SocialField
            icon={TelegramIcon}
            label="Telegram"
            value={socials.telegram ?? ""}
            onChange={(v) => setSocial("telegram", v)}
          />
        </div>
      </Card>

      {/* Working hours */}
      <Card title="Çalışma Saatleri">
        <div className="space-y-2">
          {DAY_KEYS.map((k, i) => {
            const d = hours[k] ?? {
              open: "09:00",
              close: "18:00",
              closed: false,
            };
            return (
              <div
                key={k}
                className="grid grid-cols-[120px_1fr_1fr_auto] items-center gap-3"
              >
                <span className="text-[13px] font-medium text-ink">
                  {DAYS[i]}
                </span>
                <input
                  type="time"
                  disabled={!!d.closed}
                  value={d.open}
                  onChange={(e) => setHour(k, "open", e.target.value)}
                  className="h-9 rounded-lg ring-1 ring-rule px-2 text-sm disabled:opacity-50"
                />
                <input
                  type="time"
                  disabled={!!d.closed}
                  value={d.close}
                  onChange={(e) => setHour(k, "close", e.target.value)}
                  className="h-9 rounded-lg ring-1 ring-rule px-2 text-sm disabled:opacity-50"
                />
                <label className="text-[12px] text-navy flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!d.closed}
                    onChange={(e) => setHour(k, "closed", e.target.checked)}
                    className="size-4 accent-brand"
                  />
                  Kapalı
                </label>
              </div>
            );
          })}
        </div>
      </Card>

      <button
        onClick={save}
        disabled={loading}
        className="rounded-full bg-brand text-brand-foreground px-6 h-11 text-[14px] font-semibold hover:brightness-105 disabled:opacity-60 inline-flex items-center gap-2"
      >
        {loading && <Loader2 className="size-4 animate-spin" />} Tüm
        değişiklikleri kaydet
      </button>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-6">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
      />
    </div>
  );
}

function SocialField({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-navy-mid">{label}</label>
      <div className="relative mt-1">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
          className="w-full h-10 rounded-lg ring-1 ring-rule bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
    </div>
  );
}
