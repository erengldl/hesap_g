export type ManualAdPlatform = "meta" | "google" | "tiktok" | "other";

export type ManualAdDecision = "scale" | "keep_testing" | "reduce_budget" | "pause" | "insufficient_data";

export type ManualAdPromptGroup = "creative" | "copy" | "audience" | "budget" | "landing";

export type ManualAdCreativeFormat = "image" | "video" | "carousel" | "unknown";

export type ManualAdCreativeAttachment = {
  kind: "image" | "video";
  name: string;
  sourceMimeType: string;
  previewMimeType: string;
  previewDataUrl: string;
  sourceSize: number;
};

export type ManualAdCampaign = {
  id: string;
  name: string;
  platform: ManualAdPlatform;
  startDate: string;
  endDate: string;
  totalSpend: number;
  ordersFromAds: number;
  revenueFromAds?: number | null;
  productName?: string | null;
  productSalePrice?: number | null;
  estimatedProductCost?: number | null;
  estimatedProductProfit?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManualAdCampaignInput = {
  name: string;
  platform: ManualAdPlatform;
  startDate: string;
  endDate: string;
  totalSpend: number;
  ordersFromAds: number;
  creativeFormat?: ManualAdCreativeFormat | null;
  revenueFromAds?: number | null;
  productName?: string | null;
  productSalePrice?: number | null;
  estimatedProductCost?: number | null;
  estimatedProductProfit?: number | null;
  notes?: string | null;
};

export type ManualAdMetrics = {
  campaignDays: number;
  dailySpend: number;
  costPerOrder: number | null;
  roas: number | null;
  estimatedRevenue: number | null;
  estimatedGrossProfit: number | null;
  estimatedProfitAfterAds: number | null;
  breakEvenCPA: number | null;
  dataQuality: "low" | "medium" | "high";
};

export type ManualAdConversationState = {
  creativeFormat?: "image" | "video" | "carousel" | "unknown";
  creativeDescription?: string;
  adHeadline?: string;
  adCopy?: string;
  callToAction?: string;
  targetAudience?: string;
  audienceTemperature?: "cold" | "warm" | "hot" | "mixed" | "unknown";
  scalingMethod?: string;
  dailyBudget?: number;
  testDurationDays?: number;
  landingPageNotes?: string;
  offer?: string;
  knownIssues?: string[];
  promptAnswers?: Record<string, string | null>;
  missingFields: string[];
};

export type ManualAdChatRole = "user" | "assistant";

export type ManualAdMessageMetadata = {
  kind?: "seed" | "prompt" | "reply" | "report_generated";
  promptGroup?: ManualAdPromptGroup;
  promptKey?: string;
  stateSnapshot?: ManualAdConversationState;
  readyToReport?: boolean;
  missingFields?: string[];
  reportId?: string;
  decision?: ManualAdDecision;
  score?: number;
  aiModel?: string | null;
  attachments?: ManualAdCreativeAttachment[];
};

export type ManualAdChatMessage = {
  id: string;
  campaignId: string;
  role: ManualAdChatRole;
  content: string;
  metadata: ManualAdMessageMetadata | null;
  createdAt: string;
};

export type ManualAdReportAnalysis = {
  shortDecision: string;
  efficiencyAssessment: string;
  decisionRationale: string;
  creativeCommentary: string;
  copyCommentary: string;
  audienceCommentary: string;
  budgetCommentary: string;
  landingPageCommentary: string;
  riskNotes: string[];
  nextActions: string[];
};

export type ManualAdReportRecommendations = {
  budgetPlan: string;
  creativeAngles: string[];
  copyAngles: string[];
  minimumTestDays: number;
  successCriteria: string;
  nextActions: string[];
};

export type ManualAdReport = {
  id: string;
  campaignId: string;
  decision: ManualAdDecision;
  score: number;
  summary: string;
  metrics: ManualAdMetrics;
  conversationState: ManualAdConversationState;
  analysis: ManualAdReportAnalysis;
  recommendations: ManualAdReportRecommendations;
  createdAt: string;
};

export type ManualAdCampaignSummary = ManualAdCampaign & {
  messageCount: number;
  reportCount: number;
  latestDecision: ManualAdDecision | null;
  latestScore: number | null;
  latestSummary: string | null;
  latestReportId: string | null;
  latestReportCreatedAt: string | null;
};

export type ManualAdCampaignDetail = {
  campaign: ManualAdCampaign;
  messages: ManualAdChatMessage[];
  conversationState: ManualAdConversationState;
  latestReport: ManualAdReport | null;
};

export const MANUAL_AD_PLATFORM_LABELS: Record<ManualAdPlatform, string> = {
  meta: "Sosyal",
  google: "Google",
  tiktok: "TikTok",
  other: "Diğer",
};

export const MANUAL_AD_DECISION_LABELS: Record<ManualAdDecision, string> = {
  scale: "Ölçekle",
  keep_testing: "Teste Devam",
  reduce_budget: "Bütçeyi Azalt",
  pause: "Durdur",
  insufficient_data: "Veri Yetersiz",
};

export const MANUAL_AD_CREATIVE_FORMAT_LABELS: Record<ManualAdCreativeFormat, string> = {
  image: "Fotoğraf",
  video: "Video",
  carousel: "Carousel",
  unknown: "Diğer",
};
