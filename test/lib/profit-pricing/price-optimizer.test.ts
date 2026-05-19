import { describe, expect, it } from "vitest";

import {
  calculateNetCostAtPrice,
  solveBreakEvenPrice,
  solveTargetMarginPrice,
} from "@/lib/profit-pricing/cost-calculator";
import { buildPriceGrid } from "@/lib/profit-pricing/scenario-builder";
import { calculateProfitPricing } from "@/lib/profit-pricing/orchestrator";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";

describe("profit pricing optimizer", () => {
  it("finds a break-even price that yields near-zero profit", () => {
    const input = createBaseProfitPricingInput();
    const breakEvenPrice = solveBreakEvenPrice(input);
    const result = calculateNetCostAtPrice(input, breakEvenPrice);

    expect(breakEvenPrice).toBeGreaterThan(0);
    expect(Math.abs(result.netProfit)).toBeLessThan(0.05);
  });

  it("finds a target margin price that satisfies the requested margin", () => {
    const input = createBaseProfitPricingInput({ targetMargin: 0.15 });
    const targetMarginPrice = solveTargetMarginPrice(input);

    expect(targetMarginPrice).not.toBeNull();
    const result = calculateNetCostAtPrice(input, targetMarginPrice ?? 0);
    expect(result.profitMargin ?? 0).toBeGreaterThanOrEqual(0.149);
  });

  it("emits a warning when the target margin is unrealistic", () => {
    const result = calculateProfitPricing(
      createBaseProfitPricingInput({
        commissionRate: 0.55,
        vatRate: 0.15,
        withholdingRate: 0.1,
        incomeTaxRate: 0.2,
        targetMargin: 0.3,
      })
    );

    expect(result.targetMarginPrice).toBeNull();
    expect(result.warnings).toContain("Sağlıklı marj hedefi mevcut maliyet yapısıyla gerçekçi değil.");
  });

  it("builds a grid and prefers the highest total profit when demand data exists", () => {
    const input = createBaseProfitPricingInput({
      baseDemand: 120,
      basePrice: 100,
      demandElasticity: -1.4,
      stockLimit: 120,
    });
    const result = calculateProfitPricing(input);
    const peakGridPoint = result.priceGrid.reduce((best, current) =>
      (current.estimatedTotalProfit ?? Number.NEGATIVE_INFINITY) >
      (best.estimatedTotalProfit ?? Number.NEGATIVE_INFINITY)
        ? current
        : best
    );

    expect(result.recommendedPriceRange?.preferred).toBe(peakGridPoint.price);
  });

  it("applies the elasticity formula correctly", () => {
    const grid = buildPriceGrid(
      createBaseProfitPricingInput({
        baseDemand: 100,
        basePrice: 100,
        demandElasticity: -2,
      })
    );
    const point = grid.reduce((closest, current) =>
      Math.abs(current.price - 120) < Math.abs(closest.price - 120) ? current : closest
    );
    const expectedDemand = 100 * Math.pow(point.price / 100, -2);

    expect(point.estimatedDemand ?? 0).toBeCloseTo(expectedDemand, 1);
  });

  it("clamps estimated demand to stock limit", () => {
    const grid = buildPriceGrid(
      createBaseProfitPricingInput({
        baseDemand: 100,
        basePrice: 100,
        demandElasticity: -0.2,
        stockLimit: 40,
      })
    );

    expect(grid.some((point) => point.estimatedDemand === 40)).toBe(true);
  });
});
