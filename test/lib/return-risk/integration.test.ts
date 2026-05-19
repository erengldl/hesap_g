import { describe, expect, it } from "vitest";

import { calculateProfitPricing } from "@/lib/profit-pricing/orchestrator";
import { buildLinkedPriceScenarios } from "@/lib/profit-pricing/scenario-builder";
import { calculateNetCostAtPrice } from "@/lib/profit-pricing/cost-calculator";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";
import type { ReturnRiskStats } from "@/lib/return-risk/types";

function returnRiskStats(returnRate: number): ReturnRiskStats {
  return {
    product: { orderCount: 100, returnedCount: Math.round(returnRate * 100), returnRate },
    category: { orderCount: 300, returnedCount: Math.round(returnRate * 300), returnRate },
    channel: { orderCount: 500, returnedCount: Math.round(returnRate * 500), returnRate },
    global: { orderCount: 1000, returnedCount: Math.round(returnRate * 1000), returnRate },
    productAveragePrice: 100,
    categoryAveragePrice: 100,
    expectedCostIfReturned: 50,
  };
}

describe("return risk integration with profit pricing", () => {
  it("adds expected return risk cost to net cost", () => {
    const input = createBaseProfitPricingInput({
      returnRate: 0,
      returnCostPerOrder: 0,
      returnRiskContext: { stats: returnRiskStats(0.2) },
    });
    const result = calculateProfitPricing(input);
    const scenario = result.priceScenarios.find((item) => item.key === "current");

    expect(scenario?.returnRiskCost).toBeGreaterThan(0);
    expect(result.netCost).toBe(calculateNetCostAtPrice(input, input.salePrice).total);
  });

  it("recalculates return risk cost at different scenario prices", () => {
    const input = createBaseProfitPricingInput({
      returnRate: 0,
      returnCostPerOrder: 0,
      returnRiskContext: { stats: returnRiskStats(0.1) },
    });
    const scenarios = buildLinkedPriceScenarios(input, "medium").scenarios;
    const current = scenarios.find((item) => item.key === "current");
    const aggressive = scenarios.find((item) => item.key === "aggressive");

    expect(current).toBeDefined();
    expect(aggressive).toBeDefined();
    expect(aggressive?.returnRiskCost).not.toBe(current?.returnRiskCost);
  });

  it("changes recommended price when return risk materially increases", () => {
    const lowRisk = calculateProfitPricing(
      createBaseProfitPricingInput({
        returnRate: 0,
        returnCostPerOrder: 0,
        returnRiskContext: { stats: returnRiskStats(0.02) },
      })
    );
    const highRisk = calculateProfitPricing(
      createBaseProfitPricingInput({
        returnRate: 0,
        returnCostPerOrder: 0,
        returnRiskContext: { stats: returnRiskStats(0.35) },
      })
    );

    expect(highRisk.netCost).toBeGreaterThan(lowRisk.netCost);
    expect(highRisk.recommendedPriceRange?.preferred).toBeGreaterThanOrEqual(
      lowRisk.recommendedPriceRange?.preferred ?? 0
    );
  });
});
