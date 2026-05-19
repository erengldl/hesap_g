import { describe, expect, it } from "vitest";

import { applyEditableProfitPricingOverrides } from "@/lib/profit-pricing/utils";

import { createBaseProfitPricingInput } from "./fixtures";

describe("applyEditableProfitPricingOverrides", () => {
  it("only applies fields that remain editable in the profit pricing screen", () => {
    const baseInput = createBaseProfitPricingInput({
      salePrice: 100,
      productCost: 40,
      shippingCost: 10,
      targetMargin: 0.15,
      adCostPerOrder: 5,
      returnRate: 0.08,
    });

    const nextInput = applyEditableProfitPricingOverrides(baseInput, {
      salePrice: 140,
      shippingCost: 777,
      buyboxPrice: 199,
      targetMargin: 0.22,
      adCostPerOrder: 9,
      returnRate: 0.12,
      productCost: 999,
      commissionRate: 0.9,
    });

    expect(nextInput.salePrice).toBe(140);
    expect(nextInput.shippingCost).toBe(777);
    expect(nextInput.buyboxPrice).toBe(199);

    expect(nextInput.targetMargin).toBe(0.15);
    expect(nextInput.adCostPerOrder).toBe(5);
    expect(nextInput.returnRate).toBe(0.08);
    expect(nextInput.productCost).toBe(40);
    expect(nextInput.commissionRate).toBe(baseInput.commissionRate);
  });
});
