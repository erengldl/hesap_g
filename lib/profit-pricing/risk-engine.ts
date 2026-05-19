import type { DataQuality, ScenarioRisk } from "./types";
import { toFiniteNumber } from "./utils";

export function calculateScenarioRisk(params: {
  price: number;
  baselinePrice: number;
  profitMargin: number | null;
  estimatedDemand: number | null;
  baseDemand: number | undefined;
  dataQuality: DataQuality;
  adCostPerOrder: number | undefined;
  returnRate: number | undefined;
  commissionRate: number | undefined;
  stockLimit: number | undefined;
  buyboxPrice?: number;
}): ScenarioRisk {
  let score = 0;
  const priceChangeRatio =
    params.baselinePrice > 0 ? Math.abs(params.price - params.baselinePrice) / params.baselinePrice : 0;

  if (priceChangeRatio >= 0.2) score += 2;
  else if (priceChangeRatio >= 0.1) score += 1;

  if (params.profitMargin === null || params.profitMargin < 0.1) score += 2;
  else if (params.profitMargin < 0.2) score += 1;

  if (params.baseDemand && params.baseDemand > 0 && params.estimatedDemand !== null) {
    const demandDrop = (params.baseDemand - params.estimatedDemand) / params.baseDemand;
    if (demandDrop >= 0.3) score += 2;
    else if (demandDrop >= 0.15) score += 1;
  }

  if (params.dataQuality === "low") score += 2;
  else if (params.dataQuality === "medium") score += 1;

  if (toFiniteNumber(params.adCostPerOrder, 0) > params.price * 0.15) score += 1;
  if (toFiniteNumber(params.returnRate, 0) > 0.15) score += 1;
  if (toFiniteNumber(params.commissionRate, 0) > 0.18) score += 1;
  if (params.buyboxPrice !== undefined && params.buyboxPrice > 0 && params.price > params.buyboxPrice) score += 1;
  if (
    params.stockLimit !== undefined &&
    params.estimatedDemand !== null &&
    params.estimatedDemand >= params.stockLimit &&
    params.stockLimit > 0
  ) {
    score += 1;
  }

  if (score >= 5) {
    return "high";
  }

  if (score >= 3) {
    return "medium";
  }

  return "low";
}
