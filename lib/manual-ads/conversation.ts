import type { ManualAdChatMessage, ManualAdConversationState, ManualAdCreativeAttachment } from "./types";
import {
  hasManualAdCreativeAttachments,
  inferManualAdCreativeFormatFromAttachments,
  summarizeManualAdCreativeAttachments,
} from "./creative-assets";
import {
  getManualAdPromptByKey,
  MANUAL_AD_INTERVIEW_PROMPTS,
  buildManualAdConversationOpening,
  type ManualAdConversationOpeningContext,
  type ManualAdPromptDefinition,
  type ManualAdPromptKey,
} from "./prompts";

type ManualAdReply = {
  content: string;
  metadata: {
    kind: "seed" | "prompt" | "reply";
    promptGroup?: ManualAdPromptDefinition["group"];
    promptKey?: ManualAdPromptKey;
    stateSnapshot?: ManualAdConversationState;
    readyToReport: boolean;
    missingFields: string[];
  };
};

const UNKNOWN_PATTERNS = /^(?:bilmiyorum|bilemiyorum|emin değilim|emin degilim|belli değil|belli degil|belirsiz|yok)$/i;

function cloneState(state: ManualAdConversationState): ManualAdConversationState {
  return {
    ...state,
    knownIssues: state.knownIssues ? [...state.knownIssues] : [],
    promptAnswers: state.promptAnswers ? { ...state.promptAnswers } : {},
    missingFields: [...state.missingFields],
  };
}

function isUnknownAnswer(answer: string) {
  return UNKNOWN_PATTERNS.test(answer.trim());
}

function normalizeAnswer(answer: string) {
  return answer.trim();
}

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabeledValue(answer: string, labels: string[]) {
  const normalizedLabels = labels.map((label) => normalizeLabel(label));
  const lines = answer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:：\-–—]+?)\s*[:：\-–—]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = normalizeLabel(match[1]);
    if (normalizedLabels.some((candidate) => label === candidate || label.includes(candidate) || candidate.includes(label))) {
      return match[2].trim();
    }
  }

  return null;
}

function appendSection(base: string | undefined, label: string, value: string) {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return base?.trim() || undefined;
  }

  const line = `${label}: ${cleanValue}`;
  if (!base || !base.trim()) {
    return line;
  }

  return `${base.trim()}\n${line}`;
}

function parseNumber(answer: string) {
  const match = answer.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(answer: string) {
  const number = parseNumber(answer);
  if (number === null) {
    return null;
  }
  return Math.max(0, Math.round(number));
}

function parseCreativeFormat(answer: string): ManualAdConversationState["creativeFormat"] {
  const lower = answer.toLowerCase();
  if (lower.includes("carousel") || lower.includes("karusel") || lower.includes("carous")) {
    return "carousel";
  }
  if (lower.includes("video") || lower.includes("reel") || lower.includes("story")) {
    return "video";
  }
  if (lower.includes("görsel") || lower.includes("gorsel") || lower.includes("foto") || lower.includes("image")) {
    return "image";
  }
  return "unknown";
}

function parseAudienceTemperature(answer: string): ManualAdConversationState["audienceTemperature"] {
  const lower = answer.toLowerCase();
  if (lower.includes("soğuk") || lower.includes("soguk") || lower.includes("cold")) {
    return "cold";
  }
  if (lower.includes("sıcak") || lower.includes("sicak") || lower.includes("hot")) {
    return "hot";
  }
  if (lower.includes("mixed") || lower.includes("karma") || lower.includes("karışık") || lower.includes("karisik")) {
    return "mixed";
  }
  if (lower.includes("warm") || lower.includes("ılık") || lower.includes("ilik")) {
    return "warm";
  }
  return "unknown";
}

export function createInitialManualAdConversationState(
  overrides: Partial<ManualAdConversationState> = {}
): ManualAdConversationState {
  const state: ManualAdConversationState = {
    knownIssues: overrides.knownIssues ? [...overrides.knownIssues] : [],
    promptAnswers: { ...(overrides.promptAnswers ?? {}) },
    missingFields: [],
    ...overrides,
  };

  state.knownIssues = state.knownIssues ? [...state.knownIssues] : [];
  state.promptAnswers = { ...(state.promptAnswers ?? {}) };
  state.missingFields = getManualAdMissingFields(state);
  return state;
}

export function getManualAdMissingFields(state: ManualAdConversationState) {
  return MANUAL_AD_INTERVIEW_PROMPTS
    .filter((prompt) => {
      const answer = state.promptAnswers?.[prompt.key];
      return answer === undefined || answer === null || answer.trim().length === 0;
    })
    .map((prompt) => prompt.label);
}

export function isManualAdReadyForReport(state: ManualAdConversationState) {
  return MANUAL_AD_INTERVIEW_PROMPTS.every((prompt) => {
    const answer = state.promptAnswers?.[prompt.key];
    return typeof answer === "string" && answer.trim().length > 0;
  });
}

function applyPromptAnswer(
  state: ManualAdConversationState,
  prompt: ManualAdPromptDefinition,
  rawAnswer: string,
  attachments?: ManualAdCreativeAttachment[] | null
) {
  const nextState = cloneState(state);
  const answer = normalizeAnswer(rawAnswer);
  const unknown = isUnknownAnswer(answer);
  const hasAttachments = hasManualAdCreativeAttachments(attachments);

  if (hasAttachments) {
    const attachmentSummary = summarizeManualAdCreativeAttachments(attachments);
    const attachmentFormat = inferManualAdCreativeFormatFromAttachments(attachments);
    nextState.creativeDescription = appendSection(
      nextState.creativeDescription,
      "Yüklenen kreatif",
      attachmentSummary ?? "Kreatif dosyası yüklendi."
    );
    if (attachmentFormat && attachmentFormat !== "unknown" && (!nextState.creativeFormat || nextState.creativeFormat === "unknown")) {
      nextState.creativeFormat = attachmentFormat;
    }
  }

  const attachmentSummary = hasAttachments ? summarizeManualAdCreativeAttachments(attachments) : null;
  nextState.promptAnswers ??= {};
  const attachmentAnswer = hasAttachments && prompt.group === "creative" ? attachmentSummary ?? "Kreatif yüklendi." : null;
  nextState.promptAnswers[prompt.key] =
    unknown && !hasAttachments
      ? null
      : answer.length > 0
        ? answer
        : attachmentAnswer;

  switch (prompt.key) {
    case "creative_format":
      {
        const parsedFormat = parseCreativeFormat(answer);
        if (parsedFormat !== "unknown") {
          nextState.creativeFormat = parsedFormat;
        } else if (unknown && !hasAttachments) {
          nextState.creativeFormat = "unknown";
        }
      }
      nextState.creativeDescription = appendSection(
        nextState.creativeDescription,
        "Kreatif notu",
        unknown ? "" : answer
      );
      break;
    case "creative_visibility":
      nextState.creativeDescription = appendSection(nextState.creativeDescription, "İlk saniye görünürlüğü", answer);
      break;
    case "creative_benefit":
      nextState.creativeDescription = appendSection(nextState.creativeDescription, "Vaat / fayda", answer);
      break;
    case "creative_social_proof":
      nextState.creativeDescription = appendSection(nextState.creativeDescription, "Sosyal kanıt", answer);
      break;
    case "copy_headline":
      nextState.adHeadline = extractLabeledValue(answer, ["başlık", "headline"]) ?? (unknown ? undefined : answer);
      nextState.adCopy = appendSection(
        nextState.adCopy,
        "Reklam metni",
        extractLabeledValue(answer, ["ana metin", "metin", "body", "copy"]) ?? (unknown ? "" : answer)
      );
      nextState.callToAction = extractLabeledValue(answer, ["cta", "call to action", "harekete geçirici mesaj"]) ?? nextState.callToAction;
      nextState.offer = extractLabeledValue(answer, ["teklif", "indirim", "kampanya", "aciliyet"]) ?? nextState.offer;
      break;
    case "copy_body":
      nextState.adCopy = unknown ? undefined : answer;
      break;
    case "copy_cta":
      nextState.callToAction = unknown ? undefined : answer;
      break;
    case "copy_offer":
      nextState.offer = unknown ? undefined : answer;
      break;
    case "audience_target":
      nextState.targetAudience = appendSection(
        nextState.targetAudience,
        "Hedef kitle",
        extractLabeledValue(answer, ["hedef kitle", "kimlere gösterildi", "kitle", "audience", "target"]) ?? (unknown ? "" : answer)
      );
      {
        const parsedTemperature = parseAudienceTemperature(answer);
        if (parsedTemperature !== "unknown") {
          nextState.audienceTemperature = parsedTemperature;
        } else if (unknown) {
          nextState.audienceTemperature = "unknown";
        }
      }
      break;
    case "audience_temperature":
      nextState.audienceTemperature = unknown ? "unknown" : parseAudienceTemperature(answer);
      break;
    case "audience_targeting":
      nextState.targetAudience = appendSection(nextState.targetAudience, "Hedefleme", answer);
      break;
    case "audience_demographics":
      nextState.targetAudience = appendSection(nextState.targetAudience, "Demografi", answer);
      break;
    case "budget_daily":
      nextState.dailyBudget =
        parseNumber(extractLabeledValue(answer, ["günlük bütçe", "budget", "harcama"]) ?? answer) ?? nextState.dailyBudget;
      break;
    case "budget_duration":
      nextState.testDurationDays =
        parseInteger(extractLabeledValue(answer, ["test süresi", "kaç gün", "süre", "duration"]) ?? answer) ?? nextState.testDurationDays;
      break;
    case "budget_scaling":
      nextState.scalingMethod = appendSection(
        nextState.scalingMethod,
        "Ölçekleme",
        extractLabeledValue(answer, ["ölçekleme", "scale", "artırma", "azaltma"]) ?? (unknown ? "" : answer)
      );
      break;
    case "budget_cuts":
      nextState.scalingMethod = appendSection(nextState.scalingMethod, "Kötü reklamları kapatma", answer);
      break;
    case "landing_product":
      nextState.landingPageNotes = appendSection(
        nextState.landingPageNotes,
        "Ürün",
        extractLabeledValue(answer, ["ürün", "product"]) ?? (unknown ? "" : answer)
      );
      nextState.landingPageNotes = appendSection(
        nextState.landingPageNotes,
        "Fiyat / marj",
        extractLabeledValue(answer, ["fiyat", "price", "kâr marjı", "kar marji", "marj", "profit"]) ?? ""
      );
      nextState.landingPageNotes = appendSection(
        nextState.landingPageNotes,
        "Güven / kargo / iade",
        extractLabeledValue(answer, ["güven", "yorum", "kargo", "iade", "trust"]) ?? ""
      );
      nextState.landingPageNotes = appendSection(
        nextState.landingPageNotes,
        "Takılma noktası",
        extractLabeledValue(answer, ["takılma", "takilma", "dropoff", "sürtünme", "surtunme"]) ?? ""
      );
      break;
    case "landing_price_margin":
      nextState.landingPageNotes = appendSection(nextState.landingPageNotes, "Fiyat / marj", answer);
      break;
    case "landing_trust":
      nextState.landingPageNotes = appendSection(nextState.landingPageNotes, "Güven / kargo / iade", answer);
      break;
    case "landing_dropoff":
      nextState.landingPageNotes = appendSection(nextState.landingPageNotes, "Takılma noktası", answer);
      break;
  }

  nextState.missingFields = getManualAdMissingFields(nextState);
  return nextState;
}

export function buildManualAdConversationState(messages: ManualAdChatMessage[]) {
  let state = createInitialManualAdConversationState();
  let currentPromptKey: ManualAdPromptKey | null = null;

  for (const message of messages) {
    if (message.role === "assistant") {
      if (message.metadata?.stateSnapshot) {
        state = createInitialManualAdConversationState(message.metadata.stateSnapshot);
      }
      const nextPromptKey = message.metadata?.promptKey;
      if (nextPromptKey && getManualAdPromptByKey(nextPromptKey as ManualAdPromptKey)) {
        currentPromptKey = nextPromptKey as ManualAdPromptKey;
      }
      continue;
    }

    if (message.role !== "user" || !currentPromptKey) {
      continue;
    }

    const prompt = getManualAdPromptByKey(currentPromptKey);
    if (!prompt) {
      continue;
    }

    state = applyPromptAnswer(
      state,
      prompt,
      message.content,
      Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : null
    );
  }

  state.missingFields = getManualAdMissingFields(state);
  return state;
}

function getNextPromptFromState(state: ManualAdConversationState) {
  return MANUAL_AD_INTERVIEW_PROMPTS.find((prompt) => {
    const answer = state.promptAnswers?.[prompt.key];
    return answer === undefined || answer === null || answer.trim().length === 0;
  }) ?? null;
}

export function buildManualAdSeedReply(
  initialState?: Partial<ManualAdConversationState>,
  openingContext?: ManualAdConversationOpeningContext
) {
  const state = createInitialManualAdConversationState(initialState);
  const reply = buildManualAdAssistantReply(state);
  return {
    content: buildManualAdConversationOpening(openingContext, state),
    metadata: {
      ...reply.metadata,
      kind: "seed" as const,
      stateSnapshot: state,
    },
  };
}

export function buildManualAdAssistantReply(state: ManualAdConversationState): ManualAdReply {
  const nextPrompt = getNextPromptFromState(state);
  if (!nextPrompt) {
    return {
      content: "Güzel, kritik bağlamı topladım. İstersen şimdi analiz raporunu oluşturabilirim.",
      metadata: {
        kind: "reply",
        readyToReport: true,
        missingFields: state.missingFields,
        stateSnapshot: state,
      },
    };
  }

  return {
    content: `Not ettim. ${nextPrompt.question}`,
    metadata: {
      kind: "prompt",
      promptGroup: nextPrompt.group,
      promptKey: nextPrompt.key,
      readyToReport: isManualAdReadyForReport(state),
      missingFields: state.missingFields,
      stateSnapshot: state,
    },
  };
}
