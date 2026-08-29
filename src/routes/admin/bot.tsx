import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Eye,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend, apiSendJson } from "@/lib/admin-api";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/pagination";

/**
 * Complaint Bot yönetimi.
 *
 * Mevcut admin tasarım dili birebir kullanılır (bg-card + ring-rule kartlar,
 * surface başlıklı tablolar, brand renkli birincil buton); yeni bir tasarım
 * sistemi ya da bileşen kütüphanesi eklenmedi.
 */

export const Route = createFileRoute("/admin/bot")({
  component: AdminBotPage,
});

const PAGE_SIZE = 20;

/** Mevcut admin formlarındaki input görünümü. */
const INPUT = "w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card";

type Option = { key: string; label: string };
type Options = {
  scenarios: Option[];
  complaint_tones: string[];
  response_tones: string[];
  languages: string[];
};

type BotListItem = {
  brand_id: string;
  brand_name: string;
  brand_active: boolean;
  enabled: boolean;
  daily_target: number;
  language: string;
  response_tone: string;
  last_run_at: string | null;
  today_count: number;
};

type AiInfo = { configured: boolean; provider: string; synthetic_public: boolean };

type Stats = {
  total: number;
  today: number;
  avg_rating: number | null;
  stars: Record<string, number>;
  responded: number;
  failed: number;
  response_rate: number;
  active_bots: number;
  ai: AiInfo;
};

type BotConfig = {
  brand_id: string;
  enabled: boolean;
  daily_target: number;
  min_rating: number;
  max_rating: number;
  language: string;
  complaint_tone: string;
  response_tone: string;
  scenarios: string[];
  custom_instructions: string | null;
  similarity_threshold: number;
  last_run_at: string | null;
};

type ComplaintRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  title: string;
  body: string;
  rating: number | null;
  scenario: string | null;
  language: string;
  status: string;
  brand_response: string | null;
  generated_by: string | null;
  is_public: boolean;
  bot_error: string | null;
  created_at: string;
};

type ComplaintDetail = {
  complaint: ComplaintRow & {
    brand_slug: string;
    anon_name: string | null;
    brand_response_at: string | null;
    first_response_minutes: number | null;
    updated_at: string;
  };
  replies: {
    id: string;
    body: string;
    is_brand: boolean;
    language: string | null;
    generated_by: string | null;
    created_at: string;
  }[];
  run: {
    id: string;
    trigger: string;
    status: string;
    provider: string | null;
    started_at: string;
  } | null;
};

type RunRow = {
  id: string;
  brand_name: string;
  trigger: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  target_count: number;
  complaints_generated: number;
  responses_generated: number;
  duplicates_detected: number;
  error_count: number;
  errors: string[];
  provider: string | null;
};

type Brand = { id: string; name: string };

const STATUS_OPTIONS = ["approved", "answered", "resolved", "pending", "rejected", "spam"];

type Filters = {
  rating: string;
  scenario: string;
  language: string;
  status: string;
  from: string;
  to: string;
  q: string;
};

const EMPTY_FILTERS: Filters = {
  rating: "",
  scenario: "",
  language: "",
  status: "",
  from: "",
  to: "",
  q: "",
};

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

function AdminBotPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [bots, setBots] = useState<BotListItem[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [busy, setBusy] = useState(false);

  /** Panonun tamamının kapsamı: boş = tüm markalar. */
  const [scopeBrand, setScopeBrand] = useState("");

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [configBrand, setConfigBrand] = useState("");

  const [items, setItems] = useState<ComplaintRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // `filters` form durumu, `applied` sorguya giren durum. Açılır listeler
  // anında uygulanır; arama kutusu "Filtrele" ile (her tuşta istek atmasın).
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  function updateFilter(patch: Partial<Filters>, applyNow = true) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (applyNow) setApplied(next);
  }

  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  const scenarioLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of options?.scenarios ?? []) map.set(s.key, s.label);
    return map;
  }, [options]);

  /* ------------------------------- Yükleme -------------------------------- */

  const loadOverview = useCallback(async () => {
    const [cfg, st, rs] = await Promise.all([
      apiGet<{ items: BotListItem[]; options: Options; ai: AiInfo }>("/api/admin/bot/config"),
      apiGet<Stats>(`/api/admin/bot/stats${scopeBrand ? `?brandId=${scopeBrand}` : ""}`),
      apiGet<{ items: RunRow[] }>(
        `/api/admin/bot/runs?limit=10${scopeBrand ? `&brandId=${scopeBrand}` : ""}`,
      ),
    ]);
    if (cfg) {
      setBots(cfg.items);
      setOptions(cfg.options);
      setAi(cfg.ai);
    }
    if (st) setStats(st);
    if (rs) setRuns(rs.items);
  }, [scopeBrand]);

  const loadComplaints = useCallback(
    async (p = 1) => {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (scopeBrand) params.set("brandId", scopeBrand);
      for (const [k, v] of Object.entries(applied)) if (v) params.set(k, v);
      const data = await apiGet<{ items: ComplaintRow[]; total: number }>(
        `/api/admin/bot/complaints?${params}`,
      );
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    },
    [scopeBrand, applied],
  );

  useEffect(() => {
    apiGet<{ items: Brand[] }>("/api/admin/brands").then((d) => setBrands(d?.items ?? []));
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setPage(1);
    loadComplaints(1);
  }, [loadComplaints]);

  useEffect(() => {
    if (!configBrand) {
      setConfig(null);
      return;
    }
    apiGet<{ config: BotConfig }>(`/api/admin/bot/config?brandId=${configBrand}`).then((d) =>
      setConfig(d?.config ?? null),
    );
  }, [configBrand]);

  /* -------------------------------- İşlemler ------------------------------ */

  async function runNow() {
    setBusy(true);
    const res = await apiSendJson<{ complaintsGenerated: number; brands: number }>(
      `/api/cron/complaint-bot${scopeBrand ? `?brandId=${scopeBrand}` : ""}`,
      "POST",
    );
    setBusy(false);
    if (res) {
      toast.success(`${res.complaintsGenerated} şikayet üretildi (${res.brands} marka)`);
      loadOverview();
      loadComplaints(1);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setBusy(true);
    const ok = await apiSend("/api/admin/bot/config", "PUT", {
      brandId: config.brand_id,
      enabled: config.enabled,
      dailyTarget: config.daily_target,
      minRating: config.min_rating,
      maxRating: config.max_rating,
      language: config.language,
      complaintTone: config.complaint_tone,
      responseTone: config.response_tone,
      scenarios: config.scenarios,
      customInstructions: config.custom_instructions,
      similarityThreshold: config.similarity_threshold,
    });
    setBusy(false);
    if (ok) {
      toast.success("Bot ayarları kaydedildi");
      loadOverview();
    }
  }

  async function openDetail(id: string) {
    const d = await apiGet<ComplaintDetail>(`/api/admin/bot/complaints?id=${id}`);
    if (d) {
      setDetail(d);
      setResponseDraft(d.complaint.brand_response ?? "");
    }
  }

  async function saveResponse() {
    if (!detail) return;
    setBusy(true);
    const ok = await apiSend("/api/admin/bot/complaints", "PATCH", {
      id: detail.complaint.id,
      response: responseDraft,
    });
    setBusy(false);
    if (ok) {
      toast.success("Yanıt güncellendi");
      setDetail(null);
      loadComplaints(page);
      loadOverview();
    }
  }

  async function removeComplaint(id: string) {
    if (!confirm("Bu bot şikayeti silinsin mi?")) return;
    if (await apiSend("/api/admin/bot/complaints", "DELETE", { id })) {
      toast.success("Silindi");
      setDetail(null);
      loadComplaints(page);
      loadOverview();
    }
  }

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="eyebrow text-navy-mid">Otomasyon</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink flex items-center gap-2">
            <Bot className="size-7 text-brand" /> Complaint Bot
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={scopeBrand}
            onChange={(e) => setScopeBrand(e.target.value)}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="">Tüm markalar</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={runNow}
            disabled={busy}
            className="h-10 rounded-lg ring-1 ring-rule px-4 text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface disabled:opacity-60"
          >
            <Play className="size-4" /> Şimdi çalıştır
          </button>
          <button
            onClick={() => setGenerateOpen(true)}
            className="h-10 rounded-lg bg-brand text-brand-foreground px-4 text-sm font-semibold inline-flex items-center gap-2"
          >
            <Sparkles className="size-4" /> Şikayet Üret (çoklu)
          </button>
        </div>
      </div>

      {/* AI / yayın durumu — operatörün en çok yanıldığı iki nokta. */}
      {ai && (
        <div className="grid gap-3 md:grid-cols-2">
          <div
            className={`rounded-xl px-4 py-3 text-[13px] ring-1 flex items-start gap-2 ${
              ai.configured
                ? "bg-success-soft/40 ring-success/30 text-ink"
                : "bg-warning-soft/40 ring-warning/30 text-ink"
            }`}
          >
            {ai.configured ? (
              <Check className="size-4 mt-0.5 text-success shrink-0" />
            ) : (
              <AlertTriangle className="size-4 mt-0.5 text-warning shrink-0" />
            )}
            <span>
              {ai.configured ? (
                <>
                  AI sağlayıcısı bağlı — model: <b>{ai.provider}</b>
                </>
              ) : (
                <>
                  <b>AI_API_KEY tanımlı değil.</b> Bot çalışır ama metinler şablon üreticiden
                  gelir. fal.ai (uuid:secret) veya OpenRouter (sk-or-v1-…) anahtarını <b>AI_API_KEY</b> ile girin.
                </>
              )}
            </span>
          </div>
          <div className="rounded-xl px-4 py-3 text-[13px] ring-1 bg-surface ring-rule flex items-start gap-2">
            <AlertTriangle
              className={`size-4 mt-0.5 shrink-0 ${ai.synthetic_public ? "text-danger" : "text-navy-mid"}`}
            />
            <span>
              {ai.synthetic_public ? (
                <>
                  <b>Sentetik içerik YAYINDA:</b> bot şikayetleri herkese açık listelerde görünür
                  ve marka puan ortalamasına girer.
                </>
              ) : (
                <>
                  Sentetik içerik yalnızca panelde görünür; herkese açık listelere ve puan
                  ortalamasına <b>girmez</b> (SYNTHETIC_CONTENT_PUBLIC).
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Pano */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Toplam şikayet" value={stats.total.toLocaleString("tr-TR")} />
          <StatCard label="Bugün" value={stats.today.toLocaleString("tr-TR")} />
          <StatCard
            label="Ortalama puan"
            value={stats.avg_rating !== null ? stats.avg_rating.toFixed(2) : "—"}
            icon={<Star className="size-4 fill-amber-400 text-amber-400" />}
          />
          <StatCard label="Yanıt oranı" value={`${stats.response_rate}%`} />
          <StatCard label="Aktif bot" value={String(stats.active_bots)} />
        </div>
      )}

      {stats && (
        <div className="bg-card rounded-2xl ring-1 ring-rule p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-navy-mid mb-3">
            Yıldız dağılımı
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = Number(stats.stars[String(n)] ?? 0);
              const pct = stats.total > 0 ? Math.round((count * 100) / stats.total) : 0;
              return (
                <div key={n} className="flex items-center gap-3 text-[13px]">
                  <span className="w-10 shrink-0 inline-flex items-center gap-1 font-semibold text-ink">
                    {n} <Star className="size-3 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-navy-mid">
                    {count.toLocaleString("tr-TR")} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
          {stats.failed > 0 && (
            <div className="mt-3 text-[12.5px] text-danger inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> {stats.failed} şikayette yanıt üretilemedi —
              sonraki çalıştırmada yeniden denenecek.
            </div>
          )}
        </div>
      )}

      {/* Marka bazlı ayarlar */}
      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <div className="p-4 border-b border-rule flex items-center gap-3 flex-wrap">
          <div className="font-display font-bold text-ink">Marka bot ayarları</div>
          <select
            value={configBrand}
            onChange={(e) => setConfigBrand(e.target.value)}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm ml-auto bg-card"
          >
            <option value="">Marka seçin…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {config && options ? (
          <div className="p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex items-center gap-3 md:col-span-2 xl:col-span-3">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="size-4 accent-[var(--brand)]"
              />
              <span className="text-[13.5px] font-semibold text-ink">
                Complaint Bot açık (günlük cron bu markayı işler)
              </span>
            </label>

            <Field label="Günlük hedef">
              <input
                type="number"
                min={0}
                max={25}
                value={config.daily_target}
                onChange={(e) => setConfig({ ...config, daily_target: Number(e.target.value) })}
                className={INPUT}
              />
            </Field>
            <Field label="Min yıldız">
              <select
                value={config.min_rating}
                onChange={(e) => setConfig({ ...config, min_rating: Number(e.target.value) })}
                className={INPUT}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Max yıldız">
              <select
                value={config.max_rating}
                onChange={(e) => setConfig({ ...config, max_rating: Number(e.target.value) })}
                className={INPUT}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dil">
              <select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                className={INPUT}
              >
                {options.languages.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Şikayet tonu">
              <select
                value={config.complaint_tone}
                onChange={(e) => setConfig({ ...config, complaint_tone: e.target.value })}
                className={INPUT}
              >
                {options.complaint_tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Yanıt tonu">
              <select
                value={config.response_tone}
                onChange={(e) => setConfig({ ...config, response_tone: e.target.value })}
                className={INPUT}
              >
                {options.response_tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Benzerlik eşiği (${config.similarity_threshold})`}>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={config.similarity_threshold}
                onChange={(e) =>
                  setConfig({ ...config, similarity_threshold: Number(e.target.value) })
                }
                className="w-full"
              />
            </Field>

            <div className="md:col-span-2 xl:col-span-3">
              <div className="text-[12px] font-medium text-navy-mid mb-2">
                Senaryolar (hiçbiri seçilmezse tümü kullanılır)
              </div>
              <div className="flex flex-wrap gap-2">
                {options.scenarios.map((s) => {
                  const active = config.scenarios.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          scenarios: active
                            ? config.scenarios.filter((x) => x !== s.key)
                            : [...config.scenarios, s.key],
                        })
                      }
                      className={`h-8 px-3 rounded-full text-[12.5px] font-medium ring-1 transition ${
                        active
                          ? "bg-brand text-brand-foreground ring-brand"
                          : "ring-rule text-navy hover:bg-surface"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <div className="text-[12px] font-medium text-navy-mid mb-1">
                Markaya özel talimatlar (AI promptuna eklenir)
              </div>
              <textarea
                rows={3}
                maxLength={1200}
                value={config.custom_instructions ?? ""}
                onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
                placeholder="Örn: ödeme yöntemi olarak yalnızca havale ve kripto kullan, bonus kampanyası adı vermeyin."
                className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3 flex items-center gap-3">
              <button
                onClick={saveConfig}
                disabled={busy}
                className="h-10 rounded-lg bg-brand text-brand-foreground px-5 text-sm font-semibold disabled:opacity-60"
              >
                Kaydet
              </button>
              <span className="text-[12.5px] text-navy-mid">
                Son çalışma: {fmtDate(config.last_run_at)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-[13.5px] text-navy-mid">
            Ayarları görmek/düzenlemek için bir marka seçin.
          </div>
        )}

        {bots.length > 0 && (
          <div className="border-t border-rule overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Marka</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Bugün / Hedef</th>
                  <th className="px-4 py-3 font-semibold">Dil</th>
                  <th className="px-4 py-3 font-semibold">Son çalışma</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => (
                  <tr key={b.brand_id} className="border-t border-rule hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfigBrand(b.brand_id)}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {b.brand_name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                          b.enabled ? "text-success" : "text-navy-mid"
                        }`}
                      >
                        <span
                          className={`size-2 rounded-full ${b.enabled ? "bg-success" : "bg-navy-mid/40"}`}
                        />
                        {b.enabled ? "Açık" : "Kapalı"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy">
                      {b.today_count} / {b.daily_target}
                    </td>
                    <td className="px-4 py-3 text-navy-mid uppercase">{b.language}</td>
                    <td className="px-4 py-3 text-navy-mid">{fmtDate(b.last_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Şikayet listesi */}
      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(filters);
          }}
          className="p-4 border-b border-rule flex items-center gap-2 flex-wrap"
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-navy-mid" />
            <input
              value={filters.q}
              onChange={(e) => updateFilter({ q: e.target.value }, false)}
              placeholder="Şikayet veya yanıt ara…"
              className="w-full h-10 rounded-lg ring-1 ring-rule pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <select
            value={filters.rating}
            onChange={(e) => updateFilter({ rating: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="">Tüm puanlar</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} yıldız
              </option>
            ))}
          </select>
          <select
            value={filters.scenario}
            onChange={(e) => updateFilter({ scenario: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="">Tüm kategoriler</option>
            {(options?.scenarios ?? []).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={filters.language}
            onChange={(e) => updateFilter({ language: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="">Tüm diller</option>
            {(options?.languages ?? []).map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          >
            <option value="">Tüm durumlar</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter({ from: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter({ to: e.target.value })}
            className="h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          />
          <button className="h-10 rounded-lg bg-ink text-paper px-4 text-sm font-semibold inline-flex items-center gap-2">
            <RefreshCw className="size-4" /> Filtrele
          </button>
          <div className="text-[12px] text-navy-mid ml-auto">
            {total.toLocaleString("tr-TR")} kayıt
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Marka</th>
                <th className="px-4 py-3 font-semibold min-w-[220px]">Şikayet</th>
                <th className="px-4 py-3 font-semibold">Puan</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Dil</th>
                <th className="px-4 py-3 font-semibold">Yanıt</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-rule hover:bg-surface/50">
                  <td className="px-4 py-3 text-navy whitespace-nowrap">{c.brand_name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(c.id)}
                      className="text-left font-medium text-ink hover:text-brand line-clamp-2"
                    >
                      {c.title}
                    </button>
                    {c.bot_error && (
                      <div className="text-[11.5px] text-danger mt-0.5">Yanıt üretilemedi</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      {c.rating ?? "—"}
                      {c.rating ? <Star className="size-3 fill-amber-400 text-amber-400" /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-mid whitespace-nowrap">
                    {c.scenario ? (scenarioLabels.get(c.scenario) ?? c.scenario) : "—"}
                  </td>
                  <td className="px-4 py-3 text-navy-mid uppercase">{c.language}</td>
                  <td className="px-4 py-3">
                    {c.brand_response ? (
                      <Check className="size-4 text-success" />
                    ) : (
                      <X className="size-4 text-navy-mid" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-mid">{c.status}</td>
                  <td className="px-4 py-3 text-navy-mid whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openDetail(c.id)}
                      className="text-navy-mid hover:text-brand p-1"
                      aria-label="Detay"
                    >
                      <Eye className="size-4" />
                    </button>
                    <button
                      onClick={() => removeComplaint(c.id)}
                      className="text-navy-mid hover:text-danger p-1"
                      aria-label="Sil"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-navy-mid">
                    Kayıt bulunamadı. Bot ayarlarını açıp "Şikayet Üret" ile başlayabilirsiniz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-rule">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={(p) => {
              setPage(p);
              loadComplaints(p);
            }}
          />
        </div>
      </div>

      {/* Son çalıştırmalar */}
      <div className="bg-card rounded-2xl ring-1 ring-rule">
        <div className="p-4 border-b border-rule font-display font-bold text-ink">
          Son bot çalıştırmaları
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface text-navy-mid text-left text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Marka</th>
                <th className="px-4 py-3 font-semibold">Tetik</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">Şikayet</th>
                <th className="px-4 py-3 font-semibold">Yanıt</th>
                <th className="px-4 py-3 font-semibold">Kopya</th>
                <th className="px-4 py-3 font-semibold">Hata</th>
                <th className="px-4 py-3 font-semibold">Başlangıç</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-rule align-top">
                  <td className="px-4 py-3 text-navy">{r.brand_name}</td>
                  <td className="px-4 py-3 text-navy-mid">{r.trigger}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[12px] font-semibold ${
                        r.status === "success"
                          ? "text-success"
                          : r.status === "failed"
                            ? "text-danger"
                            : "text-warning"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy">
                    {r.complaints_generated}/{r.target_count}
                  </td>
                  <td className="px-4 py-3 text-navy">{r.responses_generated}</td>
                  <td className="px-4 py-3 text-navy-mid">{r.duplicates_detected}</td>
                  <td className="px-4 py-3">
                    {r.error_count > 0 ? (
                      <details className="text-[12px] text-danger">
                        <summary className="cursor-pointer">{r.error_count} hata</summary>
                        <ul className="mt-1 space-y-1 max-w-md">
                          {(r.errors ?? []).map((e, i) => (
                            <li key={i} className="text-navy-mid break-words">
                              {e}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="text-navy-mid">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-mid whitespace-nowrap">
                    {fmtDate(r.started_at)}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-navy-mid">
                    Henüz çalıştırma kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailModal
        detail={detail}
        onClose={() => setDetail(null)}
        responseDraft={responseDraft}
        setResponseDraft={setResponseDraft}
        onSave={saveResponse}
        onDelete={removeComplaint}
        busy={busy}
        scenarioLabels={scenarioLabels}
      />

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        brands={brands}
        options={options}
        defaultBrand={scopeBrand || configBrand}
        onDone={() => {
          loadOverview();
          loadComplaints(1);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Parçalar                                   */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-navy-mid font-semibold">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-black text-ink inline-flex items-center gap-1.5">
        {value} {icon}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-navy-mid">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DetailModal({
  detail,
  onClose,
  responseDraft,
  setResponseDraft,
  onSave,
  onDelete,
  busy,
  scenarioLabels,
}: {
  detail: ComplaintDetail | null;
  onClose: () => void;
  responseDraft: string;
  setResponseDraft: (v: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  busy: boolean;
  scenarioLabels: Map<string, string>;
}) {
  const c = detail?.complaint;

  return (
    <Modal
      open={!!detail}
      onClose={onClose}
      align="top"
      className="max-w-2xl bg-card rounded-2xl ring-1 ring-rule shadow-lift max-h-[85vh] overflow-y-auto"
    >
      {c && (
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[12px] text-navy-mid">{c.brand_name}</div>
              <h3 className="font-display text-xl font-bold text-ink mt-0.5">{c.title}</h3>
            </div>
            <button onClick={onClose} className="text-navy-mid hover:text-ink">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[12px]">
            <Chip>
              {c.rating ?? "—"} <Star className="size-3 fill-amber-400 text-amber-400" />
            </Chip>
            <Chip>{c.scenario ? (scenarioLabels.get(c.scenario) ?? c.scenario) : "—"}</Chip>
            <Chip>{c.language.toUpperCase()}</Chip>
            <Chip>{c.status}</Chip>
            <Chip>{c.generated_by ?? "insan"}</Chip>
            <Chip>{c.is_public ? "yayında" : "yayında değil"}</Chip>
          </div>

          <div className="rounded-xl bg-surface p-4 text-[13.5px] text-navy whitespace-pre-line">
            {c.body}
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12.5px] text-navy-mid">
            <div>
              Yazar: <span className="text-ink">{c.anon_name ?? "—"}</span>
            </div>
            <div>
              Oluşturma: <span className="text-ink">{fmtDate(c.created_at)}</span>
            </div>
            <div>
              İlk yanıt süresi:{" "}
              <span className="text-ink">
                {c.first_response_minutes ? `${c.first_response_minutes} dk` : "—"}
              </span>
            </div>
            <div>
              Bot: <span className="text-ink">{detail?.run?.provider ?? "—"}</span>
              {detail?.run && ` (${detail.run.trigger} · ${detail.run.status})`}
            </div>
          </div>

          {c.bot_error && (
            <div className="rounded-xl bg-danger-soft/40 ring-1 ring-danger/30 p-3 text-[12.5px] text-ink">
              <b>Son hata:</b> {c.bot_error}
            </div>
          )}

          <div>
            <div className="text-[12px] font-medium text-navy-mid mb-1">
              Marka yanıtı (elle düzenlenebilir)
            </div>
            <textarea
              rows={5}
              value={responseDraft}
              onChange={(e) => setResponseDraft(e.target.value)}
              placeholder="Yanıt üretilmedi — buraya yazıp kaydedebilirsiniz."
              className="w-full rounded-lg ring-1 ring-rule p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={busy}
              className="h-10 rounded-lg bg-brand text-brand-foreground px-5 text-sm font-semibold disabled:opacity-60"
            >
              Yanıtı kaydet
            </button>
            <button
              onClick={() => onDelete(c.id)}
              className="h-10 rounded-lg ring-1 ring-rule px-4 text-sm font-semibold text-danger hover:bg-danger-soft/40"
            >
              Sil
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface ring-1 ring-rule px-2.5 h-7 font-medium text-navy">
      {children}
    </span>
  );
}

function GenerateModal({
  open,
  onClose,
  brands,
  options,
  defaultBrand,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  options: Options | null;
  defaultBrand: string;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [scenario, setScenario] = useState("");
  const [rating, setRating] = useState("");
  const [language, setLanguage] = useState("");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(defaultBrand ? [defaultBrand] : []);
  }, [open, defaultBrand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllVisible() {
    setSelected((prev) => [...new Set([...prev, ...filtered.map((b) => b.id)])]);
  }

  function clearAll() {
    setSelected([]);
  }

  async function submit() {
    if (!selected.length) return toast.error("En az bir marka seçin");
    setBusy(true);
    const res = await apiSendJson<{
      brands: number;
      complaints: number;
      responses: number;
      duplicates: number;
      reason: string | null;
      results?: { brand_name: string; complaints: number; status: string; reason: string | null }[];
    }>("/api/admin/bot/generate", "POST", {
      brandIds: selected,
      scenario: scenario || undefined,
      rating: rating ? Number(rating) : undefined,
      language: language || undefined,
      count,
    });
    setBusy(false);
    if (!res) return;
    if (res.complaints === 0) {
      toast.warning(res.reason ?? "Şikayet üretilemedi (kopya tespiti olabilir)");
    } else if (res.brands > 1) {
      const ok = res.results?.filter((r) => r.complaints > 0).length ?? 0;
      toast.success(
        `${res.brands} markadan ${ok} tanesine toplam ${res.complaints} şikayet, ${res.responses} yanıt üretildi`,
      );
    } else {
      toast.success(`${res.complaints} şikayet, ${res.responses} yanıt üretildi`);
    }
    onDone();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg bg-card rounded-2xl p-6 shadow-lift">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-5 text-brand" />
        <h3 className="font-display text-lg font-bold text-ink">Manuel şikayet üret</h3>
        <button onClick={onClose} className="ml-auto text-navy-mid hover:text-ink">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[12px] font-medium text-navy-mid">
              Markalar ({selected.length} seçili)
            </span>
            <div className="flex gap-2 text-[11px]">
              <button type="button" onClick={selectAllVisible} className="text-brand hover:underline">
                Görünenleri seç
              </button>
              <button type="button" onClick={clearAll} className="text-navy-mid hover:underline">
                Temizle
              </button>
            </div>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Marka ara…"
            className="w-full h-9 rounded-lg ring-1 ring-rule px-3 text-sm bg-card mb-2"
          />
          <div className="max-h-44 overflow-y-auto rounded-lg ring-1 ring-rule divide-y divide-rule">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-navy-mid text-center">Marka bulunamadı</p>
            ) : (
              filtered.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-surface/80"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(b.id)}
                    onChange={() => toggle(b.id)}
                    className="rounded border-rule text-brand focus:ring-brand/40"
                  />
                  <span className="truncate text-ink">{b.name}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 1 && (
            <p className="mt-1.5 text-[11px] text-navy-mid">
              Seçili {selected.length} markaya aynı anda şikayet yazılır (marka başına {count} adet).
            </p>
          )}
        </div>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
        >
          <option value="">Kategori: rastgele</option>
          {(options?.scenarios ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
        >
          <option value="">Puan: ayarlara göre</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} yıldız
            </option>
          ))}
        </select>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
        >
          <option value="">Dil: ayarlara göre</option>
          {(options?.languages ?? []).map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
        <label className="block">
          <span className="text-[12px] font-medium text-navy-mid">
            Marka başına adet (en fazla 10)
          </span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 w-full h-10 rounded-lg ring-1 ring-rule px-3 text-sm bg-card"
          />
        </label>
      </div>

      <button
        onClick={submit}
        disabled={busy || !selected.length}
        className="mt-5 w-full h-11 rounded-lg bg-brand text-brand-foreground text-sm font-semibold disabled:opacity-60"
      >
        {busy
          ? selected.length > 1
            ? `${selected.length} markaya yazılıyor…`
            : "Üretiliyor…"
          : selected.length > 1
            ? `${selected.length} markaya üret`
            : "Üret"}
      </button>
    </Modal>
  );
}
