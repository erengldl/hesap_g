import { describe, expect, it } from "vitest";

import { calculateNetCostAtPrice } from "@/lib/profit-pricing/cost-calculator";
import { buildLinkedPriceScenarios } from "@/lib/profit-pricing/scenario-builder";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";

describe("profit pricing scenario builder", () => {
  it("recalculates net cost for every scenario using that scenario price", () => {
    const input = createBaseProfitPricingInput();
    const scenarios = buildLinkedPriceScenarios(input, "high").scenarios;

    for (const scenario of scenarios) {
      const costAtScenarioPrice = calculateNetCostAtPrice(input, scenario.price);
      expect(scenario.netCost).toBe(costAtScenarioPrice.total);
      expect(scenario.netProfit).toBe(costAtScenarioPrice.netProfit);
    }
  });

  it("includes the current, break-even and target margin scenarios", () => {
    const scenarios = buildLinkedPriceScenarios(createBaseProfitPricingInput(), "high").scenarios;
    expect(scenarios.some((scenario) => scenario.key === "current")).toBe(true);
    expect(scenarios.some((scenario) => scenario.key === "break_even")).toBe(true);
    expect(scenarios.some((scenario) => scenario.key === "healthy_target")).toBe(true);
  });

  it("creates the current price scenario with the active sale price", () => {
    const input = createBaseProfitPricingInput({ salePrice: 135 });
    const scenario = buildLinkedPriceScenarios(input, "high").scenarios.find(
      (item) => item.key === "current"
    );

    expect(scenario?.price).toBe(135);
  });

  it("marks aggressive scenarios with high risk when the structure is fragile", () => {
    const input = createBaseProfitPricingInput({
      commissionRate: 0.2,
      adCostPerOrder: 18,
      returnRate: 0.2,
      demandElasticity: -2.2,
      targetMargin: 0.22,
    });
    const aggressive = buildLinkedPriceScenarios(input, "medium").scenarios.find(
      (scenario) => scenario.key === "aggressive"
    );

    expect(aggressive).toBeDefined();
    expect(aggressive?.risk).toBe("high");
    expect(aggressive?.notes.some((note) => note.includes("küçük test"))).toBe(true);
  });
});
