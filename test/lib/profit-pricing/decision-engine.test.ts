import { describe, expect, it } from "vitest";

import { decideProfitability } from "@/lib/profit-pricing/decision-engine";

describe("profit pricing decision engine", () => {
  it("returns missing_data when required data is missing", () => {
    expect(
      decideProfitability({
        netProfit: 0,
        profitMargin: null,
        hasBlockingMissingData: true,
        hasErrors: false,
      })
    ).toBe("missing_data");
  });

  it("returns loss for negative net profit", () => {
    expect(
      decideProfitability({
        netProfit: -1,
        profitMargin: -0.01,
        hasBlockingMissingData: false,
        hasErrors: false,
      })
    ).toBe("loss");
  });

  it("returns borderline for 0-10% margin", () => {
    expect(
      decideProfitability({
        netProfit: 5,
        profitMargin: 0.08,
        hasBlockingMissingData: false,
        hasErrors: false,
      })
    ).toBe("borderline");
  });

  it("returns profitable_but_low_margin for 10-20% margin", () => {
    expect(
      decideProfitability({
        netProfit: 12,
        profitMargin: 0.15,
        hasBlockingMissingData: false,
        hasErrors: false,
      })
    ).toBe("profitable_but_low_margin");
  });

  it("returns profitable for 20% and above", () => {
    expect(
      decideProfitability({
        netProfit: 25,
        profitMargin: 0.2,
        hasBlockingMissingData: false,
        hasErrors: false,
      })
    ).toBe("profitable");
  });
});
