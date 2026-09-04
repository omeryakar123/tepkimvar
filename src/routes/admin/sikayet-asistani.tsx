import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bot, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/sikayet-asistani")({
  component: ComplaintAssistantAdminPage,
});

const INPUT =
  "w-full rounded-lg ring-1 ring-rule px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand/40";

type Config = {
  greeting: string;
  systemPrompt: string;
  finalizePrompt: string;
  customInstructions: string;
  temperature: number;
  maxTokens: number;
};

type Payload = {
  config: Config;
  defaults: Config;
  ai: { configured: boolean; provider: string };
};

function ComplaintAssistantAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [defaults, setDefaults] = useState<Config | null>(null);
  const [ai, setAi] = useState<Payload["ai"] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiGet<Payload>("/api/admin/complaint-assistant");
    setLoading(false);
    if (data) {
      setConfig(data.config);
      setDefaults(data.defaults);
      setAi(data.ai);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    const ok = await apiSend("/api/admin/complaint-assistant", "PATCH", config);
    setSaving(false);
    if (ok) {
      toast.success("Şikayet asistanı ayarları kaydedildi");
      await load();
    }
  }

  function resetField(key: keyof Config) {
    if (!defaults) return;
    setConfig((c) => (c ? { ...c, [key]: defaults[key] } : c));
  }

  if (loading || !config) {
    return (
      <div className="px-6 lg:px-10 py-16 grid place-items-center text-navy-mid">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-4xl">
      <div className="flex items-start gap-3 mb-6">
        <span className="grid place-items-center size-11 rounded-xl bg-brand-soft text-brand ring-1 ring-brand/15 shrink-0">
          <Sparkles className="size-5" />
        </span>
        <div>
          <div className="eyebrow text-navy-mid">Admin</div>
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-ink">
            Şikayet Yazma Asistanı
          </h1>
          <p className="mt-1 text-[14px] text-navy-mid leading-relaxed">
            Kullanıcıların şikayet yazarken konuştuğu yapay zeka asistanının davranışını buradan
            eğitin ve özelleştirin.
          </p>
        </div>
      </div>

      <div
        className={`rounded-2xl ring-1 p-4 sm:p-5 mb-6 text-[13px] ${
          ai?.configured
            ? "bg-brand-soft/40 ring-brand/20 text-navy"
            : "bg-warning-soft ring-warning/30 text-warning"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="size-4 shrink-0" />
          {ai?.configured ? (
            <>AI aktif — {ai.provider}</>
          ) : (
            <>AI yapılandırılmadı — şablon modu kullanılıyor</>
          )}
        </div>
        {!ai?.configured && (
          <p className="mt-2 leading-relaxed">
            Coolify ortam değişkenlerine <b>AI_API_KEY</b> (OpenAI: sk-…) ve{" "}
            <b>AI_PROVIDER=openai</b> ekleyin. Anahtar olmadan asistan profesyonel yanıt veremez.
          </p>
        )}
      </div>

      <div className="space-y-5">
        <Field
          label="Karşılama mesajı"
          hint="Kullanıcı sohbete başladığında görünen ilk mesaj."
          onReset={() => resetField("greeting")}
        >
          <textarea
            rows={3}
            value={config.greeting}
            onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
            className={`${INPUT} resize-y min-h-[80px]`}
          />
        </Field>

        <Field
          label="Sistem talimatı (sohbet)"
          hint="Asistanın her mesajda uyması gereken ana kurallar."
          onReset={() => resetField("systemPrompt")}
        >
          <textarea
            rows={12}
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            className={`${INPUT} resize-y font-mono text-[12px] leading-relaxed min-h-[200px]`}
          />
        </Field>

        <Field
          label="Sistem talimatı (özet / finalize)"
          hint="Kullanıcı «Hayır» dediğinde nihai metni oluştururken kullanılır."
          onReset={() => resetField("finalizePrompt")}
        >
          <textarea
            rows={8}
            value={config.finalizePrompt}
            onChange={(e) => setConfig({ ...config, finalizePrompt: e.target.value })}
            className={`${INPUT} resize-y font-mono text-[12px] leading-relaxed min-h-[140px]`}
          />
        </Field>

        <Field
          label="Ek talimatlar"
          hint="İsteğe bağlı — yukarıdaki talimatlara eklenir."
          onReset={() => resetField("customInstructions")}
        >
          <textarea
            rows={4}
            value={config.customInstructions}
            onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
            placeholder="Örn: Bahis sitelerinde çekim sorunlarına öncelik ver…"
            className={`${INPUT} resize-y`}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sıcaklık (temperature)" onReset={() => resetField("temperature")}>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.temperature}
              onChange={(e) =>
                setConfig({ ...config, temperature: Number(e.target.value) || 0.55 })
              }
              className={INPUT}
            />
          </Field>
          <Field label="Maks. token" onReset={() => resetField("maxTokens")}>
            <input
              type="number"
              min={400}
              max={2000}
              step={50}
              value={config.maxTokens}
              onChange={(e) =>
                setConfig({ ...config, maxTokens: Number(e.target.value) || 1100 })
              }
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-brand text-brand-foreground text-[14px] font-semibold disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Kaydet
        </button>
        <button
          type="button"
          onClick={() => defaults && setConfig(defaults)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full ring-1 ring-rule text-[14px] font-semibold hover:bg-surface"
        >
          <RotateCcw className="size-4" /> Varsayılana dön
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl ring-1 ring-rule p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[13px] font-semibold text-ink">{label}</div>
          {hint ? <p className="text-[12px] text-navy-mid mt-0.5">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-semibold text-brand hover:underline shrink-0"
        >
          Sıfırla
        </button>
      </div>
      {children}
    </div>
  );
}
