import { describe, expect, it } from "vitest";

import { calculateManualAdMetrics } from "@/lib/manual-ads/metrics";
import { evaluateManualAdDecision } from "@/lib/manual-ads/decision-engine";
import type { ManualAdCampaign } from "@/lib/manual-ads/types";

function buildCampaign(overrides: Partial<ManualAdCampaign> = {}): ManualAdCampaign {
  return {
    id: "decision-campaign",
    name: "Decision test",
    platform: "meta",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    totalSpend: 500,
    ordersFromAds: 5,
    revenueFromAds: 1250,
    productName: "Test ürün",
    productSalePrice: 250,
    estimatedProductCost: 150,
    estimatedProductProfit: 100,
    notes: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("manual ads decision engine", () => {
  it("returns insufficient_data for low data sets", () => {
    const campaign = buildCampaign({ ordersFromAds: 0, totalSpend: 100, revenueFromAds: null, endDate: "2026-05-01" });
    const metrics = calculateManualAdMetrics(campaign);
    const result = evaluateManualAdDecision(campaign, metrics);

    expect(result.decision).toBe("insufficient_data");
  });

  it("returns reduce_budget or pause when CPA is above break-even", () => {
    const campaign = buildCampaign({ totalSpend: 1000, ordersFromAds: 10, estimatedProductProfit: 50, revenueFromAds: 1500 });
    const metrics = calculateManualAdMetrics(campaign);
    const result = evaluateManualAdDecision(campaign, metrics);

    expect(["reduce_budget", "pause"]).toContain(result.decision);
  });

  it("returns scale when CPA is clearly below break-even", () => {
    const campaign = buildCampaign({ totalSpend: 500, ordersFromAds: 10, estimatedProductProfit: 100, revenueFromAds: 1800 });
    const metrics = calculateManualAdMetrics(campaign);
    const result = evaluateManualAdDecision(campaign, metrics);

    expect(result.decision).toBe("scale");
  });

  it("returns pause when there are no orders and spend is meaningful", () => {
    const campaign = buildCampaign({ totalSpend: 1500, ordersFromAds: 0, revenueFromAds: null });
    const metrics = calculateManualAdMetrics(campaign);
    const result = evaluateManualAdDecision(campaign, metrics);

    expect(result.decision).toBe("pause");
  });
});
