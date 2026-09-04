import { chatCompleteJson, isAiConfigured } from "@/lib/server/ai/client";
import {
  loadComplaintAssistantConfig,
  type ComplaintAssistantConfig,
} from "@/lib/server/complaint-assistant-config";
import {
  buildBodyFromState,
  buildIntakeReply,
  buildTitleFromState,
  computeDraftQuality,
  computeReadyToContinue,
  EMPTY_COMPLAINT_STATE,
  extractStateFromMessage,
  getMissingFields,
  getNextQuestion,
  mergeComplaintState,
  normalizeComplaintState,
  processIntakeMessage,
  replyAsksKnownField,
  type ComplaintState,
} from "@/lib/complaint-intake-state";

export type AssistMessage = { role: "user" | "assistant"; content: string };

export type BrandHint = { id: string; name: string };

export type ComplaintAssistResult = {
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
  aiUsed: boolean;
};

type AiAssistJson = {
  reply?: string;
  title?: string;
  body?: string;
  brandName?: string;
  rating?: number;
  readyToContinue?: boolean;
  draftQuality?: string;
  missingFields?: string[];
  state?: Partial<ComplaintState>;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, "");
}

function matchBrand(text: string, brands: BrandHint[]): BrandHint | null {
  const n = normalize(text);
  if (!n) return null;
  let best: BrandHint | null = null;
  let bestLen = 0;
  for (const b of brands) {
    const bn = normalize(b.name);
    if (bn.length < 3) continue;
    if (n.includes(bn) && bn.length > bestLen) {
      best = b;
      bestLen = bn.length;
    }
  }
  return best;
}

function matchBrandFromState(state: ComplaintState, brands: BrandHint[]): BrandHint | null {
  if (!state.brandName) return null;
  return (
    brands.find((b) => normalize(b.name) === normalize(state.brandName!)) ??
    matchBrand(state.brandName, brands)
  );
}

function lastUserMessage(messages: AssistMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content.trim();
  }
  return "";
}

function applyStateBrandFromDb(state: ComplaintState, brands: BrandHint[]): ComplaintState {
  const hit = matchBrandFromState(state, brands);
  if (hit) return { ...state, brandName: hit.name };
  return state;
}

function stateFromAiPatch(
  prev: ComplaintState,
  raw: Partial<ComplaintState> | undefined,
  brands: BrandHint[],
): ComplaintState {
  if (!raw) return prev;
  const merged = mergeComplaintState(prev, raw);
  if (raw.brandName && !matchBrandFromState(merged, brands)) {
    const hit = matchBrand(raw.brandName, brands);
    if (hit) return { ...merged, brandName: hit.name };
  }
  return applyStateBrandFromDb(merged, brands);
}

function sanitizeReply(raw: string, state: ComplaintState, body: string, fallback: string): string {
  const reply = raw.trim();
  if (!reply || reply.length < 10) return fallback;
  if (replyAsksKnownField(reply, state)) return fallback;
  if (state.brandName && normalize(reply) === normalize(state.brandName)) return fallback;
  if (reply.length < 40 && !reply.includes("?") && !reply.includes(".") && !reply.includes(",")) {
    return fallback;
  }
  return reply;
}

function buildSystemPrompt(
  config: ComplaintAssistantConfig,
  mode: "chat" | "finalize",
  brandList: string,
  state: ComplaintState,
): string {
  const base = mode === "finalize" ? config.finalizePrompt : config.systemPrompt;
  const extra = config.customInstructions.trim();
  const stateBlock = JSON.stringify(state, null, 2);
  return `${base}${extra ? `\n\nEk talimatlar:\n${extra}` : ""}

MEVCUT complaintState (temel gerçeklik — tekrar sorma, varsayma):
${stateBlock}

Markalar (eşleştir): ${brandList || "—"}`;
}

function ruleBasedAssist(input: {
  messages: AssistMessage[];
  brands: BrandHint[];
  complaintState: ComplaintState;
  currentTitle?: string;
  currentBody?: string;
  mode?: "chat" | "finalize";
}): ComplaintAssistResult {
  const lastMsg = lastUserMessage(input.messages);
  const state = applyStateBrandFromDb(normalizeComplaintState(input.complaintState), input.brands);

  const brand = matchBrandFromState(state, input.brands);

  let body = buildBodyFromState(state);
  const currentBody = (input.currentBody ?? "").trim();
  if (currentBody.length > body.length && currentBody.length >= lastMsg.length) {
    body = currentBody;
  }

  let title = (input.currentTitle ?? "").trim();
  if (!title) title = buildTitleFromState(state, body);

  const fallbackReply =
    input.mode === "finalize"
      ? "Anlattıklarınızı düzenledim. Özeti kontrol edin; uygunsa onaylayarak devam edebilirsiniz."
      : buildIntakeReply(state, body, lastMsg);

  const reply = input.mode === "finalize" ? fallbackReply : buildIntakeReply(state, body, lastMsg);

  const missingFields = getMissingFields(state, body);
  const readyToContinue =
    input.mode === "finalize" ? body.length >= 80 : computeReadyToContinue(state, body);
  const draftQuality = computeDraftQuality(state, body);

  return {
    reply,
    title: title.slice(0, 200),
    body: body.slice(0, 5000),
    suggestedBrandName: brand?.name ?? state.brandName,
    suggestedBrandId: brand?.id ?? null,
    suggestedRating: readyToContinue ? 1 : null,
    readyToContinue,
    draftQuality,
    missingFields,
    state,
    aiUsed: false,
  };
}

export async function assistComplaintDraft(input: {
  messages: AssistMessage[];
  brands: BrandHint[];
  complaintState?: ComplaintState;
  currentTitle?: string;
  currentBody?: string;
  mode?: "chat" | "finalize";
}): Promise<ComplaintAssistResult> {
  const brands = input.brands.slice(0, 200);
  const mode = input.mode ?? "chat";
  const config = await loadComplaintAssistantConfig();
  const lastMsg = lastUserMessage(input.messages);

  let state = normalizeComplaintState(input.complaintState ?? EMPTY_COMPLAINT_STATE);
  if (lastMsg) {
    state = processIntakeMessage({ message: lastMsg, complaintState: state, brands });
  }
  state = applyStateBrandFromDb(state, brands);

  const fallback = () =>
    ruleBasedAssist({
      messages: input.messages,
      brands,
      complaintState: state,
      currentTitle: input.currentTitle,
      currentBody: input.currentBody,
      mode,
    });

  if (!isAiConfigured() || (mode === "chat" && lastMsg.length < 1 && input.messages.length <= 1)) {
    return fallback();
  }

  const brandList = brands.map((b) => b.name).slice(0, 80).join(", ");

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(config, mode, brandList, state) },
    {
      role: "user",
      content: `Güncel complaintState:\n${JSON.stringify(state)}\n\nSon kullanıcı mesajı:\n${lastMsg || "(yok)"}\n\nÖnce state güncelle, sonra en fazla bir soru sor veya taslak hazırla.`,
    },
    ...input.messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const raw = await chatCompleteJson<AiAssistJson>({
      messages: aiMessages,
      temperature: mode === "finalize" ? Math.min(config.temperature, 0.5) : config.temperature,
      maxTokens: config.maxTokens,
    });

    const ruleExtract = lastMsg ? extractStateFromMessage(lastMsg, state, brands) : {};
    let nextState = stateFromAiPatch(state, raw.state, brands);
    nextState = mergeComplaintState(nextState, ruleExtract);
    nextState = applyStateBrandFromDb(nextState, brands);

    const brand = matchBrandFromState(nextState, brands);

    let body = (raw.body ?? "").trim();
    const stateBody = buildBodyFromState(nextState);
    if (!body || body.length < stateBody.length * 0.6) body = stateBody;
    const currentBody = (input.currentBody ?? "").trim();
    if (mode === "chat" && currentBody.length > body.length && currentBody.length >= lastMsg.length) {
      body = currentBody;
    }
    body = body.slice(0, 5000);

    let title = (raw.title ?? input.currentTitle ?? "").trim();
    if (!title) title = buildTitleFromState(nextState, body);

    const fallbackReply =
      mode === "finalize"
        ? "Anlattıklarınızı düzenledim. Özeti kontrol edin; uygunsa onaylayarak devam edebilirsiniz."
        : buildIntakeReply(nextState, body, lastMsg);

    let reply = sanitizeReply(raw.reply ?? "", nextState, body, fallbackReply);

    if (mode === "chat") {
      const question = getNextQuestion(nextState, body);
      if (question && replyAsksKnownField(reply, nextState)) reply = question;
      if (!computeReadyToContinue(nextState, body) && question && !reply.includes("?")) {
        reply = question;
      }
    }

    const missingFields = Array.isArray(raw.missingFields)
      ? raw.missingFields.map(String)
      : getMissingFields(nextState, body);

    const readyToContinue =
      mode === "finalize" ? body.length >= 80 : computeReadyToContinue(nextState, body);

    const quality = (["draft", "good", "excellent"] as const).includes(
      raw.draftQuality as ComplaintAssistResult["draftQuality"],
    )
      ? (raw.draftQuality as ComplaintAssistResult["draftQuality"])
      : computeDraftQuality(nextState, body);

    return {
      reply,
      title: title.slice(0, 200),
      body,
      suggestedBrandName: brand?.name ?? nextState.brandName,
      suggestedBrandId: brand?.id ?? null,
      suggestedRating:
        typeof raw.rating === "number" && raw.rating >= 1 && raw.rating <= 5
          ? Math.round(raw.rating)
          : readyToContinue
            ? 1
            : null,
      readyToContinue,
      draftQuality: quality,
      missingFields,
      state: nextState,
      aiUsed: true,
    };
  } catch {
    return fallback();
  }
}

export async function getComplaintAssistantGreeting(): Promise<string> {
  const config = await loadComplaintAssistantConfig();
  return config.greeting;
}

export { EMPTY_COMPLAINT_STATE, type ComplaintState };
