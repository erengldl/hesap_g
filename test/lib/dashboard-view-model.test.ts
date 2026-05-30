import { describe, expect, it } from "vitest";

import { buildDashboardViewModel, type DashboardPayload } from "@/lib/dashboard-view-model";

describe("buildDashboardViewModel", () => {
  it("derives four KPIs and escalates critical alerts to loss tone when stock or ad risks exist", () => {
    const payload: DashboardPayload = {
      success: true,
      aggregate: {
        totalRevenue: 98000,
        totalOrders: 142,
        totalProducts: 12,
        avgMargin: 29.8,
        totalProfit: 29150,
        channelBreakdown: [],
        topProducts: [
          { id: 1, name: "Akıllı Saat", sku: "AKL-001", revenue: 42000, orders: 55, qty: 58, margin: 24.2 },
          { id: 2, name: "Kulaklık", sku: "KLK-002", revenue: 33000, orders: 44, qty: 46, margin: 18.4 },
        ],
        salesTrend: [
          { date: "2026-05-01", revenue: 2600, orders: 7 },
          { date: "2026-05-02", revenue: 3900, orders: 11 },
        ],
        stockAlerts: [
          { id: 1, name: "Akıllı Saat", sku: "AKL-001", stock: 3, channel: "Trendyol" },
        ],
        methodology: "Demo methodology",
      },
      adAnalysis: {
        totalSpend: 7400,
        totalNetProfit: 2800,
        averagePoas: 0.37,
        lossMakingCount: 2,
        watchCount: 3,
        scaleCount: 1,
        totalCampaigns: 9,
        lastSyncedAt: "2026-05-30T09:30:00.000Z",
      },
      bestChannelName: "Kendi Websitem",
      bestNetProfit: 5100,
      methodology: "Demo methodology",
    };

    const result = buildDashboardViewModel(payload);
    const criticalAlerts = result.kpis.find((item) => item.id === "critical-alerts");

    expect(result.kpis).toHaveLength(4);
    expect(result.actions).toHaveLength(3);
    expect(criticalAlerts?.tone).toBe("loss");
    expect(result.actions[0]?.title).toMatch(/stok riski/i);
  });
});
