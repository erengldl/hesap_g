import { describe, expect, it } from "vitest";

import { validateProfitPricingInput } from "@/lib/profit-pricing/validation";
import { createBaseProfitPricingInput } from "@/test/lib/profit-pricing/fixtures";

describe("profit pricing validation", () => {
  it("rejects negative costs", () => {
    const result = validateProfitPricingInput(
      createBaseProfitPricingInput({
        shippingCost: -1,
      })
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Kargo maliyeti negatif olamaz.");
  });

  it("rejects invalid rates", () => {
    const result = validateProfitPricingInput(
      createBaseProfitPricingInput({
        commissionRate: 1.2,
      })
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Komisyon oranı 0 ile 1 arasında olmalı.");
  });

  it("rejects a zero sale price", () => {
    const result = validateProfitPricingInput(
      createBaseProfitPricingInput({
        salePrice: 0,
      })
    );

    expect(result.missingFields).toContain("Satış fiyatı 0'dan büyük olmalı.");
  });

  it("rejects invalid channels", () => {
    const result = validateProfitPricingInput({
      ...createBaseProfitPricingInput(),
      channel: "amazon",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Geçersiz satış kanalı.");
  });
});
