import { chatCompleteJson, isAiConfigured } from "@/lib/server/ai/client";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  loadComplaintAssistantConfig,
  type ComplaintAssistantConfig,
} from "@/lib/server/complaint-assistant-config";
import {
  buildAcknowledgmentReply,
  buildBodyFromState,
  buildIntakeReply,
  buildTitleFromState,
  computeDraftQuality,
  computeReadyToContinue,
  EMPTY_COMPLAINT_STATE,
  extractStateFromMessage,
  getMissingFields,
  hasMinimumComplaintInfo,
  isFrustratedRepeatMessage,
  logComplaintDebug,
  mergeComplaintState,
  normalizeComplaintState,
  rebuildStateFromMessages,
  replyAsksKnownField,
  type ComplaintState,
} from "@/lib/complaint-intake-state";

export type AssistMessage = { role: "user" | "assistant"; content: string };

export type BrandHint = { id: string; name: string; slug?: string };

let brandCache: { brands: BrandHint[]; at: number } | null = null;
const BRAND_CACHE_MS = 60_000;

async function resolveAssistBrands(clientBrands: BrandHint[]): Promise<BrandHint[]> {
  const now = Date.now();
  if (!brandCache || now - brandCache.at > BRAND_CACHE_MS) {
    const rows = await db
      .select({ id: schema.brands.id, name: schema.brands.name, slug: schema.brands.slug })
      .from(schema.brands)
      .where(eq(schema.brands.isActive, true))
      .limit(800);
    brandCache = {
      brands: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
      at: now,
    };
  }

  const byId = new Map<string, BrandHint>();
  for (const b of brandCache.brands) byId.set(b.id, b);
  for (const b of clientBrands) {
    byId.set(b.id, { id: b.id, name: b.name, slug: b.slug });
  }
  return [...byId.values()];
}

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

/** Sunucu tarafında tek kaynak: tüm kullanıcı mesajlarından state üret, client state ile birleştir. */
function resolveConversationState(
  messages: AssistMessage[],
  clientState: ComplaintState | undefined,
  brands: BrandHint[],
): ComplaintState {
  const fromHistory = rebuildStateFromMessages(messages, brands);
  const merged = mergeComplaintState(fromHistory, normalizeComplaintState(clientState));
  return applyStateBrandFromDb(merged, brands);
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

function pickReply(
  state: ComplaintState,
  body: string,
  lastMsg: string,
  mode: "chat" | "finalize",
  aiReply?: string,
): string {
  if (mode === "finalize") {
    return "Anlattıklarınızı düzenledim. Özeti kontrol edin; uygunsa onaylayarak devam edebilirsiniz.";
  }

  const ruleReply = buildIntakeReply(state, lastMsg, {
    isFrustrated: isFrustratedRepeatMessage(lastMsg),
  });

  const ai = (aiReply ?? "").trim();
  if (ai && !replyAsksKnownField(ai, state) && ai.length >= 20) {
    if (hasMinimumComplaintInfo(state) || !ai.includes("?")) return ai;
  }

  if (hasMinimumComplaintInfo(state)) {
    return ruleReply.includes("?") ? buildAcknowledgmentReply(state) : ruleReply;
  }

  return ruleReply;
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

CURRENT COMPLAINT STATE (doğrulanmış mevcut bilgiler — tekrar sorma, varsayma):
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
  if (currentBody.length > body.length) body = currentBody;

  let title = (input.currentTitle ?? "").trim();
  if (!title) title = buildTitleFromState(state, body);

  const reply = pickReply(state, body, lastMsg, input.mode ?? "chat");
  const missingFields = getMissingFields(state);
  const readyToContinue =
    input.mode === "finalize" ? body.length >= 60 : computeReadyToContinue(state, body);
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
  const brands = await resolveAssistBrands(input.brands.slice(0, 300));
  const mode = input.mode ?? "chat";
  const config = await loadComplaintAssistantConfig();
  const lastMsg = lastUserMessage(input.messages);

  const state = resolveConversationState(input.messages, input.complaintState, brands);

  logComplaintDebug("request", {
    userMessage: lastMsg,
    clientState: input.complaintState ?? EMPTY_COMPLAINT_STATE,
    resolvedState: state,
    historyLength: input.messages.length,
    mode,
  });

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
    const result = fallback();
    logComplaintDebug("response", { aiUsed: false, state: result.state, reply: result.reply });
    return result;
  }

  const brandList = brands.map((b) => b.name).slice(0, 80).join(", ");

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(config, mode, brandList, state) },
    ...input.messages.slice(-12).map((m) => ({
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
    if (!body || body.length < stateBody.length * 0.5) body = stateBody;
    body = body.slice(0, 5000);

    let title = (raw.title ?? input.currentTitle ?? "").trim();
    if (!title) title = buildTitleFromState(nextState, body);

    const reply = pickReply(nextState, body, lastMsg, mode, raw.reply);

    const missingFields = getMissingFields(nextState);
    const readyToContinue =
      mode === "finalize" ? body.length >= 60 : computeReadyToContinue(nextState, body);

    const quality = (["draft", "good", "excellent"] as const).includes(
      raw.draftQuality as ComplaintAssistResult["draftQuality"],
    )
      ? (raw.draftQuality as ComplaintAssistResult["draftQuality"])
      : computeDraftQuality(nextState, body);

    const result: ComplaintAssistResult = {
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

    logComplaintDebug("response", {
      aiUsed: true,
      state: result.state,
      reply: result.reply,
      readyToContinue: result.readyToContinue,
    });

    return result;
  } catch {
    const result = fallback();
    logComplaintDebug("response", { aiUsed: false, fallback: true, state: result.state });
    return result;
  }
}

export async function getComplaintAssistantGreeting(): Promise<string> {
  const config = await loadComplaintAssistantConfig();
  return config.greeting;
}

export { EMPTY_COMPLAINT_STATE, type ComplaintState };
