import { formatCurrency, formatNumber } from "@/lib/formatters";

import { evaluateManualAdDecision, getManualAdDecisionLabel, type ManualAdDecisionEvaluation } from "./decision-engine";
import {
  buildManualAdGeminiInlineDataParts,
  collectManualAdCreativeAttachments,
  summarizeManualAdCreativeAttachments,
  type ManualAdGeminiInlineDataPart,
} from "./creative-assets";
import { calculateManualAdMetrics } from "./metrics";
import { buildManualAdPerformanceLead, buildManualAdReportPrompt, MANUAL_AD_REPORT_RESPONSE_SCHEMA } from "./prompts";
import type {
  ManualAdCampaign,
  ManualAdChatMessage,
  ManualAdConversationState,
  ManualAdDecision,
  ManualAdMetrics,
  ManualAdReportAnalysis,
  ManualAdReportRecommendations,
} from "./types";
import { MANUAL_AD_CREATIVE_FORMAT_LABELS } from "./types";

type GeminiReportResponse = {
  analysis?: Partial<ManualAdReportAnalysis>;
  recommendations?: Partial<ManualAdReportRecommendations>;
};

const ENGLISH_MARKERS = [
  " the ",
  " and ",
  " with ",
  " for ",
  " from ",
  " this ",
  " that ",
  " your ",
  " should ",
  " budget ",
  " creative ",
  " audience ",
  " landing ",
  " report ",
  " analysis ",
  " performance ",
  " strong ",
  " weak ",
  " data ",
  " campaign ",
  " product ",
  " revenue ",
  " increase ",
  " decrease ",
  " pause ",
  " scale ",
];

const TURKISH_MARKERS = [
  " ve ",
  " bu ",
  " su ",
  " için ",
  " icin ",
  " ile ",
  " reklam ",
  " kampanya ",
  " urun ",
  " ürün ",
  " satis ",
  " satış ",
  " gorunuyor ",
  " görünüyor ",
  " guclu ",
  " güçlü ",
  " zayif ",
  " zayıf ",
  " veri ",
  " butce ",
  " bütçe ",
  " kitle ",
  " hedefleme ",
  " sayfa ",
  " teklif ",
  " fiyat ",
  " karar ",
  " sinyal ",
  " karlilik ",
  " karlilik ",
];

export type ManualAdGeneratedReport = {
  decision: ManualAdDecision;
  score: number;
  summary: string;
  metrics: ManualAdMetrics;
  conversationState: ManualAdConversationState;
  analysis: ManualAdReportAnalysis;
  recommendations: ManualAdReportRecommendations;
  aiModel: string | null;
  fallbackUsed: boolean;
};

type ManualAdReportInput = {
  campaign: ManualAdCampaign;
  metrics: ManualAdMetrics;
  decision: ManualAdDecisionEvaluation;
  revenueSource: "manual" | "estimated_from_product" | "missing";
  conversationState: ManualAdConversationState;
  messages: ManualAdChatMessage[];
};

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLanguageSample(value: string) {
  return ` ${value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function countMarkerHits(sample: string, markers: string[]) {
  return markers.reduce((count, marker) => (sample.includes(marker) ? count + 1 : count), 0);
}

export function looksLikeEnglishReportText(values: Array<string | null | undefined>) {
  const combined = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (combined.trim().length < 32) {
    return false;
  }

  const sample = normalizeLanguageSample(combined);
  const englishHits = countMarkerHits(sample, ENGLISH_MARKERS);
  const turkishHits = countMarkerHits(sample, TURKISH_MARKERS);

  return englishHits >= 5 && englishHits > turkishHits + 2;
}

function formatMoney(value: number | null | undefined) {
  const numeric = safeNumber(value);
  return numeric === null ? "bilinmiyor" : formatCurrency(numeric);
}

function formatCount(value: number | null | undefined) {
  const numeric = safeNumber(value);
  return numeric === null ? "bilinmiyor" : formatNumber(numeric);
}

function mentionMissingData(input: ManualAdReportInput) {
  const notes: string[] = [];

  if (input.metrics.breakEvenCPA === null) {
    notes.push("Ürün başı net kâr eksik olduğu için net kârlılık kesin hesaplanamaz.");
  }

  if (input.campaign.revenueFromAds === null || input.campaign.revenueFromAds === undefined) {
    if (input.campaign.productSalePrice !== null && input.campaign.productSalePrice !== undefined) {
      notes.push("Ciro kullanıcı tarafından girilmedi; seçili ürünün satış fiyatına göre tahmini ciro kullanıldı.");
    } else {
      notes.push("Ciro girişi olmadığı için ROAS yorumu sınırlı kalır.");
    }
  }

  if (input.campaign.productName === null || input.campaign.productName === undefined || input.campaign.productName.trim().length === 0) {
    notes.push("İlgili ürün seçimi eksik.");
  }

  if (input.conversationState.missingFields.length > 0) {
    notes.push(`Eksik bağlam alanları: ${input.conversationState.missingFields.slice(0, 5).join(", ")}.`);
  }

  return notes;
}

function summarizeCreativeContext(state: ManualAdConversationState, creativeAttachmentSummary: string | null) {
  const parts = [
    state.creativeFormat ? `Format: ${MANUAL_AD_CREATIVE_FORMAT_LABELS[state.creativeFormat] ?? state.creativeFormat}` : null,
    state.creativeDescription ? state.creativeDescription : null,
    creativeAttachmentSummary ? `Yüklenen medya: ${creativeAttachmentSummary}` : null,
  ];
  return firstNonEmpty(...parts.filter(Boolean) as string[]);
}

function summarizeCopyContext(state: ManualAdConversationState) {
  const parts = [
    state.adHeadline ? `Başlık: ${state.adHeadline}` : null,
    state.adCopy ? `Ana metin: ${state.adCopy}` : null,
    state.callToAction ? `CTA: ${state.callToAction}` : null,
    state.offer ? `Teklif: ${state.offer}` : null,
  ];
  return firstNonEmpty(...parts.filter(Boolean) as string[]);
}

function summarizeAudienceContext(state: ManualAdConversationState) {
  const parts = [
    state.targetAudience ? `Hedef kitle: ${state.targetAudience}` : null,
    state.audienceTemperature ? `Kitle sıcaklığı: ${state.audienceTemperature}` : null,
  ];
  return firstNonEmpty(...parts.filter(Boolean) as string[]);
}

function summarizeBudgetContext(state: ManualAdConversationState) {
  const parts = [
    typeof state.dailyBudget === "number" ? `Günlük bütçe: ${formatMoney(state.dailyBudget)}` : null,
    typeof state.testDurationDays === "number" ? `Test süresi: ${formatCount(state.testDurationDays)} gün` : null,
    state.scalingMethod ? `Ölçekleme: ${state.scalingMethod}` : null,
  ];
  return firstNonEmpty(...parts.filter(Boolean) as string[]);
}

function summarizeLandingContext(campaign: ManualAdCampaign, state: ManualAdConversationState) {
  const parts = [
    campaign.productName ? `Ürün: ${campaign.productName}` : null,
    typeof campaign.productSalePrice === "number" ? `Ürün satış fiyatı: ${formatMoney(campaign.productSalePrice)}` : null,
    typeof campaign.estimatedProductProfit === "number"
      ? `Ürün başı net kâr: ${formatMoney(campaign.estimatedProductProfit)}`
      : null,
    state.landingPageNotes ? state.landingPageNotes : null,
  ];
  return firstNonEmpty(...parts.filter(Boolean) as string[]);
}

function buildFallbackAnalysis(input: ManualAdReportInput, creativeAttachmentSummary: string | null): ManualAdReportAnalysis {
  const decisionLabel = getManualAdDecisionLabel(input.decision.decision);
  const cpaText = formatMoney(input.metrics.costPerOrder);
  const breakEvenText = formatMoney(input.metrics.breakEvenCPA);
  const roasText = input.metrics.roas === null ? "bilinmiyor" : `${input.metrics.roas.toFixed(2)}x`;
  const profitAfterAdsText =
    input.metrics.estimatedProfitAfterAds === null ? "bilinmiyor" : formatCurrency(input.metrics.estimatedProfitAfterAds);
  const performanceLead = buildManualAdPerformanceLead({
    totalSpend: input.campaign.totalSpend,
    ordersFromAds: input.campaign.ordersFromAds,
    revenueFromAds: input.campaign.revenueFromAds ?? undefined,
    productSalePrice: input.campaign.productSalePrice ?? undefined,
  });
  const creativeContext = summarizeCreativeContext(input.conversationState, creativeAttachmentSummary);
  const copyContext = summarizeCopyContext(input.conversationState);
  const audienceContext = summarizeAudienceContext(input.conversationState);
  const budgetContext = summarizeBudgetContext(input.conversationState);
  const landingContext = summarizeLandingContext(input.campaign, input.conversationState);
  const missingData = mentionMissingData(input);

  return {
    shortDecision: decisionLabel,
    efficiencyAssessment: [
      performanceLead,
      `Sipariş başı reklam maliyeti: ${cpaText}.`,
      input.metrics.breakEvenCPA !== null ? `Break-even CPA: ${breakEvenText}.` : "Break-even CPA hesaplanamadı.",
      input.campaign.revenueFromAds !== null && input.campaign.revenueFromAds !== undefined
        ? `ROAS: ${roasText}.`
        : input.campaign.productSalePrice !== null && input.campaign.productSalePrice !== undefined
          ? `ROAS: ${roasText} (ürün fiyatı bazlı tahmin).`
          : "ROAS yorumu için ciro verisi eksik.",
      input.metrics.estimatedProfitAfterAds !== null
        ? `Tahmini reklam sonrası kâr: ${profitAfterAdsText}.`
        : "Tahmini reklam sonrası kâr hesaplanamadı.",
    ].join(" "),
    decisionRationale: [
      input.decision.summary,
      input.decision.reasons.length > 0 ? `Gerekçeler: ${input.decision.reasons.join(" ")}` : null,
    ]
      .filter(Boolean)
      .join(" "),
    creativeCommentary: creativeContext
      ? `Kreatif tarafında gelen sinyal: ${creativeContext}.`
      : "Kreatif bağlamı yetersiz; format, ilk saniye görünürlüğü ve sosyal kanıt detayları eksik.",
    copyCommentary: copyContext
      ? `Reklam metni notları: ${copyContext}.`
      : "Reklam metni tarafında başlık, ana metin ve CTA bağlamı sınırlı.",
    audienceCommentary: audienceContext
      ? `Hedef kitle notları: ${audienceContext}.`
      : "Hedef kitle bağlamı zayıf; soğuk/sıcak ayrımı ve hedefleme tipi net değil.",
    budgetCommentary: budgetContext
      ? `Bütçe ve ölçekleme notları: ${budgetContext}.`
      : "Bütçe testi, test süresi ve ölçekleme şekli hakkında yeterli bilgi yok.",
    landingPageCommentary: landingContext
      ? `Satış sayfası / ürün notları: ${landingContext}.`
      : "Ürün, fiyat, marj ve açılış sayfası güven unsurları eksik.",
    riskNotes: uniqueStrings([
      ...input.decision.riskNotes,
      ...missingData,
      input.metrics.dataQuality === "low" ? "Veri kalitesi düşük; önce test tasarımını düzelt." : null,
    ]),
    nextActions: uniqueStrings([
      ...input.decision.nextActions,
      input.conversationState.missingFields.length > 0
        ? `Önce eksik bilgileri tamamla: ${input.conversationState.missingFields.slice(0, 3).join(", ")}.`
        : null,
      "Kreatif, metin ve açılış sayfası bağlamını tek bir test planında toparla.",
    ]),
  };
}

function buildFallbackRecommendations(input: ManualAdReportInput): ManualAdReportRecommendations {
  const breakEvenCPA = input.metrics.breakEvenCPA;
  const scaleThreshold = breakEvenCPA !== null ? breakEvenCPA * 0.6 : null;
  const conservativeThreshold = breakEvenCPA !== null ? breakEvenCPA * 0.85 : null;

  let budgetPlan = "Şimdilik bütçeyi sabit tut ve test verisini artır.";
  if (input.decision.decision === "scale") {
    budgetPlan = "Bütçeyi %20-30 kademeli artır; tek seferde sert sıçrama yapma.";
  } else if (input.decision.decision === "keep_testing") {
    budgetPlan = "Aynı bütçeyle testi sürdür; yaratıcı varyasyonları ayrıştır.";
  } else if (input.decision.decision === "reduce_budget") {
    budgetPlan = "Bütçeyi %20-40 azalt ve en zayıf reklam setlerini kapat.";
  } else if (input.decision.decision === "pause") {
    budgetPlan = "Kampanyayı durdur; kreatif, teklif veya açılış sayfası sorununu düzelt.";
  } else if (input.decision.decision === "insufficient_data") {
    budgetPlan = "Bütçe kararını ertele; önce test tasarımını ve veri kalitesini tamamla.";
  }

  const creativeAngles = uniqueStrings([
    input.conversationState.creativeFormat === "video" ? "Kısa video demo ve ilk saniyede ürün gösterimi" : null,
    input.conversationState.creativeFormat === "image" ? "Statik görselde tek fayda odağı ve net ürün kadrajı" : null,
    "Sosyal kanıt ve yorum ekran görüntüsü odaklı varyasyon",
    "Önce / sonra veya kullanım anı gösteren varyasyon",
    "Fayda + aciliyet + teklif odaklı varyasyon",
  ]).slice(0, 3);

  const copyAngles = uniqueStrings([
    input.conversationState.adHeadline ? `Başlıkta mevcut yapıdan türetilmiş fayda vurgusu: ${input.conversationState.adHeadline}` : null,
    "Net fayda ve sonuç odaklı başlık",
    "Güven ve sosyal kanıt odaklı metin",
    "Kampanya / aciliyet ve CTA odaklı metin",
  ]).slice(0, 3);

  const minimumTestDays =
    input.decision.decision === "scale"
      ? 3
      : input.decision.decision === "keep_testing"
        ? 5
        : input.decision.decision === "reduce_budget"
          ? 5
          : input.decision.decision === "pause"
            ? 7
            : 7;

  const successCriteriaParts = [
    breakEvenCPA !== null ? `CPA'yı ${formatMoney(scaleThreshold ?? conservativeThreshold ?? breakEvenCPA)} altına indir.` : "CPA için net kâr verisini tamamla.",
    input.campaign.ordersFromAds > 0 ? "Sipariş sayısını en az 3 yeni sipariş ile artır." : "İlk 3 siparişi alacak test sinyali üret.",
    input.campaign.revenueFromAds !== null && input.campaign.revenueFromAds !== undefined
      ? "ROAS'ı destekleyici sinyal olarak izle ama tek başına karar verme."
      : null,
  ];

  return {
    budgetPlan,
    creativeAngles,
    copyAngles,
    minimumTestDays,
    successCriteria: uniqueStrings(successCriteriaParts).join(" "),
    nextActions: uniqueStrings([
      ...input.decision.nextActions,
      "Bir sonraki testte kreatif formatını ve vaat açısını tek tek değiştir.",
      "Landing page güven unsurlarını ve teklif netliğini ayrı bir değişken olarak test et.",
    ]),
  };
}

function normalizeAnalysis(
  fallback: ManualAdReportAnalysis,
  maybeAnalysis: Partial<ManualAdReportAnalysis> | undefined,
  decisionLabel: string
): ManualAdReportAnalysis {
  return {
    shortDecision: decisionLabel,
    efficiencyAssessment: firstNonEmpty(maybeAnalysis?.efficiencyAssessment, fallback.efficiencyAssessment),
    decisionRationale: firstNonEmpty(maybeAnalysis?.decisionRationale, fallback.decisionRationale),
    creativeCommentary: firstNonEmpty(maybeAnalysis?.creativeCommentary, fallback.creativeCommentary),
    copyCommentary: firstNonEmpty(maybeAnalysis?.copyCommentary, fallback.copyCommentary),
    audienceCommentary: firstNonEmpty(maybeAnalysis?.audienceCommentary, fallback.audienceCommentary),
    budgetCommentary: firstNonEmpty(maybeAnalysis?.budgetCommentary, fallback.budgetCommentary),
    landingPageCommentary: firstNonEmpty(maybeAnalysis?.landingPageCommentary, fallback.landingPageCommentary),
    riskNotes: uniqueStrings([
      ...(maybeAnalysis?.riskNotes ?? []),
      ...fallback.riskNotes,
    ]),
    nextActions: uniqueStrings([
      ...(maybeAnalysis?.nextActions ?? []),
      ...fallback.nextActions,
    ]),
  };
}

function normalizeRecommendations(
  fallback: ManualAdReportRecommendations,
  maybeRecommendations: Partial<ManualAdReportRecommendations> | undefined
): ManualAdReportRecommendations {
  const minimumTestDays =
    typeof maybeRecommendations?.minimumTestDays === "number" && Number.isFinite(maybeRecommendations.minimumTestDays)
      ? Math.max(1, Math.round(maybeRecommendations.minimumTestDays))
      : fallback.minimumTestDays;

  return {
    budgetPlan: firstNonEmpty(maybeRecommendations?.budgetPlan, fallback.budgetPlan),
    creativeAngles: uniqueStrings([...(maybeRecommendations?.creativeAngles ?? []), ...fallback.creativeAngles]).slice(0, 3),
    copyAngles: uniqueStrings([...(maybeRecommendations?.copyAngles ?? []), ...fallback.copyAngles]).slice(0, 3),
    minimumTestDays,
    successCriteria: firstNonEmpty(maybeRecommendations?.successCriteria, fallback.successCriteria),
    nextActions: uniqueStrings([...(maybeRecommendations?.nextActions ?? []), ...fallback.nextActions]),
  };
}

async function callGeminiReport(promptText: string, inlineDataParts: ManualAdGeminiInlineDataPart[] = []) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (!geminiApiKey) {
    return null;
  }

  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  const timeoutMs = Math.max(10_000, Number(process.env.GEMINI_TIMEOUT_SECONDS ?? "25") * 1000 || 25_000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }, ...inlineDataParts],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: MANUAL_AD_REPORT_RESPONSE_SCHEMA,
          temperature: 0.2,
          topP: 0.9,
          topK: 32,
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload?.error === "object" && payload.error && "message" in payload.error
        ? String((payload.error as { message?: unknown }).message ?? "Gemini request failed")
        : "Gemini request failed";
      throw new Error(message);
    }

    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const firstCandidate = candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as Record<string, unknown>) : null;
    const content = firstCandidate && typeof firstCandidate.content === "object" ? (firstCandidate.content as Record<string, unknown>) : null;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    const rawText = parts
      .map((part) => (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string"
        ? String((part as Record<string, unknown>).text)
        : ""))
      .join("")
      .trim();

    if (!rawText) {
      throw new Error("Gemini response did not contain text.");
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as GeminiReportResponse;
    return {
      parsed,
      model: geminiModel,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateManualAdReport(input: ManualAdReportInput): Promise<ManualAdGeneratedReport> {
  const ruleBasedDecisionLabel = getManualAdDecisionLabel(input.decision.decision);
  const creativeAttachments = collectManualAdCreativeAttachments(input.messages);
  const creativeAttachmentSummary = summarizeManualAdCreativeAttachments(creativeAttachments);
  const creativeInlineParts = buildManualAdGeminiInlineDataParts(creativeAttachments);
  const fallbackAnalysis = buildFallbackAnalysis(input, creativeAttachmentSummary);
  const fallbackRecommendations = buildFallbackRecommendations(input);

  try {
    const gemini = await callGeminiReport(buildManualAdReportPrompt({
      campaign: input.campaign,
      metrics: input.metrics,
      decisionLabel: ruleBasedDecisionLabel,
      revenueSource: input.revenueSource,
      conversationState: input.conversationState,
      creativeAttachmentsSummary: creativeAttachmentSummary,
      messages: input.messages,
    }), creativeInlineParts);

    if (!gemini?.parsed) {
      return {
        decision: input.decision.decision,
        score: input.decision.score,
        summary: input.decision.summary,
        metrics: input.metrics,
        conversationState: input.conversationState,
        analysis: fallbackAnalysis,
        recommendations: fallbackRecommendations,
        aiModel: null,
        fallbackUsed: true,
      };
    }

    const englishLeakDetected = looksLikeEnglishReportText([
      gemini.parsed.analysis?.shortDecision,
      gemini.parsed.analysis?.efficiencyAssessment,
      gemini.parsed.analysis?.decisionRationale,
      gemini.parsed.analysis?.creativeCommentary,
      gemini.parsed.analysis?.copyCommentary,
      gemini.parsed.analysis?.audienceCommentary,
      gemini.parsed.analysis?.budgetCommentary,
      gemini.parsed.analysis?.landingPageCommentary,
      ...(gemini.parsed.analysis?.riskNotes ?? []),
      ...(gemini.parsed.analysis?.nextActions ?? []),
      gemini.parsed.recommendations?.budgetPlan,
      ...(gemini.parsed.recommendations?.creativeAngles ?? []),
      ...(gemini.parsed.recommendations?.copyAngles ?? []),
      gemini.parsed.recommendations?.successCriteria,
      ...(gemini.parsed.recommendations?.nextActions ?? []),
    ]);

    if (englishLeakDetected) {
      return {
        decision: input.decision.decision,
        score: input.decision.score,
        summary: input.decision.summary,
        metrics: input.metrics,
        conversationState: input.conversationState,
        analysis: fallbackAnalysis,
        recommendations: fallbackRecommendations,
        aiModel: null,
        fallbackUsed: true,
      };
    }

    return {
      decision: input.decision.decision,
      score: input.decision.score,
      summary: input.decision.summary,
      metrics: input.metrics,
      conversationState: input.conversationState,
      analysis: normalizeAnalysis(fallbackAnalysis, gemini.parsed.analysis, ruleBasedDecisionLabel),
      recommendations: normalizeRecommendations(fallbackRecommendations, gemini.parsed.recommendations),
      aiModel: gemini.model,
      fallbackUsed: false,
    };
  } catch {
    return {
      decision: input.decision.decision,
      score: input.decision.score,
      summary: input.decision.summary,
      metrics: input.metrics,
      conversationState: input.conversationState,
      analysis: fallbackAnalysis,
      recommendations: fallbackRecommendations,
      aiModel: null,
      fallbackUsed: true,
    };
  }
}

export function evaluateAndGenerateManualAdReport(
  campaign: ManualAdCampaign,
  conversationState: ManualAdConversationState,
  messages: ManualAdChatMessage[]
) {
  const metrics = calculateManualAdMetrics(campaign, conversationState);
  const decision = evaluateManualAdDecision(campaign, metrics, conversationState);
  return generateManualAdReport({
    campaign,
    metrics,
    decision,
    revenueSource:
      campaign.revenueFromAds !== null && campaign.revenueFromAds !== undefined
        ? "manual"
        : campaign.productSalePrice !== null && campaign.productSalePrice !== undefined
          ? "estimated_from_product"
          : "missing",
    conversationState,
    messages,
  });
}
