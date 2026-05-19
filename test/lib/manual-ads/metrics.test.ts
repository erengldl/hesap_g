import { describe, expect, it } from "vitest";

import { calculateManualAdMetrics, getManualAdCampaignDays } from "@/lib/manual-ads/metrics";
import type { ManualAdCampaign, ManualAdConversationState } from "@/lib/manual-ads/types";

function buildCampaign(overrides: Partial<ManualAdCampaign> = {}): ManualAdCampaign {
  return {
    id: "manual-campaign",
    name: "Test kampanya",
    platform: "meta",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    totalSpend: 300,
    ordersFromAds: 3,
    revenueFromAds: 900,
    productName: "Test ürün",
    productSalePrice: 200,
    estimatedProductCost: 120,
    estimatedProductProfit: 80,
    notes: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildConversationState(overrides: Partial<ManualAdConversationState> = {}): ManualAdConversationState {
  return {
    knownIssues: [],
    promptAnswers: {},
    missingFields: [],
    ...overrides,
  };
}

describe("manual ads metrics", () => {
  it("calculates inclusive campaign days", () => {
    expect(getManualAdCampaignDays("2026-05-01", "2026-05-01")).toBe(1);
    expect(getManualAdCampaignDays("2026-05-01", "2026-05-03")).toBe(3);
  });

  it("calculates cost per order when orders exist", () => {
    const metrics = calculateManualAdMetrics(buildCampaign({ totalSpend: 600, ordersFromAds: 4 }));
    expect(metrics.costPerOrder).toBe(150);
  });

  it("uses conversation test duration when provided", () => {
    const metrics = calculateManualAdMetrics(buildCampaign(), buildConversationState({ testDurationDays: 7 }));
    expect(metrics.campaignDays).toBe(7);
  });

  it("returns null cost per order when orders are zero", () => {
    const metrics = calculateManualAdMetrics(buildCampaign({ totalSpend: 600, ordersFromAds: 0 }));
    expect(metrics.costPerOrder).toBeNull();
  });

  it("calculates roas when revenue exists", () => {
    const metrics = calculateManualAdMetrics(buildCampaign({ totalSpend: 200, revenueFromAds: 500 }));
    expect(metrics.roas).toBe(2.5);
  });

  it("falls back to product sale price when revenue is missing", () => {
    const metrics = calculateManualAdMetrics(buildCampaign({ totalSpend: 200, ordersFromAds: 5, revenueFromAds: null, productSalePrice: 200 }));
    expect(metrics.estimatedRevenue).toBe(1000);
    expect(metrics.roas).toBe(5);
  });

  it("calculates profit after ads when product profit exists", () => {
    const metrics = calculateManualAdMetrics(buildCampaign({ totalSpend: 250, ordersFromAds: 5, estimatedProductProfit: 80 }));
    expect(metrics.estimatedGrossProfit).toBe(400);
    expect(metrics.estimatedProfitAfterAds).toBe(150);
    expect(metrics.breakEvenCPA).toBe(80);
  });
});
