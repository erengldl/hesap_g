import { describe, expect, it } from "vitest";

import { predictReturnRiskFallback } from "@/lib/return-risk/fallback";
import type { ReturnRiskStats } from "@/lib/return-risk/types";

function stats(overrides: Partial<ReturnRiskStats> = {}): ReturnRiskStats {
  return {
    product: { orderCount: 100, returnedCount: 20, returnRate: 0.2 },
    category: { orderCount: 100, returnedCount: 10, returnRate: 0.1 },
    channel: { orderCount: 100, returnedCount: 5, returnRate: 0.05 },
    global: { orderCount: 100, returnedCount: 2, returnRate: 0.02 },
    productAveragePrice: 100,
    categoryAveragePrice: 100,
    expectedCostIfReturned: 50,
    ...overrides,
  };
}

describe("return risk fallback", () => {
  it("uses product-weighted rates when product history is sufficient", () => {
    const prediction = predictReturnRiskFallback({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      shippingCost: 20,
      packagingCost: 5,
      context: { stats: stats() },
    });

    expect(prediction.usedFallback).toBe(true);
    expect(prediction.returnProbability).toBe(0.1345);
    expect(prediction.expectedReturnRiskCost).toBe(6.73);
  });

  it("uses category, channel and global rates when product data is missing", () => {
    const prediction = predictReturnRiskFallback({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      context: {
        stats: stats({
          product: { orderCount: 0, returnedCount: 0, returnRate: 0.05 },
        }),
      },
    });

    expect(prediction.returnProbability).toBe(0.065);
    expect(prediction.confidence).toBe("medium");
  });

  it("clamps probability and never returns negative cost", () => {
    const prediction = predictReturnRiskFallback({
      productId: "p1",
      channel: "trendyol",
      price: 100,
      shippingCost: -20,
      packagingCost: -5,
      context: {
        stats: stats({
          product: { orderCount: 100, returnedCount: 500, returnRate: 5 },
          expectedCostIfReturned: -10,
        }),
      },
    });

    expect(prediction.returnProbability).toBeLessThanOrEqual(1);
    expect(prediction.expectedReturnRiskCost).toBeGreaterThanOrEqual(0);
  });
});
