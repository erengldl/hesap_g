import type { DataQuality, ProfitPricingValidationResult } from "./types";

export function calculateDataQuality(
  validation: ProfitPricingValidationResult,
  flags: {
    hasCommissionData: boolean;
    hasShippingData: boolean;
    hasReturnData: boolean;
    hasProductCost: boolean;
    hasSalePrice: boolean;
  }
): DataQuality {
  if (!flags.hasProductCost || !flags.hasSalePrice) {
    return "low";
  }

  let score = 0;
  if (flags.hasProductCost) score += 2;
  if (flags.hasSalePrice) score += 2;
  if (flags.hasCommissionData) score += 1;
  if (flags.hasShippingData) score += 1;
  if (flags.hasReturnData) score += 1;

  score -= Math.min(validation.assumptions.length, 4);
  score -= Math.min(validation.missingFields.length, 3);

  if (score >= 4) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

