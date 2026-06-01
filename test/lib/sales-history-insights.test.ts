import { describe, expect, it } from "vitest";

import { assessSalesHistoryQuality, type SalesHistoryTrendPoint } from "@/lib/sales-history-insights";

function buildTrend(totalDays: number, activeDays: number): SalesHistoryTrendPoint[] {
  return Array.from({ length: totalDays }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    orders: index < activeDays ? 2 : 0,
    units: index < activeDays ? 5 : 0,
    revenue: index < activeDays ? 1250 : 0,
    marketplace: index < activeDays ? "Trendyol" : null,
    missing: index >= activeDays,
  }));
}

describe("assessSalesHistoryQuality", () => {
  it("marks rich sales history as sufficient", () => {
    const quality = assessSalesHistoryQuality({
      trend: buildTrend(30, 26),
      totalOrders: 68,
      totalUnits: 132,
      activeMarketplaces: 2,
    });

    expect(quality.label).toBe("Yeterli Veri");
    expect(quality.tone).toBe("profit");
    expect(quality.active_sales_days).toBe(26);
    expect(quality.missing_days).toBe(4);
  });

  it("marks sparse sales history as missing", () => {
    const quality = assessSalesHistoryQuality({
      trend: buildTrend(30, 3),
      totalOrders: 4,
      totalUnits: 6,
      activeMarketplaces: 1,
    });

    expect(quality.label).toBe("Eksik Veri");
    expect(quality.tone).toBe("loss");
    expect(quality.forecast_readiness).toContain("verisi");
  });
});
