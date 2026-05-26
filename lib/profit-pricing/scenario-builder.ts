import {
  calculateNetCostAtPrice,
  solveBreakEvenPrice,
  solveMinimumHealthyPrice,
  solveTargetMarginPrice,
} from "./cost-calculator";
import { predictReturnRiskForProfitPricing } from "@/lib/return-risk/predictor";
import { decideProfitability } from "./decision-engine";
import { calculateScenarioRisk } from "./risk-engine";
import type {
  DataQuality,
  PriceGridPoint,
  PriceScenario,
  ProfitPricingInput,
  RecommendedPriceRange,
  ScenarioRisk,
} from "./types";
import { PROFIT_THRESHOLDS } from "./types";
import { clamp, roundCurrency, roundQuantity } from "./utils";

function estimateDemand(input: ProfitPricingInput, price: number) {
  const baseDemand = input.baseDemand;
  const basePrice = input.basePrice ?? input.salePrice;
  const elasticity = input.demandElasticity;

  if (
    baseDemand === undefined ||
    basePrice === undefined ||
    elasticity === undefined ||
    basePrice <= 0 ||
    baseDemand < 0
  ) {
    return null;
  }

  const rawDemand = baseDemand * Math.pow(price / basePrice, elasticity);
  const boundedDemand =
    input.stockLimit !== undefined && input.stockLimit > 0
      ? clamp(rawDemand, 0, input.stockLimit)
      : Math.max(0, rawDemand);

  return roundQuantity(boundedDemand);
}

function buildGridPoint(input: ProfitPricingInput, price: number): PriceGridPoint {
  const estimatedDemand = estimateDemand(input, price);
  const returnRiskPrediction = predictReturnRiskForProfitPricing(input, price, estimatedDemand);
  const cost = calculateNetCostAtPrice(
    {
      ...input,
      returnRiskCost: returnRiskPrediction.expectedReturnRiskCost,
    },
    price
  );
  const estimatedTotalProfit =
    estimatedDemand === null ? null : roundCurrency(cost.netProfit * estimatedDemand);

  return {
    price: roundCurrency(price),
    netCost: cost.total,
    netProfit: cost.netProfit,
    profitMargin: cost.profitMargin,
    returnRiskCost: cost.components.returnRiskCost,
    returnRiskPrediction,
    estimatedDemand,
    estimatedTotalProfit,
  };
}

export function buildPriceGrid(input: ProfitPricingInput) {
  const breakEvenPrice = roundCurrency(Math.max(1, solveBreakEvenPrice(input)));
  const minPrice = roundCurrency(Math.max(1, breakEvenPrice * 0.9, input.salePrice * 0.7));
  const maxPrice = roundCurrency(Math.max(minPrice + 1, input.salePrice * 1.5));
  const stepCount = 41;
  const step = (maxPrice - minPrice) / (stepCount - 1);

  return Array.from({ length: stepCount }, (_, index) => buildGridPoint(input, minPrice + step * index));
}

function mapRiskNotes(risk: ScenarioRisk, input: ProfitPricingInput, point: PriceGridPoint) {
  const notes: string[] = [];
  if (risk === "low") {
    notes.push("Fiyat değişimi kontrollü ve marj sağlıklı.");
  }

  if (risk === "medium") {
    notes.push("Fiyat artışı talebi etkileyebilir.");
  }

  if (risk === "high") {
    notes.push("Fiyat değişimi agresif, önce küçük test önerilir.");
  }

  if (point.estimatedDemand !== null && input.baseDemand !== undefined && point.estimatedDemand < input.baseDemand) {
    notes.push("Talep tahmini mevcut seviyenin altında.");
  }

  if ((point.profitMargin ?? 0) < PROFIT_THRESHOLDS.borderlineMargin) {
    notes.push("Marj güvenli aralığın altında.");
  }

  if (input.buyboxPrice !== undefined && input.buyboxPrice > 0 && point.price > input.buyboxPrice) {
    notes.push("Bu fiyat buybox seviyesinin üzerinde kalıyor.");
  }

  if (point.returnRiskPrediction?.usedFallback) {
    notes.push("İade/fire riski geçmiş ortalamalarla tahmin edildi.");
  }

  if (point.returnRiskPrediction?.confidence === "low") {
    notes.push("Iade/fire tahmin guveni dusuk.");
  }

  return notes;
}

function createScenario(
  input: ProfitPricingInput,
  point: PriceGridPoint,
  label: string,
  key: string,
  dataQuality: DataQuality
): PriceScenario {
  const risk = calculateScenarioRisk({
    price: point.price,
    baselinePrice: input.salePrice,
    profitMargin: point.profitMargin,
    estimatedDemand: point.estimatedDemand,
    baseDemand: input.baseDemand,
    dataQuality,
    adCostPerOrder: input.adCostPerOrder,
    returnRate: input.returnRate,
    commissionRate: input.commissionRate,
    stockLimit: input.stockLimit,
    buyboxPrice: input.buyboxPrice,
  });

  return {
    key,
    label,
    price: point.price,
    netCost: point.netCost,
    netProfit: point.netProfit,
    profitMargin: point.profitMargin,
    returnRiskCost: point.returnRiskCost,
    returnRiskPrediction: point.returnRiskPrediction,
    estimatedDemand: point.estimatedDemand,
    estimatedTotalProfit: point.estimatedTotalProfit,
    risk,
    decision: decideProfitability({
      netProfit: point.netProfit,
      profitMargin: point.profitMargin,
      hasBlockingMissingData: false,
      hasErrors: false,
    }),
    notes: mapRiskNotes(risk, input, point),
  };
}

function pickBestPoint(grid: PriceGridPoint[], fallbackPrice: number) {
  if (grid.length === 0) {
    return buildGridPoint(
      {
        channel: "trendyol",
        salePrice: fallbackPrice,
        productCost: 0,
      },
      fallbackPrice
    );
  }

  const demandAwarePoints = grid.filter((point) => point.estimatedTotalProfit !== null);
  if (demandAwarePoints.length > 0) {
    return demandAwarePoints.reduce((best, current) => {
      if ((current.estimatedTotalProfit ?? Number.NEGATIVE_INFINITY) > (best.estimatedTotalProfit ?? Number.NEGATIVE_INFINITY)) {
        return current;
      }
      if (current.estimatedTotalProfit === best.estimatedTotalProfit) {
        return Math.abs(current.price - fallbackPrice) < Math.abs(best.price - fallbackPrice) ? current : best;
      }
      return best;
    });
  }

  const healthyPoint = grid.find((point) => (point.profitMargin ?? -1) >= PROFIT_THRESHOLDS.healthyMargin);
  return healthyPoint ?? grid.reduce((best, current) => (current.netProfit > best.netProfit ? current : best));
}

function pickBuyboxAwarePoint(
  input: ProfitPricingInput,
  grid: PriceGridPoint[],
  fallbackPoint: PriceGridPoint
) {
  const buyboxPrice = input.buyboxPrice;
  if (buyboxPrice === undefined || buyboxPrice <= 0) {
    return null;
  }

  const withinBuybox = grid.filter((point) => point.price <= buyboxPrice);
  if (withinBuybox.length === 0) {
    return null;
  }

  const profitableWithinBuybox = withinBuybox.filter((point) => point.netProfit >= 0);
  if (profitableWithinBuybox.length > 0) {
    return pickBestPoint(profitableWithinBuybox, buyboxPrice);
  }

  return withinBuybox.reduce((best, current) => {
    if (current.netProfit > best.netProfit) {
      return current;
    }

    if (current.netProfit === best.netProfit) {
      return Math.abs(current.price - buyboxPrice) < Math.abs(best.price - buyboxPrice) ? current : best;
    }

    return best;
  }, fallbackPoint);
}

export function selectRecommendedPriceRange(
  input: ProfitPricingInput,
  grid: PriceGridPoint[],
  scenarios: PriceScenario[],
  dataQuality: DataQuality
): RecommendedPriceRange | null {
  if (grid.length === 0) {
    return null;
  }

  const minimumHealthyPrice =
    solveMinimumHealthyPrice(input, PROFIT_THRESHOLDS.minimumHealthyMargin) ?? roundCurrency(input.salePrice);
  const targetMarginPrice = solveTargetMarginPrice(input);
  const baselineBestPoint = pickBestPoint(grid, input.salePrice);
  const buyboxAwarePoint = pickBuyboxAwarePoint(input, grid, baselineBestPoint);
  const preferredPoint = buyboxAwarePoint ?? baselineBestPoint;
  const maxPriceCandidate = grid
    .filter((point) => {
      const risk = calculateScenarioRisk({
        price: point.price,
        baselinePrice: input.salePrice,
        profitMargin: point.profitMargin,
        estimatedDemand: point.estimatedDemand,
        baseDemand: input.baseDemand,
        dataQuality,
        adCostPerOrder: input.adCostPerOrder,
        returnRate: input.returnRate,
        commissionRate: input.commissionRate,
        stockLimit: input.stockLimit,
        buyboxPrice: input.buyboxPrice,
      });
      return risk !== "high" && point.netProfit >= 0 && (input.buyboxPrice === undefined || point.price <= input.buyboxPrice);
    })
    .at(-1);

  const preferred = roundCurrency(
    targetMarginPrice !== null &&
    targetMarginPrice > preferredPoint.price &&
    input.baseDemand === undefined &&
    (input.buyboxPrice === undefined || targetMarginPrice <= input.buyboxPrice)
      ? targetMarginPrice
      : preferredPoint.price
  );
  const min = roundCurrency(Math.min(preferred, Math.max(1, minimumHealthyPrice)));
  const max = roundCurrency(
    input.buyboxPrice !== undefined && input.buyboxPrice > 0 && preferred <= input.buyboxPrice
      ? Math.max(preferred, Math.min(input.buyboxPrice, maxPriceCandidate?.price ?? preferred))
      : Math.max(preferred, maxPriceCandidate?.price ?? preferred)
  );
  const reason =
    input.buyboxPrice !== undefined && input.buyboxPrice > 0
      ? preferred <= input.buyboxPrice
        ? `Buybox fiyatı ${roundCurrency(input.buyboxPrice)} seviyesinde kalacak şekilde seçildi.`
        : `Buybox fiyatı ${roundCurrency(input.buyboxPrice)} seviyesinde kârlılık korunamadığı için öneri yukarı taşındı.`
      : input.baseDemand !== undefined && input.basePrice !== undefined && input.demandElasticity !== undefined
        ? "Talep ve toplam kâr tahmini dikkate alınarak seçildi."
        : "Sağlıklı marj ve düşük riskli senaryolar dikkate alınarak seçildi.";

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(preferred)) {
    return null;
  }

  const relatedScenario = scenarios.find((scenario) => scenario.price === preferred);
  return {
    min,
    max,
    preferred,
    reason:
      relatedScenario?.risk === "high"
        ? `${reason} Fiyat değişimi agresif olduğu için küçük test önerilir.`
        : reason,
  };
}

export function buildLinkedPriceScenarios(input: ProfitPricingInput, dataQuality: DataQuality) {
  const grid = buildPriceGrid(input);
  const currentPoint = buildGridPoint(input, input.salePrice);
  const breakEvenPrice = grid.find((point) => point.netProfit >= 0)?.price ?? input.salePrice;
  const minimumHealthyPrice =
    solveMinimumHealthyPrice(input, PROFIT_THRESHOLDS.minimumHealthyMargin) ?? Math.max(input.salePrice, breakEvenPrice);
  const targetMarginPrice = solveTargetMarginPrice(input) ?? minimumHealthyPrice;
  const buyboxBenchmarkPrice =
    input.buyboxPrice !== undefined && input.buyboxPrice > 0 ? roundCurrency(input.buyboxPrice) : null;
  const baselineBestPoint = pickBestPoint(grid, input.salePrice);
  const buyboxAwarePoint = pickBuyboxAwarePoint(input, grid, baselineBestPoint);
  const preferredPoint = buyboxAwarePoint ?? baselineBestPoint;
  const aggressivePrice = roundCurrency(Math.max(preferredPoint.price, input.salePrice * 1.15));

  const pointMap = new Map<number, PriceGridPoint>();
  for (const point of grid) {
    pointMap.set(point.price, point);
  }

  const resolvePoint = (price: number) => pointMap.get(roundCurrency(price)) ?? buildGridPoint(input, price);

  const scenarios = [
    createScenario(input, currentPoint, "Mevcut fiyat", "current", dataQuality),
    createScenario(input, resolvePoint(breakEvenPrice), "Başabaş", "break_even", dataQuality),
    createScenario(input, resolvePoint(minimumHealthyPrice), "Minimum sağlıklı", "minimum_healthy", dataQuality),
    createScenario(
      input,
      resolvePoint(buyboxBenchmarkPrice ?? targetMarginPrice),
      buyboxBenchmarkPrice !== null ? "Buybox" : "Sağlıklı hedef",
      buyboxBenchmarkPrice !== null ? "buybox" : "healthy_target",
      dataQuality
    ),
    createScenario(input, resolvePoint(preferredPoint.price), "Önerilen", "recommended", dataQuality),
    createScenario(input, resolvePoint(aggressivePrice), "Agresif", "aggressive", dataQuality),
  ];

  const uniqueScenarios = Array.from(new Map(scenarios.map((scenario) => [scenario.key, scenario])).values());
  const recommendedPriceRange = selectRecommendedPriceRange(input, grid, uniqueScenarios, dataQuality);

  return {
    grid,
    scenarios: uniqueScenarios,
    recommendedPriceRange,
  };
}
