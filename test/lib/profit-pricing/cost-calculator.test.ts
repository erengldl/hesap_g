import { describe, expect, it } from "vitest";

import {
  calculateNetCostAtPrice,
} from "@/lib/profit-pricing/cost-calculator";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";

describe("profit pricing cost calculator", () => {
  it("calculates commission correctly", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 100);
    expect(result.components.commission).toBe(10);
  });

  it("calculates shipping VAT correctly", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 100);
    expect(result.components.shippingVat).toBe(2);
  });

  it("calculates withholding correctly", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 100);
    expect(result.components.withholding).toBe(1);
  });

  it("calculates return/fire risk correctly", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 100);
    expect(result.components.returnRiskCost).toBe(2);
  });

  it("calculates net cost, profit and margin correctly", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 100);
    expect(result.total).toBe(92);
    expect(result.netProfit).toBe(8);
    expect(result.profitMargin).toBeCloseTo(0.08, 6);
  });

  it("returns null margin when sale price is 0", () => {
    const result = calculateNetCostAtPrice(createBaseProfitPricingInput(), 0);
    expect(result.profitMargin).toBeNull();
  });

  it("never returns NaN or Infinity for core numeric outputs", () => {
    const result = calculateNetCostAtPrice(
      createBaseProfitPricingInput({
        salePrice: 1,
        productCost: 0,
        commissionRate: 0,
      }),
      1
    );

    expect(Number.isFinite(result.total)).toBe(true);
    expect(Number.isFinite(result.netProfit)).toBe(true);
    expect(result.profitMargin === null || Number.isFinite(result.profitMargin)).toBe(true);
  });
});
