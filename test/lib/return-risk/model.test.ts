import { describe, expect, it } from "vitest";

import {
  evaluateReturnRiskPredictions,
  predictReturnRiskProbabilityWithModel,
  trainReturnRiskLogisticModel,
} from "@/lib/return-risk/model";
import { buildReturnRiskFeatureVector, RETURN_RISK_FEATURE_NAMES } from "@/lib/return-risk/feature-builder";
import type { ReturnRiskModelArtifact, ReturnRiskTrainingRow } from "@/lib/return-risk/types";

function artifactWithExtremeBias(bias: number): ReturnRiskModelArtifact {
  const means = Object.fromEntries(RETURN_RISK_FEATURE_NAMES.map((name) => [name, 0]));
  const scales = Object.fromEntries(RETURN_RISK_FEATURE_NAMES.map((name) => [name, 1]));

  return {
    modelVersion: "return-risk-v1-extreme",
    modelType: "typescript-logistic-regression",
    trainedAt: "2026-05-19T00:00:00.000Z",
    featureNames: [...RETURN_RISK_FEATURE_NAMES],
    weights: RETURN_RISK_FEATURE_NAMES.map(() => 0),
    bias,
    means,
    scales,
    stats: {
      product: { orderCount: 0, returnedCount: 0, returnRate: 0.05 },
      category: { orderCount: 0, returnedCount: 0, returnRate: 0.05 },
      channel: { orderCount: 0, returnedCount: 0, returnRate: 0.05 },
      global: { orderCount: 0, returnedCount: 0, returnRate: 0.05 },
      productAveragePrice: 100,
      categoryAveragePrice: 100,
      expectedCostIfReturned: 50,
    },
    metrics: evaluateReturnRiskPredictions([]),
    trainingRows: 0,
    positiveRows: 0,
  };
}

describe("return risk model production checks", () => {
  it("keeps logistic regression probabilities in the 0-1 range", () => {
    const vector = buildReturnRiskFeatureVector({
      productId: "p1",
      channel: "trendyol",
      price: 100,
    });

    expect(predictReturnRiskProbabilityWithModel(artifactWithExtremeBias(999), vector)).toBeLessThanOrEqual(1);
    expect(predictReturnRiskProbabilityWithModel(artifactWithExtremeBias(-999), vector)).toBeGreaterThanOrEqual(0);
  });

  it("reports class imbalance and calibration buckets", () => {
    const metrics = evaluateReturnRiskPredictions([
      { probability: 0.05, label: 0 },
      { probability: 0.15, label: 0 },
      { probability: 0.25, label: 1 },
      { probability: 0.85, label: 1 },
    ]);

    expect(metrics.classBalance.positiveRate).toBe(0.5);
    expect(metrics.classBalance.imbalanceRatio).toBe(1);
    expect(metrics.calibrationBuckets).toHaveLength(10);
    expect(metrics.calibrationBuckets.some((bucket) => bucket.count > 0)).toBe(true);
    expect(metrics.rocAuc).not.toBeNull();
    expect(metrics.prAuc).not.toBeNull();
  });

  it("does not crash and returns no artifact when data is insufficient", () => {
    const rows: ReturnRiskTrainingRow[] = Array.from({ length: 10 }, (_, index) => ({
      orderId: `o-${index}`,
      productId: "p1",
      channel: "trendyol",
      orderDate: "2026-05-01",
      salePrice: 100,
      quantity: 1,
      isReturnedOrLost: index === 0,
    }));

    const result = trainReturnRiskLogisticModel(rows);

    expect(result.artifact).toBeNull();
    expect(result.reason).toContain("300");
  });
});
