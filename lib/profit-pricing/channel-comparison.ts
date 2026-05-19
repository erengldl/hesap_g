import { calculateMaxProfitableAdCost } from "./cost-calculator";
import { calculateProfitPricing } from "./orchestrator";
import type {
  ChannelComparisonItem,
  ProfitPricingChannelProfile,
  ProfitPricingInput,
  RecommendedPriceRange,
} from "./types";
import { applyEditableProfitPricingOverrides, channelLabel } from "./utils";

function shortRecommendation(
  channel: ProfitPricingInput["channel"],
  recommendedPriceRange: RecommendedPriceRange | null,
  netProfit: number
) {
  if (!recommendedPriceRange) {
    return netProfit < 0 ? "Bu kanalda fiyat artırılmadan satış önerilmez." : "Bu kanal için veri eksik.";
  }

  if (netProfit < 0) {
    return `${channelLabel(channel)} kanalında mevcut fiyat zarar üretiyor. Fiyat en az ₺${recommendedPriceRange.preferred.toFixed(0)} civarına çıkarılmalı.`;
  }

  return `Önerilen fiyat aralığı ₺${recommendedPriceRange.min.toFixed(0)} - ₺${recommendedPriceRange.max.toFixed(0)}.`;
}

function mergeInputWithProfile(baseInput: ProfitPricingInput, profile: ProfitPricingChannelProfile): ProfitPricingInput {
  return {
    ...applyEditableProfitPricingOverrides(profile.input, baseInput),
    dataSource: baseInput.dataSource,
    productId: baseInput.productId,
    productName: baseInput.productName,
  };
}

export function buildChannelComparison(
  baseInput: ProfitPricingInput,
  channelProfiles: ProfitPricingChannelProfile[]
): ChannelComparisonItem[] {
  return channelProfiles.map((profile) => {
    const scenarioInput =
      profile.channel === baseInput.channel ? baseInput : mergeInputWithProfile(baseInput, profile);
    const result = calculateProfitPricing(scenarioInput);
    const currentScenario =
      result.priceScenarios.find((scenario) => scenario.key === "current") ?? null;

    return {
      channel: profile.channel,
      currentPrice: result.input.salePrice,
      netCost: result.netCost,
      netProfit: result.netProfit,
      profitMargin: result.profitMargin,
      estimatedDemand: currentScenario?.estimatedDemand ?? null,
      estimatedTotalProfit: currentScenario?.estimatedTotalProfit ?? null,
      breakEvenPrice: result.breakEvenPrice,
      maxProfitableAdCost: calculateMaxProfitableAdCost(result.input),
      recommendedPriceRange: result.recommendedPriceRange,
      decision: result.decision,
      shortRecommendation: shortRecommendation(profile.channel, result.recommendedPriceRange, result.netProfit),
    };
  });
}
