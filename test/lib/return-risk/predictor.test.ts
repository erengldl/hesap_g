import { describe, expect, it } from "vitest";

import { RETURN_RISK_FEATURE_NAMES } from "@/lib/return-risk/feature-builder";
import {
  clearReturnRiskPredictionCache,
  getReturnRiskPredictionCacheSize,
  predictReturnRisk,
  predictReturnRiskForProfitPricing,
} from "@/lib/return-risk/predictor";
import type { ReturnRiskModelArtifact, ReturnRiskStats } from "@/lib/return-risk/types";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";

function stats(): ReturnRiskStats {
  return {
    product: { orderCount: 120, returnedCount: 12, returnRate: 0.1 },
    category: { orderCount: 500, returnedCount: 80, returnRate: 0.16 },
    channel: { orderCount: 1000, returnedCount: 90, returnRate: 0.09 },
    global: { orderCount: 2000, returnedCount: 120, returnRate: 0.06 },
    productAveragePrice: 100,
    categoryAveragePrice: 95,
    expectedCostIfReturned: 40,
  };
}

function artifact(): ReturnRiskModelArtifact {
  const means = Object.fromEntries(RETURN_RISK_FEATURE_NAMES.map((name) => [name, 0]));
  const scales = Object.fromEntries(RETURN_RISK_FEATURE_NAMES.map((name) => [name, 1]));
  return {
    modelVersion: "return-risk-v1-test",
    modelType: "typescript-logistic-regression",
    trainedAt: "2026-05-19T00:00:00.000Z",
    featureNames: [...RETURN_RISK_FEATURE_NAMES],
    weights: RETURN_RISK_FEATURE_NAMES.map(() => 0),
    bias: 0,
    means,
    scales,
    stats: stats(),
    metrics: {
      rocAuc: 0.7,
      prAuc: 0.3,
      precision: 0.5,
      recall: 0.4,
      f1: 0.44,
      brierScore: 0.12,
      averagePredictedReturnCost: 20,
      classBalance: {
        positiveRate: 0.1,
        negativeRate: 0.9,
        imbalanceRatio: 9,
        positiveClassWeight: 8,
        majorityClassBaseline: 0.9,
      },
      calibrationBuckets: [],
      trainingRows: 500,
      positiveRows: 50,
    },
    trainingRows: 500,
    positiveRows: 50,
  };
}

describe("return risk predictor", () => {
  it("returns model prediction when an artifact exists", () => {
    const prediction = predictReturnRisk({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      shippingCost: 30,
      packagingCost: 10,
      context: { stats: stats() },
      modelArtifact: artifact(),
    });

    expect(prediction.usedFallback).toBe(false);
    expect(prediction.modelVersion).toBe("return-risk-v1-test");
    expect(prediction.returnProbability).toBe(0.5);
    expect(prediction.expectedReturnRiskCost).toBe(20);
  });

  it("falls back when a model artifact is missing", () => {
    const prediction = predictReturnRisk({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      shippingCost: 30,
      packagingCost: 10,
      context: { stats: stats() },
    });

    expect(prediction.usedFallback).toBe(true);
    expect(prediction.expectedReturnRiskCost).toBeGreaterThan(0);
  });

  it("returns low confidence for insufficient data", () => {
    const prediction = predictReturnRisk({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      shippingCost: 30,
      packagingCost: 10,
    });

    expect(prediction.confidence).toBe("low");
  });

  it("returns a net-cost compatible manual override shape", () => {
    clearReturnRiskPredictionCache();
    const prediction = predictReturnRiskForProfitPricing(
      createBaseProfitPricingInput({ returnRiskCost: 7.5, returnCostPerOrder: 50 }),
      120
    );

    expect(prediction.expectedReturnRiskCost).toBe(7.5);
    expect(prediction.returnProbability).toBe(0.15);
  });

  it("uses a bounded cache for the same product, channel and rounded price", () => {
    clearReturnRiskPredictionCache();
    const input = {
      productId: "p1",
      channel: "trendyol" as const,
      price: 100.004,
      shippingCost: 30,
      packagingCost: 10,
      context: { stats: stats() },
    };
    const first = predictReturnRisk(input);
    const second = predictReturnRisk({ ...input, price: 100.003 });

    expect(second).toBe(first);
    expect(getReturnRiskPredictionCacheSize()).toBe(1);
  });

  it("keeps manual return/fire cost ahead of cached ML or fallback estimates", () => {
    clearReturnRiskPredictionCache();
    const base = createBaseProfitPricingInput({
      returnRiskContext: { stats: stats() },
      returnRiskCost: undefined,
    });
    const fallbackPrediction = predictReturnRiskForProfitPricing(base, 120);
    const manualPrediction = predictReturnRiskForProfitPricing(
      {
        ...base,
        returnRiskCost: 3.25,
        returnCostPerOrder: 50,
      },
      120
    );

    expect(fallbackPrediction.expectedReturnRiskCost).not.toBe(3.25);
    expect(manualPrediction.expectedReturnRiskCost).toBe(3.25);
    expect(manualPrediction.modelType).toBe("manual-override");
  });
});
