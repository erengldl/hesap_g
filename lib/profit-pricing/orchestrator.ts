import {
  buildCostBreakdown,
  calculateMaxProfitableAdCost,
  calculateNetCostAtPrice,
  solveBreakEvenPrice,
  solveTargetMarginPrice,
} from "./cost-calculator";
import { calculateDataQuality } from "./data-quality";
import { decideProfitability } from "./decision-engine";
import { buildLinkedPriceScenarios } from "./scenario-builder";
import type { ProfitPricingInput, ProfitPricingResult, ProfitPricingValidationResult } from "./types";
import { validateProfitPricingInput } from "./validation";
import { channelLabel, decisionLabel, roundCurrency, toFiniteNumber } from "./utils";

function applySafeDefaults(input: ProfitPricingInput): ProfitPricingInput {
  return {
    ...input,
    packagingCost: toFiniteNumber(input.packagingCost, 0),
    shippingCost: toFiniteNumber(input.shippingCost, 0),
    commissionRate: toFiniteNumber(input.commissionRate, 0),
    platformFee: toFiniteNumber(input.platformFee, 0),
    adCostPerOrder: toFiniteNumber(input.adCostPerOrder, 0),
    buyboxPrice: input.buyboxPrice !== undefined ? roundCurrency(toFiniteNumber(input.buyboxPrice, 0)) : undefined,
    returnRate: toFiniteNumber(input.returnRate, 0),
    returnCostPerOrder: toFiniteNumber(input.returnCostPerOrder, 0),
    returnRiskCost:
      input.returnRiskCost !== undefined ? toFiniteNumber(input.returnRiskCost, 0) : undefined,
    fixedCostShare: toFiniteNumber(input.fixedCostShare, 0),
    vatRate: toFiniteNumber(input.vatRate, 0),
    withholdingRate:
      input.withholdingRate !== undefined ? toFiniteNumber(input.withholdingRate, 0.01) : 0.01,
    incomeTaxRate: toFiniteNumber(input.incomeTaxRate, 0),
    targetMargin: input.targetMargin !== undefined ? toFiniteNumber(input.targetMargin, 0.15) : 0.15,
    baseDemand: input.baseDemand !== undefined ? toFiniteNumber(input.baseDemand, 0) : undefined,
    basePrice: input.basePrice !== undefined ? toFiniteNumber(input.basePrice, input.salePrice) : input.salePrice,
    demandElasticity: input.demandElasticity !== undefined ? input.demandElasticity : undefined,
    stockLimit: input.stockLimit !== undefined ? toFiniteNumber(input.stockLimit, 0) : undefined,
    salePrice: roundCurrency(toFiniteNumber(input.salePrice, 0)),
    productCost: roundCurrency(toFiniteNumber(input.productCost, 0)),
    dataSource: input.dataSource ?? "product",
  };
}

function buildProfitPricingSummary(params: {
  channel: ProfitPricingInput["channel"];
  decision: ProfitPricingResult["decision"];
  netProfit: number;
  recommendedPriceRange: ProfitPricingResult["recommendedPriceRange"];
  dataQuality: ProfitPricingResult["dataQuality"];
  buyboxPrice?: number;
}) {
  const channelText = channelLabel(params.channel);
  const title = decisionLabel(params.decision);
  const reason =
    params.decision === "loss"
      ? `Bu ürün ${channelText} kanalında mevcut fiyatla zarar ediyor.`
      : params.decision === "borderline"
        ? `Bu ürün ${channelText} kanalında kâr ediyor ancak marj güvenli aralığın altında.`
        : params.decision === "profitable_but_low_margin"
          ? `Bu ürün ${channelText} kanalında kârlı, ancak marj dış baskılara karşı hassas.`
          : params.decision === "profitable"
            ? `Bu ürün ${channelText} kanalında sağlıklı kâr bırakıyor.`
            : `Bu ürün için ${channelText} kanalında net karar üretmek için veri eksik.`;
  const action =
    params.recommendedPriceRange !== null
      ? params.buyboxPrice !== undefined && params.buyboxPrice > 0
        ? params.recommendedPriceRange.preferred <= params.buyboxPrice
          ? `Buybox fiyatı ₺${params.buyboxPrice.toFixed(0)} dikkate alındı. Önerilen aralık ₺${params.recommendedPriceRange.min.toFixed(0)} - ₺${params.recommendedPriceRange.max.toFixed(0)}. Tercih edilen fiyat ₺${params.recommendedPriceRange.preferred.toFixed(0)}.`
          : `Buybox fiyatı ₺${params.buyboxPrice.toFixed(0)} seviyesinde kârlılık yetersiz. Kârlı kalmak için tercih edilen fiyat ₺${params.recommendedPriceRange.preferred.toFixed(0)} seviyesine çıkıyor.`
        : `Önerilen fiyat aralığı ₺${params.recommendedPriceRange.min.toFixed(0)} - ₺${params.recommendedPriceRange.max.toFixed(0)}. Tercih edilen fiyat ₺${params.recommendedPriceRange.preferred.toFixed(0)}.`
      : params.netProfit < 0
        ? "Satış fiyatı artırılmalı veya maliyetler düşürülmeli."
        : params.dataQuality === "low"
          ? "Veri güveni düşük. Eksik maliyet alanlarını tamamlayın."
          : "Detaylı senaryoları kontrol edip güvenli marj aralığında test yapın.";

  return {
    title,
    reason,
    action,
  };
}

function createMissingDataResult(
  input: ProfitPricingInput,
  validation: ProfitPricingValidationResult
): ProfitPricingResult {
  const normalizedInput = applySafeDefaults(input);

  return {
    input: normalizedInput,
    netCost: 0,
    netProfit: 0,
    profitMargin: null,
    breakEvenPrice: 0,
    targetMarginPrice: null,
    maxProfitableAdCost: null,
    decision: "missing_data",
    dataQuality: "low",
    missingFields: [...validation.missingFields, ...validation.errors],
    assumptions: validation.assumptions,
    warnings: validation.warnings,
    costBreakdown: [],
    priceGrid: [],
    priceScenarios: [],
    recommendedPriceRange: null,
    summary: buildProfitPricingSummary({
      channel: normalizedInput.channel,
      decision: "missing_data",
      netProfit: 0,
      recommendedPriceRange: null,
      dataQuality: "low",
      buyboxPrice: normalizedInput.buyboxPrice,
    }),
  };
}

export function calculateProfitPricing(
  input: ProfitPricingInput
): ProfitPricingResult {
  const validation = validateProfitPricingInput(input);

  if (!validation.ok || validation.hasBlockingMissingData) {
    return createMissingDataResult(input, validation);
  }

  const normalizedInput = applySafeDefaults(input);
  const currentCost = calculateNetCostAtPrice(normalizedInput, normalizedInput.salePrice);
  const breakEvenPrice = solveBreakEvenPrice(normalizedInput);
  const targetMarginPrice = solveTargetMarginPrice(normalizedInput);
  const maxProfitableAdCost = calculateMaxProfitableAdCost(normalizedInput);
  const costBreakdown = buildCostBreakdown(normalizedInput, normalizedInput.salePrice);
  const warnings = [...validation.warnings];
  if (normalizedInput.targetMargin !== undefined && targetMarginPrice === null) {
    warnings.push("Sağlıklı marj hedefi mevcut maliyet yapısıyla gerçekçi değil.");
  }
  if (
    normalizedInput.buyboxPrice !== undefined &&
    normalizedInput.buyboxPrice > 0 &&
    breakEvenPrice > normalizedInput.buyboxPrice
  ) {
    warnings.push("Buybox fiyatı mevcut maliyet yapısında başabaş seviyesinin altında kalıyor.");
  }
  if (normalizedInput.salePrice > 0 && currentCost.components.returnRiskCost / normalizedInput.salePrice > 0.5) {
    warnings.push("İade/fire maliyeti olağan dışı yüksek görünüyor. Veriyi kontrol edin.");
  }
  const dataQuality = calculateDataQuality(validation, {
    hasCommissionData: normalizedInput.channel === "website" || normalizedInput.commissionRate !== undefined,
    hasShippingData: normalizedInput.shippingCost !== undefined,
    hasReturnData:
      currentCost.components.returnRiskCost > 0 ||
      normalizedInput.returnRiskContext !== undefined ||
      (normalizedInput.returnRiskCost ?? 0) > 0 ||
      (normalizedInput.returnRate ?? 0) > 0 ||
      (normalizedInput.returnCostPerOrder ?? 0) > 0,
    hasProductCost: normalizedInput.productCost > 0,
    hasSalePrice: normalizedInput.salePrice > 0,
  });
  const decision = decideProfitability({
    netProfit: currentCost.netProfit,
    profitMargin: currentCost.profitMargin,
    hasBlockingMissingData: validation.hasBlockingMissingData,
    hasErrors: !validation.ok,
  });
  const scenariosPayload = buildLinkedPriceScenarios(normalizedInput, dataQuality);
  const summary = buildProfitPricingSummary({
    channel: normalizedInput.channel,
    decision,
    netProfit: currentCost.netProfit,
    recommendedPriceRange: scenariosPayload.recommendedPriceRange,
    dataQuality,
    buyboxPrice: normalizedInput.buyboxPrice,
  });

  const result: ProfitPricingResult = {
    input: normalizedInput,
    netCost: currentCost.total,
    netProfit: currentCost.netProfit,
    profitMargin: currentCost.profitMargin,
    breakEvenPrice,
    targetMarginPrice,
    maxProfitableAdCost,
    decision,
    dataQuality,
    missingFields: validation.missingFields,
    assumptions: validation.assumptions,
    warnings,
    costBreakdown,
    priceGrid: scenariosPayload.grid,
    priceScenarios: scenariosPayload.scenarios,
    recommendedPriceRange: scenariosPayload.recommendedPriceRange,
    summary,
  };

  return result;
}
