import { buildReturnRiskFeatureVector, normalizeReturnRiskStats } from "./feature-builder";
import { predictReturnRiskProbabilityWithModel } from "./model";
import { predictReturnRiskFallback } from "./fallback";
import type {
  ReturnRiskConfidence,
  ReturnRiskPrediction,
  ReturnRiskPredictionInput,
} from "./types";
import type { ProfitPricingInput } from "@/lib/profit-pricing/types";

const MAX_PREDICTION_CACHE_SIZE = 300;
const predictionCache = new Map<string, ReturnRiskPrediction>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function roundCurrency(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function roundRate(value: number) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}

function predictionCacheKey(input: ReturnRiskPredictionInput) {
  const stats = normalizeReturnRiskStats(input.context?.stats);
  const roundedPrice = roundCurrency(input.price);
  const modelVersion = input.modelArtifact?.modelVersion ?? "fallback";
  const statsSignature = [
    stats.product.orderCount,
    stats.product.returnedCount,
    stats.category.orderCount,
    stats.category.returnedCount,
    stats.channel.orderCount,
    stats.channel.returnedCount,
    stats.global.orderCount,
    stats.global.returnedCount,
    stats.expectedCostIfReturned ?? 0,
  ].join(":");

  return [
    input.productId,
    input.channel,
    roundedPrice,
    modelVersion,
    finite(input.shippingCost),
    finite(input.packagingCost),
    finite(input.productCost),
    finite(input.commissionRate),
    statsSignature,
  ].join("|");
}

function getCachedPrediction(key: string) {
  const cached = predictionCache.get(key);
  if (!cached) {
    return null;
  }

  predictionCache.delete(key);
  predictionCache.set(key, cached);
  return cached;
}

function setCachedPrediction(key: string, prediction: ReturnRiskPrediction) {
  predictionCache.set(key, prediction);
  if (predictionCache.size > MAX_PREDICTION_CACHE_SIZE) {
    const oldestKey = predictionCache.keys().next().value;
    if (oldestKey) {
      predictionCache.delete(oldestKey);
    }
  }

  return prediction;
}

export function clearReturnRiskPredictionCache() {
  predictionCache.clear();
}

export function getReturnRiskPredictionCacheSize() {
  return predictionCache.size;
}

function resolveModelConfidence(input: ReturnRiskPredictionInput): ReturnRiskConfidence {
  const stats = normalizeReturnRiskStats(input.context?.stats);
  const missingCount = buildReturnRiskFeatureVector(input).missingValueCount;

  if (stats.product.orderCount >= 100 && stats.product.returnedCount >= 10 && missingCount <= 2) {
    return "high";
  }

  if (
    stats.product.orderCount >= 30 ||
    stats.category.orderCount >= 100 ||
    stats.channel.orderCount >= 100
  ) {
    return "medium";
  }

  return "low";
}

function topRiskFactors(input: ReturnRiskPredictionInput, probability: number) {
  const vector = buildReturnRiskFeatureVector(input);
  const stats = normalizeReturnRiskStats(vector.stats);
  const factors: string[] = [];

  if (probability >= 0.12) {
    factors.push("Model iade/fire olasılığını yüksek görüyor");
  }

  if (stats.category.returnRate >= 0.12) {
    factors.push("Kategori iade/fire oranı yüksek");
  }

  if (finite(vector.values.price_change_rate) > 0.2) {
    factors.push("Fiyat son ortalamanın belirgin üzerinde");
  }

  if (stats.product.orderCount < 30) {
    factors.push("Ürün geçmiş verisi sınırlı");
  }

  if (finite(vector.values.high_shipping_cost_flag) > 0) {
    factors.push("Kargo maliyeti satış fiyatına göre yüksek");
  }

  return factors.length > 0 ? factors.slice(0, 4) : ["Model belirgin bir risk baskısı bulmadı"];
}

function buildPrediction(input: ReturnRiskPredictionInput): ReturnRiskPrediction | null {
  const artifact = input.modelArtifact;
  if (!artifact || artifact.featureNames.length === 0 || artifact.weights.length === 0) {
    return null;
  }

  const vector = buildReturnRiskFeatureVector(input);
  const returnProbability = roundRate(
    clamp(predictReturnRiskProbabilityWithModel(artifact, vector), 0, 1)
  );
  const expectedCostIfReturned = roundCurrency(Math.max(0, vector.expectedCostIfReturned));
  const expectedReturnRiskCost = roundCurrency(returnProbability * expectedCostIfReturned);

  return {
    productId: input.productId,
    channel: input.channel,
    price: roundCurrency(input.price),
    returnProbability,
    expectedCostIfReturned,
    expectedReturnRiskCost,
    confidence: resolveModelConfidence(input),
    modelVersion: artifact.modelVersion,
    modelType: artifact.modelType,
    usedFallback: false,
    topRiskFactors: topRiskFactors(input, returnProbability),
    explanation: `İade/fire maliyeti eğitilmiş model ile sipariş başına ${expectedReturnRiskCost.toFixed(2)} TL tahmin edildi.`,
  };
}

export function predictReturnRisk(input: ReturnRiskPredictionInput): ReturnRiskPrediction {
  const cacheKey = predictionCacheKey(input);
  const cached = getCachedPrediction(cacheKey);
  if (cached) {
    return cached;
  }

  const modelPrediction = buildPrediction(input);

  if (modelPrediction) {
    return setCachedPrediction(cacheKey, modelPrediction);
  }

  return setCachedPrediction(cacheKey, predictReturnRiskFallback(input));
}

export function buildReturnRiskPredictionInputFromProfitPricing(
  input: ProfitPricingInput,
  price: number,
  demandForecast?: number | null
): ReturnRiskPredictionInput {
  return {
    productId: input.productId ?? "unknown",
    channel: input.channel,
    price,
    productCost: input.productCost,
    packagingCost: input.packagingCost,
    shippingCost: input.shippingCost,
    commissionRate: input.commissionRate,
    platformFee: input.platformFee,
    basePrice: input.basePrice ?? input.salePrice,
    baseDemand: input.baseDemand,
    demandForecast: demandForecast ?? null,
    stockLimit: input.stockLimit,
    context: input.returnRiskContext,
  };
}

export function predictReturnRiskForProfitPricing(
  input: ProfitPricingInput,
  price: number,
  demandForecast?: number | null
) {
  if (input.returnRiskCost !== undefined && Number.isFinite(input.returnRiskCost)) {
    const expectedCostIfReturned = Math.max(
      0,
      finite(input.returnCostPerOrder, finite(input.shippingCost) + finite(input.packagingCost))
    );
    const expectedReturnRiskCost = roundCurrency(input.returnRiskCost);
    const probability =
      expectedCostIfReturned > 0
        ? roundRate(clamp(expectedReturnRiskCost / expectedCostIfReturned, 0, 1))
        : 0;

    return {
      productId: input.productId ?? "unknown",
      channel: input.channel,
      price: roundCurrency(price),
      returnProbability: probability,
      expectedCostIfReturned,
      expectedReturnRiskCost,
      confidence: "medium" as const,
      modelVersion: "manual-return-risk-cost",
      modelType: "manual-override",
      usedFallback: false,
      topRiskFactors: ["Manuel iade/fire risk maliyeti kullanıldı"],
      explanation: "İade/fire risk maliyeti manuel girdiden alındı.",
    };
  }

  if (
    input.returnRiskContext === undefined &&
    (finite(input.returnRate) > 0 || finite(input.returnCostPerOrder) > 0)
  ) {
    const baselinePrice = Math.max(1, finite(input.basePrice, input.salePrice || price || 1));
    const priceIncreaseRatio = Math.max(0, price / baselinePrice - 1);
    const priceRiskMultiplier = 1 + Math.min(0.35, priceIncreaseRatio * 0.25);
    const returnProbability = roundRate(clamp(finite(input.returnRate) * priceRiskMultiplier, 0, 1));
    const expectedCostIfReturned = Math.max(0, finite(input.returnCostPerOrder));
    const expectedReturnRiskCost = roundCurrency(returnProbability * expectedCostIfReturned);

    return {
      productId: input.productId ?? "unknown",
      channel: input.channel,
      price: roundCurrency(price),
      returnProbability,
      expectedCostIfReturned,
      expectedReturnRiskCost,
      confidence: "low" as const,
      modelVersion: "manual-return-rate-fallback",
      modelType: "manual-return-rate",
      usedFallback: true,
      topRiskFactors: ["İade/fire riski manuel oran varsayımıyla hesaplandı"],
      explanation: "İade/fire risk maliyeti manuel iade oranı ve iade başına maliyetle tahmini hesaplandı.",
    };
  }

  return predictReturnRisk(
    buildReturnRiskPredictionInputFromProfitPricing(input, price, demandForecast)
  );
}
