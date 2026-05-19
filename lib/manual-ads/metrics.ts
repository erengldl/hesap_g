import type { ManualAdCampaign, ManualAdConversationState, ManualAdMetrics } from "./types";

const DAY_IN_MS = 86_400_000;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDateAtUtcStart(dateKey: string) {
  const parsed = new Date(`${dateKey.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getManualAdCampaignDays(startDate: string, endDate: string) {
  const start = parseDateAtUtcStart(startDate);
  const end = parseDateAtUtcStart(endDate);
  if (!start || !end) {
    return 1;
  }

  const diff = Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;
  return Math.max(1, diff);
}

function resolvePerOrderProfit(campaign: ManualAdCampaign) {
  if (campaign.estimatedProductProfit !== null && campaign.estimatedProductProfit !== undefined) {
    return campaign.estimatedProductProfit;
  }

  if (
    campaign.productSalePrice !== null &&
    campaign.productSalePrice !== undefined &&
    campaign.estimatedProductCost !== null &&
    campaign.estimatedProductCost !== undefined
  ) {
    return campaign.productSalePrice - campaign.estimatedProductCost;
  }

  return null;
}

function resolveDataQuality(campaignDays: number, ordersFromAds: number, estimatedRevenue: number | null, breakEvenCPA: number | null) {
  if (campaignDays >= 3 && ordersFromAds >= 3 && (estimatedRevenue !== null || breakEvenCPA !== null)) {
    return "high" as const;
  }

  if (campaignDays >= 2 && ordersFromAds >= 1 && (estimatedRevenue !== null || breakEvenCPA !== null)) {
    return "medium" as const;
  }

  return "low" as const;
}

function resolveCampaignDays(campaign: ManualAdCampaign, conversationState?: ManualAdConversationState | null) {
  const explicitTestDays = conversationState?.testDurationDays;
  if (typeof explicitTestDays === "number" && Number.isFinite(explicitTestDays) && explicitTestDays > 0) {
    return Math.max(1, Math.round(explicitTestDays));
  }

  return getManualAdCampaignDays(campaign.startDate, campaign.endDate);
}

function resolveEstimatedRevenue(campaign: ManualAdCampaign) {
  if (campaign.revenueFromAds !== null && campaign.revenueFromAds !== undefined) {
    return campaign.revenueFromAds;
  }

  if (campaign.productSalePrice !== null && campaign.productSalePrice !== undefined) {
    return round2(campaign.productSalePrice * campaign.ordersFromAds);
  }

  return null;
}

export function calculateManualAdMetrics(campaign: ManualAdCampaign, conversationState?: ManualAdConversationState | null): ManualAdMetrics {
  const campaignDays = resolveCampaignDays(campaign, conversationState);
  const dailySpend = round2(campaign.totalSpend / Math.max(1, campaignDays));
  const costPerOrder = campaign.ordersFromAds > 0 ? round2(campaign.totalSpend / campaign.ordersFromAds) : null;
  const estimatedRevenue = resolveEstimatedRevenue(campaign);
  const roas = estimatedRevenue !== null && campaign.totalSpend > 0 ? round2(estimatedRevenue / campaign.totalSpend) : null;
  const perOrderProfit = resolvePerOrderProfit(campaign);
  const estimatedGrossProfit = perOrderProfit !== null ? round2(perOrderProfit * campaign.ordersFromAds) : null;
  const estimatedProfitAfterAds = estimatedGrossProfit !== null ? round2(estimatedGrossProfit - campaign.totalSpend) : null;
  const breakEvenCPA = perOrderProfit !== null ? round2(perOrderProfit) : null;

  return {
    campaignDays,
    dailySpend,
    costPerOrder,
    roas,
    estimatedRevenue,
    estimatedGrossProfit,
    estimatedProfitAfterAds,
    breakEvenCPA,
    dataQuality: resolveDataQuality(campaignDays, campaign.ordersFromAds, estimatedRevenue, breakEvenCPA),
  };
}
