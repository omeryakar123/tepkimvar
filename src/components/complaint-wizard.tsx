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
import { SiteLogoMark, SiteLogoTitle } from "@/components/site-logo-mark";
import { looksLikeFakePlatformUsername } from "@/lib/platform-username";
import { EMPTY_COMPLAINT_STATE, logComplaintDebug, rebuildStateFromMessages, type ComplaintState } from "@/lib/complaint-intake-state";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };

type WizardStep = 1 | 2 | 3;
type Step1Phase = "chat" | "summary";

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
  state: ComplaintState;
};

const STEPS: { n: WizardStep; label: string; short: string }[] = [
  { n: 1, label: "Şikayet Detayı", short: "Detay" },
  { n: 2, label: "Marka", short: "Marka" },
  { n: 3, label: "Belge", short: "Belge" },
];

const MORE_PROMPT =
  "Başka eklemek istediğiniz bir detay var mı? Yoksa «Hayır» yazarak düzenlenmiş özeti hazırlayabilirim.";

function isDecliningMore(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[.!?,]/g, "");
  if (t.length > 100) return false;
  return (
    /^(hayır|hayir|yok|tamam|devam|onay|onaylıyorum|onayliyorum|bu kadar|yeter|ok|olur|istemiyorum|gerek yok|teşekkürler|tesekkurler|hayır teşekkür|hayir tesekkur)/.test(t) ||
    /eklemek istemiyorum|başka (bir )?şey yok|baska (bir )?sey yok|^(hayır|hayir) .*(yok|gerek)/.test(t)
  );
}

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
  const [step1Phase, setStep1Phase] = useState<Step1Phase>("chat");
  const [awaitingMoreConfirmation, setAwaitingMoreConfirmation] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [greetingLoaded, setGreetingLoaded] = useState(false);

  const [brandId, setBrandId] = useState(initialBrandId);
  const [categoryId, setCategoryId] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");
  const [rating, setRating] = useState(0);

  const [files, setFiles] = useState<AcceptedFile[]>([]);
  const [kvkk, setKvkk] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [draftQuality, setDraftQuality] = useState<AssistResponse["draftQuality"]>("draft");
  const [detectedBrandName, setDetectedBrandName] = useState<string | null>(null);
  const [complaintState, setComplaintState] = useState<ComplaintState>(EMPTY_COMPLAINT_STATE);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const complaintStateRef = useRef<ComplaintState>(EMPTY_COMPLAINT_STATE);
  const assistInFlightRef = useRef(false);
  const greetingFetchedRef = useRef(false);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) ?? null,
    [brands, brandId],
  );

  const sidebarBrandLabel = selectedBrand?.name ?? detectedBrandName;

  useEffect(() => {
    complaintStateRef.current = complaintState;
  }, [complaintState]);

  useEffect(() => {
    if (step !== 1 || step1Phase !== "chat") return;
    const el = chatScrollRef.current;
    if (!el || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, aiLoading, step, step1Phase]);

  useEffect(() => {
    if (greetingFetchedRef.current) return;
    greetingFetchedRef.current = true;

    let cancelled = false;
    fetch("/api/complaints/assist")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { greeting?: string } | null) => {
        if (cancelled) return;
        const text =
          j?.greeting?.trim() ||
          "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın.";
        setMessages((prev) => (prev.length === 0 ? [{ role: "bot", text }] : prev));
        setGreetingLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages((prev) =>
            prev.length === 0
              ? [
                  {
                    role: "bot",
                    text: "Merhaba. Hangi site veya markayla sorun yaşadınız? Kısaca anlatın.",
                  },
                ]
              : prev,
          );
          setGreetingLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function runAssist(
    nextMessages: ChatMessage[],
    options?: { mode?: "chat" | "finalize"; complaintState?: ComplaintState },
  ) {
    if (assistInFlightRef.current) return;
    assistInFlightRef.current = true;
    setAiLoading(true);

    const stateForApi = options?.complaintState ?? complaintStateRef.current;

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));

      logComplaintDebug("client request", {
        userMessage: apiMessages.filter((m) => m.role === "user").at(-1)?.content,
        complaintState: stateForApi,
        historyLength: apiMessages.length,
        mode: options?.mode ?? "chat",
      });

      const res = await fetch("/api/complaints/assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          brands,
          complaintState: stateForApi,
          currentTitle: title,
          currentBody: body,
          mode: options?.mode ?? "chat",
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
      if (json.state) {
        setComplaintState(json.state);
        complaintStateRef.current = json.state;
      }

      logComplaintDebug("client response", {
        state: json.state,
        reply: json.reply,
        readyToContinue: json.readyToContinue,
      });

      if (options?.mode === "finalize") {
        setStep1Phase("summary");
        setAwaitingMoreConfirmation(false);
        setMessages((prev) => [...prev, { role: "bot", text: json.reply }]);
        return;
      }

      if (json.readyToContinue && !awaitingMoreConfirmation) {
        setAwaitingMoreConfirmation(true);
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: json.reply },
          { role: "bot", text: MORE_PROMPT },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: json.reply }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Asistan hatası");
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Bağlantı sorunu yaşadım. Lütfen sorununuzu biraz daha detaylı yazın.",
        },
      ]);
    } finally {
      assistInFlightRef.current = false;
      setAiLoading(false);
    }
  }

  function handleChatSend() {
    const text = chatInput.trim();
    if (!text || aiLoading || assistInFlightRef.current) return;

    shouldAutoScrollRef.current = true;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setChatInput("");

    const brandHints = brands.map((b) => ({ id: b.id, name: b.name }));
    const historyForState = nextMessages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));
    const updatedState = rebuildStateFromMessages(historyForState, brandHints);
    setComplaintState(updatedState);
    complaintStateRef.current = updatedState;

    requestAnimationFrame(() => {
      chatInputRef.current?.focus({ preventScroll: true });
    });

    if (step1Phase === "summary" && /^(onay|onaylıyorum|onayliyorum|evet|tamam|kabul|uygun)/i.test(text)) {
      if (validateStep1()) setStep(2);
      return;
    }

    if (awaitingMoreConfirmation && isDecliningMore(text)) {
      void runAssist(nextMessages, { mode: "finalize", complaintState: updatedState });
      return;
    }

    if (awaitingMoreConfirmation) {
      setAwaitingMoreConfirmation(false);
    }

    void runAssist(nextMessages, { complaintState: updatedState });
  }

  function approveSummary() {
    if (!validateStep1()) return;
    setStep(2);
  }

  function backToChat() {
    setStep1Phase("chat");
    setAwaitingMoreConfirmation(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: "Tamam, eklemek veya değiştirmek istediğiniz bir şey varsa yazabilirsiniz.",
      },
    ]);
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
    if (step === 1) {
      if (step1Phase !== "summary") return;
      if (!validateStep1()) return;
    }
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      if (!validateStep3()) return;
      void submitComplaint();
      return;
    }
    setStep((s) => (s + 1) as WizardStep);
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  const submitComplaint = useCallback(async () => {
      setSubmitting(true);
      try {
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
          fd.append("visibility", "super_admin_only");

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
            platformUsername: platformUsername.trim(),
            rating,
            attachmentIds,
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
    [files, title, body, brandId, categoryId, platformUsername, rating, onSuccess],
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-surface via-surface to-brand-soft/20 overscroll-none">
      <div className="mx-auto max-w-6xl px-2 sm:px-6 py-3 sm:py-6 lg:py-10">
        {/* Mobil adım göstergesi */}
        <div className="lg:hidden mb-4 rounded-2xl bg-[oklch(0.22_0.03_262)] px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <SiteLogoMark tone="on-dark" linked />
            <span className="text-[12px] font-semibold text-white/70">
              Adım {step}/3
            </span>
          </div>
          <div className="flex gap-2">
            {STEPS.map(({ n }) => {
              const done = step > n;
              const active = step === n;
              return (
                <div
                  key={n}
                  className={cn(
                    "flex-1 rounded-full h-1.5 transition",
                    done && "bg-brand",
                    active && !done && "bg-white",
                    !done && !active && "bg-white/20",
                  )}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[13px] font-semibold text-white">
            {STEPS.find((s) => s.n === step)?.label}
          </p>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-0 min-h-[calc(100dvh-5.5rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[640px] rounded-[18px] sm:rounded-[28px] overflow-hidden shadow-lift ring-1 ring-rule">
          {/* Sidebar — sadece masaüstü */}
          <aside className="hidden lg:flex bg-[oklch(0.22_0.03_262)] text-white p-6 lg:p-8 flex-col">
            <SiteLogoMark tone="on-dark" linked className="mb-8" />

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

            <p className="mt-6 text-[11px] text-white/40 leading-relaxed">
              Şikayetiniz moderasyon onayından sonra yayına alınır. Kanıt dosyası zorunludur.
            </p>
          </aside>

          {/* Ana panel */}
          <div
            ref={panelRef}
            className="bg-card flex flex-col min-h-0 lg:min-h-[520px] h-[calc(100dvh-5.5rem)] sm:h-auto max-h-[100dvh] sm:max-h-none overflow-hidden"
          >
            <header className="hidden sm:flex items-center justify-between gap-4 px-5 sm:px-8 py-3 sm:py-4 border-b border-rule shrink-0">
              <SiteLogoTitle className="text-[15px] lg:hidden gap-0" />
              <div className="flex items-center gap-4 text-[13px] text-navy-mid ml-auto">
                <Link to="/sikayetler" className="hover:text-brand">Şikayetler</Link>
                <span className="text-rule">|</span>
                <Link to="/markalar" className="hover:text-brand">Markalar</Link>
              </div>
            </header>

            <div
              className={cn(
                "flex-1 min-h-0",
                step === 1 ? "flex flex-col overflow-hidden" : "overflow-y-auto px-3 sm:px-8 py-4 sm:py-6",
              )}
            >
              {loadingMeta || !greetingLoaded ? (
                <div className="grid place-items-center h-48 text-navy-mid">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : step === 1 ? (
                <StepDetail
                  phase={step1Phase}
                  messages={messages}
                  chatInput={chatInput}
                  onChatInput={setChatInput}
                  onChatSend={handleChatSend}
                  title={title}
                  body={body}
                  chatEndRef={chatEndRef}
                  chatScrollRef={chatScrollRef}
                  chatInputRef={chatInputRef}
                  onChatScroll={() => {
                    const el = chatScrollRef.current;
                    if (!el) return;
                    shouldAutoScrollRef.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  aiLoading={aiLoading}
                  draftQuality={draftQuality}
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
                  kvkk={kvkk}
                  onKvkk={setKvkk}
                  submitting={submitting}
                  selectedBrand={selectedBrand}
                />
              )}
            </div>

            <footer
              className={cn(
                "px-3 sm:px-8 py-3 sm:py-4 border-t border-rule flex items-center justify-between gap-3 bg-card/95 backdrop-blur-sm shrink-0 safe-area-pb",
                step === 1 && step1Phase === "chat" && "hidden sm:flex",
              )}
            >
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full ring-1 ring-rule text-[13px] font-semibold text-navy hover:bg-surface disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" /> Geri
                </button>
              ) : step1Phase === "summary" ? (
                <button
                  type="button"
                  onClick={backToChat}
                  disabled={submitting || aiLoading}
                  className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full ring-1 ring-rule text-[13px] font-semibold text-navy hover:bg-surface disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" /> Düzenle
                </button>
              ) : (
                <div />
              )}

              {step === 1 && step1Phase === "chat" ? null : (
                <button
                  type="button"
                  onClick={step === 1 ? approveSummary : step === 3 ? submitComplaint : goNext}
                  disabled={submitting || (step === 1 && aiLoading)}
                  className="inline-flex items-center gap-2 h-10 sm:h-11 px-5 sm:px-6 rounded-full bg-brand text-brand-foreground text-[13px] sm:text-[14px] font-semibold hover:brightness-105 disabled:opacity-60 ml-auto shrink-0"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {step === 3 ? (
                    <>Gönder <Send className="size-4" /></>
                  ) : step === 1 ? (
                    <>Onaylıyorum <Check className="size-4" /></>
                  ) : (
                    <>Devam Et <ArrowRight className="size-4" /></>
                  )}
                </button>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDetail({
  phase,
  messages,
  chatInput,
  onChatInput,
  onChatSend,
  title,
  body,
  chatEndRef,
  chatScrollRef,
  chatInputRef,
  onChatScroll,
  aiLoading,
  draftQuality,
}: {
  phase: Step1Phase;
  messages: ChatMessage[];
  chatInput: string;
  onChatInput: (v: string) => void;
  onChatSend: () => void;
  title: string;
  body: string;
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  onChatScroll: () => void;
  aiLoading: boolean;
  draftQuality: AssistResponse["draftQuality"];
}) {
  if (phase === "summary") {
    return (
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full min-h-0 px-3 sm:px-8 py-4 sm:py-6 overflow-y-auto">
        <div className="space-y-4 pb-4">
          <div className="rounded-2xl ring-1 ring-brand/25 bg-brand-soft/30 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-brand shrink-0" />
              <p className="text-[12px] font-semibold uppercase tracking-wider text-brand">
                Düzenlenmiş şikayet özeti
              </p>
            </div>
            <h3 className="font-display text-[17px] sm:text-[18px] font-bold text-ink leading-snug">
              {title || "Başlık hazırlanıyor…"}
            </h3>
            <p className="mt-3 text-[14px] text-navy leading-relaxed whitespace-pre-wrap">
              {body || "Metin hazırlanıyor…"}
            </p>
            {draftQuality === "excellent" && (
              <p className="mt-3 text-[12px] text-brand font-medium">
                Detaylı ve yayına hazır bir özet.
              </p>
            )}
          </div>

          <p className="text-[13px] text-navy-mid text-center px-2">
            Özet uygunsa «Onaylıyorum» ile marka adımına geçin veya «Düzenle» ile sohbete dönün.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full min-h-0 px-3 sm:px-8 py-3 sm:py-4">
      <div className="shrink-0 mb-3 sm:mb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-[12px] font-semibold text-brand ring-1 ring-brand/15">
          <Sparkles className="size-3.5" /> Yapay zeka asistanı
        </div>
        <p className="mt-2 text-[13px] text-navy-mid leading-relaxed">
          Sorununuzu doğal bir dille anlatın; asistan metni sizin için düzenleyecek.
        </p>
      </div>

      <div
        ref={chatScrollRef}
        onScroll={onChatScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-2xl ring-1 ring-rule bg-surface/50 p-3 sm:p-4 space-y-3 touch-pan-y"
      >
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "bot" && (
              <div className="size-8 rounded-full bg-brand/15 grid place-items-center shrink-0 mt-0.5">
                <Sparkles className="size-4 text-brand" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[88%] sm:max-w-[82%] rounded-2xl px-3.5 sm:px-4 py-2.5 text-[14px] leading-relaxed",
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
            Yanıt hazırlanıyor…
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="shrink-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card border-t border-rule/60 -mx-3 sm:-mx-8 px-3 sm:px-8">
        <label className="sr-only" htmlFor="complaint-chat-input">Mesajınız</label>
        <div className="rounded-2xl border-2 border-brand bg-white shadow-[0_8px_32px_rgba(15,23,42,0.14)] flex items-end gap-2 px-3 py-2.5">
          <textarea
            ref={chatInputRef}
            id="complaint-chat-input"
            value={chatInput}
            onChange={(e) => onChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onChatSend();
              }
            }}
            placeholder="Mesajınızı yazın…"
            disabled={aiLoading}
            rows={2}
            className="flex-1 bg-white text-[15px] sm:text-[14px] text-[#1a2332] placeholder:text-[#64748b] focus:outline-none min-w-0 disabled:opacity-60 py-1.5 resize-none leading-relaxed caret-brand"
            style={{ WebkitTextFillColor: "#1a2332" }}
          />
          <button
            type="button"
            disabled={aiLoading || !chatInput.trim()}
            onClick={onChatSend}
            aria-label="Gönder"
            className="size-11 rounded-xl bg-brand text-brand-foreground grid place-items-center shrink-0 hover:brightness-105 disabled:opacity-50 mb-0.5"
          >
            <Send className="size-4" />
          </button>
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
  kvkk,
  onKvkk,
  submitting,
  selectedBrand,
}: {
  files: AcceptedFile[];
  onFiles: (f: AcceptedFile[]) => void;
  kvkk: boolean;
  onKvkk: (v: boolean) => void;
  submitting: boolean;
  selectedBrand: Brand | null;
}) {
  return (
    <div className="max-w-xl mx-auto space-y-6 px-3 sm:px-0 py-2 sm:py-0">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Kanıt ekleyin</h2>
        <p className="mt-1 text-[13px] text-navy-mid leading-relaxed">
          {selectedBrand ? (
            <>
              <span className="font-semibold text-ink">{selectedBrand.name}</span> ile ilgili ekran
              görüntüsü veya video yükleyin. Moderasyon sonrası kanıtlar herkese açık yayınlanır.
            </>
          ) : (
            <>Sorunu kanıtlayan ekran görüntüsü veya video ekleyin. Onay sonrası herkese açık olur.</>
          )}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-brand/30 bg-brand-soft/25 p-5 sm:p-6">
        <FileDropzone files={files} onChange={onFiles} disabled={submitting} required />
        {files.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 h-11 text-[13px] font-semibold pointer-events-none">
              <ImagePlus className="size-4" /> Görsel veya video ekle
            </span>
            <p className="text-[12px] text-navy-mid max-w-xs">
              Ekran görüntüsü, dekont veya video — en az bir görsel zorunlu
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="rounded-xl bg-surface ring-1 ring-rule px-4 py-3 text-[12px] text-navy-mid leading-relaxed">
          Kanıtlar moderasyon onayından sonra şikayet sayfasında herkese açık görünür. Kişisel
          veriler moderasyon ekibi tarafından gizlenebilir.
        </div>
      )}

      <label className="flex items-start gap-3 text-[13px] text-navy cursor-pointer rounded-xl ring-1 ring-rule p-4 bg-card">
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
