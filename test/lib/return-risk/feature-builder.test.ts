import { describe, expect, it } from "vitest";

import {
  buildReturnRiskFeatureVector,
  buildReturnRiskStats,
  calculateReturnRate,
} from "@/lib/return-risk/feature-builder";
import type { ReturnRiskTrainingRow } from "@/lib/return-risk/types";

function makeRows(): ReturnRiskTrainingRow[] {
  return Array.from({ length: 100 }, (_, index) => ({
    orderId: `o-${index}`,
    productId: index < 40 ? "p1" : "p2",
    channel: index % 2 === 0 ? "trendyol" : "hepsiburada",
    orderDate: "2026-05-01",
    salePrice: index < 40 ? 100 : 80,
    quantity: 1,
    isReturnedOrLost: index < 10,
    categoryId: index < 60 ? "cat-a" : "cat-b",
    categoryName: index < 60 ? "Aksesuar" : "Ev",
    productCost: 40,
    packagingCost: 5,
    shippingCost: 10,
  }));
}

describe("return risk feature builder", () => {
  it("calculates product, category and channel return rates", () => {
    const rows = makeRows();
    const stats = buildReturnRiskStats(rows, {
      productId: "p1",
      categoryId: "cat-a",
      channel: "trendyol",
    });

    expect(stats.product.returnRate).toBe(0.25);
    expect(stats.category.returnRate).toBeCloseTo(10 / 60, 4);
    expect(stats.channel.returnRate).toBe(0.1);
  });

  it("keeps return rates in a safe range", () => {
    expect(calculateReturnRate(0, 5)).toBe(0.05);
    expect(calculateReturnRate(10, 99)).toBe(1);
  });

  it("fills missing values with safe defaults", () => {
    const vector = buildReturnRiskFeatureVector({
      productId: "p1",
      channel: "trendyol",
      price: 120,
      context: {
        stats: buildReturnRiskStats(makeRows(), {
          productId: "p1",
          categoryId: "cat-a",
          channel: "trendyol",
        }),
      },
    });

    expect(vector.values.shipping_cost).toBe(0);
    expect(vector.values.low_data_flag).toBe(0);
    expect(Number.isFinite(vector.values.product_id_encoded)).toBe(true);
  });

  it("calculates price change rate against historical average", () => {
    const vector = buildReturnRiskFeatureVector({
      productId: "p1",
      channel: "trendyol",
      price: 120,
      basePrice: 100,
    });

    expect(vector.values.price_change_rate).toBe(0.2);
  });
});
