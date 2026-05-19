import {
  buildReturnRiskFeatureVector,
  normalizeReturnRiskStats,
} from "./feature-builder";
import type {
  ReturnRiskPrediction,
  ReturnRiskPredictionInput,
  ReturnRiskStats,
} from "./types";

const FALLBACK_MODEL_VERSION = "return-risk-fallback-v1";
const DEFAULT_GLOBAL_RETURN_RATE = 0.05;

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

function resolveReturnProbability(stats: ReturnRiskStats) {
  const productRate = stats.product.orderCount > 0 ? stats.product.returnRate : null;
  const categoryRate = stats.category.orderCount > 0 ? stats.category.returnRate : null;
  const channelRate = stats.channel.orderCount > 0 ? stats.channel.returnRate : null;
  const globalRate = stats.global.orderCount > 0 ? stats.global.returnRate : DEFAULT_GLOBAL_RETURN_RATE;

  if (stats.product.orderCount >= 30 && productRate !== null) {
    return (
      productRate * 0.5 +
      (categoryRate ?? globalRate) * 0.25 +
      (channelRate ?? globalRate) * 0.15 +
      globalRate * 0.1
    );
  }

  return (
    (categoryRate ?? globalRate) * 0.45 +
    (channelRate ?? globalRate) * 0.3 +
    globalRate * 0.25
  );
}

function resolveConfidence(stats: ReturnRiskStats) {
  if (stats.product.orderCount >= 100 && stats.product.returnedCount >= 10) {
    return "medium" as const;
  }

  if (stats.category.orderCount >= 100 || stats.channel.orderCount >= 100) {
    return "medium" as const;
  }

  return "low" as const;
}

function buildFallbackRiskFactors(stats: ReturnRiskStats, priceChangeRate: number, shippingRatio: number) {
  const factors: string[] = [];

  if (stats.product.orderCount < 30) {
    factors.push("Urun bazli iade/fire verisi sinirli");
  }

  if (stats.category.returnRate >= 0.12) {
    factors.push("Kategori iade/fire orani yuksek");
  }

  if (priceChangeRate > 0.2) {
    factors.push("Fiyat son ortalamanin belirgin uzerinde");
  }

  if (shippingRatio >= 0.12) {
    factors.push("Kargo maliyeti satis fiyatina gore yuksek");
  }

  return factors.length > 0 ? factors : ["Gecmis ortalamalara gore standart risk"];
}

export function predictReturnRiskFallback(input: ReturnRiskPredictionInput): ReturnRiskPrediction {
  const featureVector = buildReturnRiskFeatureVector(input);
  const stats = normalizeReturnRiskStats(featureVector.stats);
  const priceChangeRate = finite(featureVector.values.price_change_rate);
  const priceRiskMultiplier = 1 + Math.min(0.35, Math.max(0, priceChangeRate) * 0.25);
  const rawProbability = resolveReturnProbability(stats) * priceRiskMultiplier;
  const returnProbability = roundRate(clamp(rawProbability, 0, 1));
  const expectedCostIfReturned = roundCurrency(Math.max(0, featureVector.expectedCostIfReturned));
  const expectedReturnRiskCost = roundCurrency(
    Math.max(0, returnProbability * expectedCostIfReturned)
  );
  const shippingRatio = input.price > 0 ? finite(input.shippingCost) / input.price : 0;
  const topRiskFactors = buildFallbackRiskFactors(
    stats,
    priceChangeRate,
    shippingRatio
  );

  return {
    productId: input.productId,
    channel: input.channel,
    price: roundCurrency(input.price),
    returnProbability,
    expectedCostIfReturned,
    expectedReturnRiskCost,
    confidence: resolveConfidence(stats),
    modelVersion: FALLBACK_MODEL_VERSION,
    modelType: "historical-weighted-average",
    usedFallback: true,
    topRiskFactors,
    explanation:
      "Iade/fire maliyeti gecmis urun, kategori ve kanal ortalamalarina gore tahmini hesaplandi.",
  };
}
