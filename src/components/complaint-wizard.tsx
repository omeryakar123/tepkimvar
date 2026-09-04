import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  PenLine,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/combobox";
import { FileDropzone, hasRequiredVisualEvidence, type AcceptedFile } from "@/components/file-dropzone";
import { PhoneOtpModal } from "@/components/phone-otp-modal";
import { SiteLogoMark, SiteLogoTitle } from "@/components/site-logo-mark";
import { looksLikeFakePlatformUsername } from "@/lib/platform-username";
import { toE164Tr } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };

type WizardStep = 1 | 2 | 3;

type ChatMessage = { role: "bot" | "user"; text: string };

type AssistResponse = {
  reply: string;
  title: string;
  body: string;
  suggestedBrandName: string | null;
  suggestedBrandId: string | null;
  suggestedRating: number | null;
  readyToContinue: boolean;
  draftQuality: "draft" | "good" | "excellent";
  missingFields: string[];
};

const STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: "Şikayet Detayı" },
  { n: 2, label: "Marka" },
  { n: 3, label: "Belge" },
];

export type ComplaintWizardResult = {
  id: string;
  publicId: string;
  title: string;
  issues: string[];
};

export function ComplaintWizard({
  initialBrandId = "",
  onSuccess,
}: {
  initialBrandId?: string;
  onSuccess: (result: ComplaintWizardResult) => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Merhaba, hazırsanız başlayalım. Hangi firmayla sorun yaşadınız ve tam olarak ne oldu?",
    },
  ]);

  const [brandId, setBrandId] = useState(initialBrandId);
  const [categoryId, setCategoryId] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");
  const [rating, setRating] = useState(0);

  const [files, setFiles] = useState<AcceptedFile[]>([]);
  const [mediaPrivacy, setMediaPrivacy] = useState<"public" | "brand_only" | "super_admin_only">("public");
  const [kvkk, setKvkk] = useState(false);
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [draftQuality, setDraftQuality] = useState<AssistResponse["draftQuality"]>("draft");
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [detectedBrandName, setDetectedBrandName] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) ?? null,
    [brands, brandId],
  );

  const bodyQuality = useMemo(() => {
    if (draftQuality === "excellent") return { label: "Harika görünüyor", tone: "good" as const };
    if (draftQuality === "good") return { label: "İyi gidiyor", tone: "ok" as const };
    const len = body.trim().length;
    if (len >= 40) return { label: "Biraz daha detay ekleyin", tone: "warn" as const };
    return { label: "En az 20 karakter", tone: "muted" as const };
  }, [body, draftQuality]);

  const sidebarBrandLabel = selectedBrand?.name ?? detectedBrandName;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bRes, cRes] = await Promise.all([
          fetch("/api/brands?limit=500"),
          fetch("/api/categories"),
        ]);
        const bJson = (await bRes.json()) as { items: Brand[] };
        const cJson = (await cRes.json()) as { categories: Category[] };
        if (cancelled) return;
        const bs = (bJson.items ?? []).sort((a, b) => a.name.localeCompare(b.name, "tr"));
        setBrands(bs);
        const cs = cJson.categories ?? [];
        setCats(cs);
        if (cs[0]) setCategoryId(cs[0].id);
        if (initialBrandId) setBrandId(initialBrandId);
      } catch {
        toast.error("Firma/kategori listesi yüklenemedi");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialBrandId]);

  useEffect(() => {
    if (initialBrandId) setBrandId(initialBrandId);
  }, [initialBrandId]);

  async function runAssist(nextMessages: ChatMessage[]) {
    setAiLoading(true);
    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));

      const res = await fetch("/api/complaints/assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          brands,
          currentTitle: title,
          currentBody: body,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as AssistResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Asistan yanıt veremedi");

      if (json.title?.trim()) setTitle(json.title.trim());
      if (json.body?.trim()) setBody(json.body.trim());
      if (json.suggestedBrandId) setBrandId(json.suggestedBrandId);
      if (json.suggestedBrandName) setDetectedBrandName(json.suggestedBrandName);
      if (json.suggestedRating && rating < 1) setRating(json.suggestedRating);
      setDraftQuality(json.draftQuality ?? "draft");
      setReadyToContinue(Boolean(json.readyToContinue));

      setMessages((prev) => [...prev, { role: "bot", text: json.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Asistan hatası");
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Bağlantı sorunu yaşadım. Lütfen sorununuzu biraz daha detaylı yazın veya metin kutusundan düzenleyin.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleChatSend() {
    const text = chatInput.trim();
    if (!text || aiLoading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setChatInput("");
    void runAssist(nextMessages);
  }

  async function polishDraft() {
    if (messages.length <= 1 && !body.trim()) {
      toast.info("Önce sorununuzu birkaç cümleyle anlatın.");
      return;
    }
    await runAssist(messages);
    toast.success("Taslak güncellendi");
  }

  function validateStep1(): boolean {
    if (body.trim().length < 20) {
      toast.error("Şikayet detayı en az 20 karakter olmalı.");
      return false;
    }
    if (title.trim().length < 6) {
      const auto = body.trim().slice(0, 80).split(/[.!?\n]/)[0]?.trim();
      if (auto && auto.length >= 6) setTitle(auto);
      else {
        toast.error("Kısa bir başlık girin (en az 6 karakter).");
        return false;
      }
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!brandId) {
      toast.error("Lütfen bir firma seçin.");
      return false;
    }
    if (!platformUsername.trim() || platformUsername.trim().length < 2) {
      toast.error("Platform kullanıcı adınızı girin.");
      return false;
    }
    if (looksLikeFakePlatformUsername(platformUsername)) {
      toast.error("Lütfen bahis/casino sitesindeki gerçek kullanıcı adınızı yazın.");
      return false;
    }
    if (rating < 1) {
      toast.error("Lütfen 1–5 yıldız puan verin.");
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (files.length === 0) {
      toast.error("En az bir kanıt dosyası zorunludur.");
      return false;
    }
    if (!hasRequiredVisualEvidence(files)) {
      toast.error("En az bir ekran görüntüsü veya video yüklemelisiniz.");
      return false;
    }
    if (!kvkk) {
      toast.error("KVKK onayı zorunludur.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      if (!validateStep3()) return;
      setOtpOpen(true);
      return;
    }
    setStep((s) => (s + 1) as WizardStep);
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  const submitComplaint = useCallback(
    async (verificationId: string, verifiedPhone: string) => {
      setSubmitting(true);
      try {
        const e164 = toE164Tr(verifiedPhone) ?? verifiedPhone;
        const attachmentIds: string[] = [];
        const uploadedFiles = [...files];

        for (let i = 0; i < uploadedFiles.length; i++) {
          const af = uploadedFiles[i];
          af.progress = 15;
          af.error = undefined;
          setFiles([...uploadedFiles]);

          const fd = new FormData();
          fd.append("file", af.file);
          fd.append("folder", "complaint-evidence");
          fd.append("visibility", mediaPrivacy);

          const upRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
          const upJson = (await upRes.json().catch(() => ({}))) as {
            attachmentId?: string;
            error?: string;
          };

          if (!upRes.ok || !upJson.attachmentId) {
            af.error = upJson.error ?? "yüklenemedi";
            af.progress = 0;
            setFiles([...uploadedFiles]);
            throw new Error(`${af.file.name}: ${af.error}`);
          }

          af.attachmentId = upJson.attachmentId;
          attachmentIds.push(upJson.attachmentId);
          af.progress = 100;
          setFiles([...uploadedFiles]);
        }

        const res = await fetch("/api/complaints", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            brandId,
            categoryId: categoryId || null,
            contactPhone: e164,
            platformUsername: platformUsername.trim(),
            rating,
            attachmentIds,
            phoneVerificationId: verificationId,
          }),
        });

        const json = (await res.json()) as {
          id?: string;
          publicId?: string;
          issues?: string[];
          error?: string;
        };

        if (!res.ok || !json.id) throw new Error(json.error ?? "Şikayet oluşturulamadı.");

        onSuccess({
          id: json.id,
          publicId: json.publicId ?? json.id,
          title: title.trim(),
          issues: json.issues ?? [],
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Şikayet oluşturulamadı.");
      } finally {
        setSubmitting(false);
      }
    },
    [files, mediaPrivacy, title, body, brandId, categoryId, platformUsername, rating, onSuccess],
  );

  function handlePhoneVerified(result: { verificationId: string; phone: string }) {
    setPhone(result.phone.replace(/^\+90/, ""));
    setOtpOpen(false);
    void submitComplaint(result.verificationId, result.phone);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 lg:py-10">
        <div className="grid lg:grid-cols-[300px_1fr] gap-0 lg:gap-0 min-h-[640px] rounded-[28px] overflow-hidden shadow-lift ring-1 ring-rule">
          {/* Sidebar */}
          <aside className="bg-[oklch(0.22_0.03_262)] text-white p-6 lg:p-8 flex flex-col">
            <SiteLogoMark size={32} tone="on-dark" linked className="mb-8" />

            <div className="size-14 rounded-2xl bg-brand/90 grid place-items-center mb-5">
              <PenLine className="size-7 text-white" />
            </div>

            {sidebarBrandLabel ? (
              <p className="text-[13px] text-white/70 mb-1">{sidebarBrandLabel} ile ilgili</p>
            ) : null}
            <h1 className="font-display text-2xl lg:text-[1.65rem] font-black tracking-tight leading-tight">
              Şikayet Oluştur
            </h1>

            <ol className="mt-10 space-y-5 flex-1">
              {STEPS.map(({ n, label }) => {
                const done = step > n;
                const active = step === n;
                return (
                  <li key={n} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "size-8 rounded-full grid place-items-center text-[13px] font-bold shrink-0 transition",
                        done && "bg-brand text-white",
                        active && !done && "bg-white text-[oklch(0.22_0.03_262)]",
                        !done && !active && "bg-white/10 text-white/40 ring-1 ring-white/10",
                      )}
                    >
                      {done ? <Check className="size-4" /> : n}
                    </span>
                    <span
                      className={cn(
                        "text-[14px] font-semibold",
                        active ? "text-white" : done ? "text-white/80" : "text-white/35",
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="mt-6 text-[11px] text-white/40 leading-relaxed hidden lg:block">
              Şikayetiniz moderasyon onayından sonra yayına alınır. Kanıt dosyası zorunludur.
            </p>
          </aside>

          {/* Main panel */}
          <div className="bg-card flex flex-col min-h-[520px]">
            <header className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b border-rule">
              <SiteLogoTitle className="text-[15px] lg:hidden" />
              <div className="hidden sm:flex items-center gap-4 text-[13px] text-navy-mid ml-auto">
                <Link to="/sikayetler" className="hover:text-brand">Şikayetler</Link>
                <span className="text-rule">|</span>
                <Link to="/markalar" className="hover:text-brand">Markalar</Link>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
              {loadingMeta ? (
                <div className="grid place-items-center h-48 text-navy-mid">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : step === 1 ? (
                <StepDetail
                  messages={messages}
                  chatInput={chatInput}
                  onChatInput={setChatInput}
                  onChatSend={handleChatSend}
                  title={title}
                  onTitle={setTitle}
                  body={body}
                  onBody={setBody}
                  bodyQuality={bodyQuality}
                  chatEndRef={chatEndRef}
                  aiLoading={aiLoading}
                  onPolish={polishDraft}
                  readyToContinue={readyToContinue}
                />
              ) : step === 2 ? (
                <StepBrand
                  brands={brands}
                  cats={cats}
                  brandId={brandId}
                  onBrandId={setBrandId}
                  categoryId={categoryId}
                  onCategoryId={setCategoryId}
                  platformUsername={platformUsername}
                  onPlatformUsername={setPlatformUsername}
                  rating={rating}
                  onRating={setRating}
                  title={title}
                  body={body}
                  detectedBrandName={detectedBrandName}
                />
              ) : (
                <StepEvidence
                  files={files}
                  onFiles={setFiles}
                  mediaPrivacy={mediaPrivacy}
                  onMediaPrivacy={setMediaPrivacy}
                  kvkk={kvkk}
                  onKvkk={setKvkk}
                  submitting={submitting}
                  selectedBrand={selectedBrand}
                />
              )}
            </div>

            <footer className="px-5 sm:px-8 py-4 border-t border-rule flex items-center justify-between gap-3 bg-card/80 backdrop-blur-sm">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full ring-1 ring-rule text-[13px] font-semibold text-navy hover:bg-surface disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" /> Geri Dön
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand text-brand-foreground text-[14px] font-semibold hover:brightness-105 disabled:opacity-60 ml-auto"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {step === 3 ? (
                  <>Gönder <Send className="size-4" /></>
                ) : (
                  <>Devam Et <ArrowRight className="size-4" /></>
                )}
              </button>
            </footer>
          </div>
        </div>
      </div>

      <PhoneOtpModal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        initialPhone={phone}
        onVerified={handlePhoneVerified}
      />
    </div>
  );
}

function StepDetail({
  messages,
  chatInput,
  onChatInput,
  onChatSend,
  title,
  onTitle,
  body,
  onBody,
  bodyQuality,
  chatEndRef,
  aiLoading,
  onPolish,
  readyToContinue,
}: {
  messages: ChatMessage[];
  chatInput: string;
  onChatInput: (v: string) => void;
  onChatSend: () => void;
  title: string;
  onTitle: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
  bodyQuality: { label: string; tone: "good" | "ok" | "warn" | "muted" };
  chatEndRef: RefObject<HTMLDivElement | null>;
  aiLoading: boolean;
  onPolish: () => void;
  readyToContinue: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Sohbet */}
      <div className="rounded-2xl ring-1 ring-rule bg-surface/40 p-4 space-y-3 max-h-[240px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "bot" && (
              <div className="size-8 rounded-full bg-brand/15 grid place-items-center shrink-0 mt-0.5">
                <Sparkles className="size-4 text-brand" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                m.role === "bot"
                  ? "bg-card text-navy ring-1 ring-rule"
                  : "bg-brand text-brand-foreground",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex items-center gap-2 text-[13px] text-navy-mid pl-10">
            <Loader2 className="size-4 animate-spin text-brand" />
            Şikayetiniz hazırlanıyor…
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Giriş çubuğu */}
      <div className="rounded-full ring-1 ring-rule bg-card flex items-center gap-2 px-3 py-2 shadow-soft">
        <input
          value={chatInput}
          onChange={(e) => onChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), onChatSend())}
          placeholder="Cevabınızı buraya yazın…"
          disabled={aiLoading}
          className="flex-1 bg-transparent text-[14px] focus:outline-none min-w-0 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={aiLoading}
          onClick={onChatSend}
          className="size-10 rounded-full bg-brand text-brand-foreground grid place-items-center shrink-0 hover:brightness-105 disabled:opacity-60"
        >
          <Send className="size-4" />
        </button>
      </div>

      {/* Taslak editör — Şikayetvar tarzı */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPolish}
            disabled={aiLoading}
            className="text-[12px] font-semibold text-brand hover:underline disabled:opacity-50"
          >
            Nasıl Yazılır? — Yapay zeka ile düzenle
          </button>
          {readyToContinue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
              <Check className="size-3" /> Yayına hazır
            </span>
          )}
        </div>

        <div className="rounded-[20px] ring-1 ring-rule bg-card shadow-soft overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 pb-2 border-b border-rule/60">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid">Başlık</label>
            <input
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Örn: Jojobet hesabımdaki 500.000 TL'ye erişemiyorum"
              className="mt-1 w-full h-10 bg-transparent text-[15px] font-semibold text-ink focus:outline-none placeholder:text-navy-mid/50"
            />
          </div>
          <div className="px-4 sm:px-5 py-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-navy-mid">Şikayet detayı</label>
            <textarea
              rows={9}
              value={body}
              onChange={(e) => onBody(e.target.value)}
              placeholder="Yaşadıklarınızı detaylıca anlatın. Tarih, tutar, kullanıcı adınız ve yaptığınız işlemleri ekleyin…"
              className="mt-2 w-full bg-transparent text-[14px] leading-relaxed text-navy focus:outline-none resize-y min-h-[180px] placeholder:text-navy-mid/50"
            />
          </div>
          <div className="px-4 sm:px-5 py-3 border-t border-rule/60 flex items-center justify-between bg-surface/30">
            <span className="text-[11px] text-navy-mid">
              {body.trim().length} karakter · moderasyon öncesi taslak
            </span>
            <div className="flex items-center gap-1.5 text-[12px]">
              {bodyQuality.tone === "good" && <Sparkles className="size-3.5 text-brand" />}
              <span
                className={cn(
                  "font-semibold",
                  bodyQuality.tone === "good" && "text-brand",
                  bodyQuality.tone === "ok" && "text-navy",
                  bodyQuality.tone === "warn" && "text-warning",
                  bodyQuality.tone === "muted" && "text-navy-mid",
                )}
              >
                {bodyQuality.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBrand({
  brands,
  cats,
  brandId,
  onBrandId,
  categoryId,
  onCategoryId,
  platformUsername,
  onPlatformUsername,
  rating,
  onRating,
  title,
  body,
  detectedBrandName,
}: {
  brands: Brand[];
  cats: Category[];
  brandId: string;
  onBrandId: (v: string) => void;
  categoryId: string;
  onCategoryId: (v: string) => void;
  platformUsername: string;
  onPlatformUsername: (v: string) => void;
  rating: number;
  onRating: (n: number) => void;
  title: string;
  body: string;
  detectedBrandName: string | null;
}) {
  const selected = brands.find((b) => b.id === brandId);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Şikayet özeti kartı */}
      {title.trim() && (
        <div className="rounded-2xl ring-1 ring-brand/20 bg-brand-soft/30 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">Şikayet özeti</p>
          <h3 className="font-display text-[16px] font-bold text-ink leading-snug">{title}</h3>
          {body.trim() && (
            <p className="mt-2 text-[13px] text-navy line-clamp-4 leading-relaxed whitespace-pre-wrap">{body}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="font-display text-xl font-bold text-ink">
          {selected?.name ?? detectedBrandName ?? "Marka"} bilgileri
        </h2>
        <p className="mt-1 text-[13px] text-navy-mid leading-relaxed">
          Şikayetinizin doğru firmaya ulaşması için markayı onaylayın ve platform bilgilerinizi girin.
        </p>
      </div>

      <div className="rounded-2xl ring-1 ring-rule bg-surface/40 p-4 sm:p-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-navy-mid">Firma</label>
          <div className="mt-1.5">
            <Combobox
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              value={brandId}
              onChange={onBrandId}
              placeholder="Şikayet ettiğiniz firmayı seçin"
              searchPlaceholder="Firma ara…"
              emptyText="Firma bulunamadı."
            />
          </div>
          {detectedBrandName && !brandId && (
            <p className="mt-1.5 text-[12px] text-brand">
              AI önerisi: <button type="button" className="font-semibold underline" onClick={() => {
                const m = brands.find((b) => b.name.toLowerCase() === detectedBrandName.toLowerCase());
                if (m) onBrandId(m.id);
              }}>{detectedBrandName}</button>
            </p>
          )}
        </div>

        <div>
          <label className="text-[12px] font-medium text-navy-mid">Kategori</label>
          <div className="mt-1.5">
            <Combobox
              options={cats.map((c) => ({ value: c.id, label: c.name }))}
              value={categoryId}
              onChange={onCategoryId}
              placeholder="Kategori seçin"
              searchPlaceholder="Kategori ara…"
              emptyText="Kategori bulunamadı."
            />
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-navy-mid">
            Platform kullanıcı adınız <span className="text-danger">*</span>
          </label>
          <input
            value={platformUsername}
            onChange={(e) => onPlatformUsername(e.target.value)}
            placeholder="Bahis/casino sitesindeki kullanıcı adınız"
            className="mt-1.5 w-full h-11 rounded-xl ring-1 ring-rule px-3 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-navy-mid">
            Deneyim puanınız <span className="text-danger">*</span>
          </label>
          <p className="text-[11px] text-navy-mid mt-0.5">1 = çok kötü, 5 = kabul edilebilir</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onRating(n)}
                className="p-1 rounded hover:bg-surface transition"
                aria-label={`${n} yıldız`}
              >
                <Star
                  className={cn(
                    "size-9",
                    n <= rating ? "fill-amber-400 text-amber-400" : "text-navy-mid/40",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepEvidence({
  files,
  onFiles,
  mediaPrivacy,
  onMediaPrivacy,
  kvkk,
  onKvkk,
  submitting,
  selectedBrand,
}: {
  files: AcceptedFile[];
  onFiles: (f: AcceptedFile[]) => void;
  mediaPrivacy: "public" | "brand_only" | "super_admin_only";
  onMediaPrivacy: (v: "public" | "brand_only" | "super_admin_only") => void;
  kvkk: boolean;
  onKvkk: (v: boolean) => void;
  submitting: boolean;
  selectedBrand: Brand | null;
}) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Çözümü hızlandır</h2>
        <p className="mt-1 text-[13px] text-navy-mid leading-relaxed">
          {selectedBrand ? (
            <>
              <span className="font-semibold text-ink">{selectedBrand.name}</span> ile ilgili elinizde
              olan ekran görüntüsü veya videoları yükleyin. Kanıtsız başvurular kabul edilmez.
            </>
          ) : (
            <>Sorunu kanıtlayan ekran görüntüsü veya video ekleyin.</>
          )}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-brand/25 bg-brand-soft/20 p-4">
        <FileDropzone files={files} onChange={onFiles} disabled={submitting} required />
        {files.length === 0 && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 h-10 text-[13px] font-semibold pointer-events-none">
              <ImagePlus className="size-4" /> Görsel Ekle
            </span>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div>
          <div className="text-[12px] font-medium text-navy-mid mb-1.5">Medya gizliliği</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: "public", label: "Herkese açık" },
                { v: "brand_only", label: "Sadece firma" },
                { v: "super_admin_only", label: "Sadece admin" },
              ] as const
            ).map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => onMediaPrivacy(o.v)}
                className={cn(
                  "h-9 rounded-lg text-[12px] font-medium ring-1",
                  mediaPrivacy === o.v
                    ? "bg-brand text-brand-foreground ring-brand"
                    : "ring-rule hover:bg-surface",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-start gap-3 text-[13px] text-navy cursor-pointer rounded-xl ring-1 ring-rule p-4">
        <input
          type="checkbox"
          checked={kvkk}
          onChange={(e) => onKvkk(e.target.checked)}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>
          KVKK kapsamında{" "}
          <Link to="/kvkk" className="text-brand underline">
            aydınlatma metnini
          </Link>{" "}
          okudum, kişisel verilerimin işlenmesini onaylıyorum.
        </span>
      </label>
    </div>
  );
}
