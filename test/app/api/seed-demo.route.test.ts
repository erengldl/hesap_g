import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureDemoDataMock,
  recalculateAllCostResultsMock,
  refreshCampaignProfitMetricsMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  ensureDemoDataMock: vi.fn(),
  recalculateAllCostResultsMock: vi.fn(),
  refreshCampaignProfitMetricsMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/seed-demo-data", () => ({
  ensureDemoData: ensureDemoDataMock,
}));

vi.mock("@/lib/portfolio-analytics", () => ({
  recalculateAllCostResults: recalculateAllCostResultsMock,
}));

vi.mock("@/lib/ad-analysis", () => ({
  refreshCampaignProfitMetrics: refreshCampaignProfitMetricsMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
  primeRequestContextFromApiContext: vi.fn(),
}));

import { POST } from "@/app/api/seed-demo/route";

describe("seed-demo route", () => {
  beforeEach(() => {
    ensureDemoDataMock.mockReset();
    recalculateAllCostResultsMock.mockReset();
    refreshCampaignProfitMetricsMock.mockReset();
    requireAuthMock.mockReset();

    requireAuthMock.mockResolvedValue({
      userId: 1,
      authUserId: "test-auth-user",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Pro",
    });
  });

  it("returns success even if recalculation helpers fail after demo seed", async () => {
    ensureDemoDataMock.mockResolvedValue({
      success: true,
      productsInserted: 5,
      productsSkipped: 0,
      settingsInserted: 15,
      ordersInserted: 90,
      orderItemsInserted: 90,
      inventoryRowsInserted: 450,
      message: "Demo verisi yüklendi.",
      warning: "Demo uyarısı",
    });
    recalculateAllCostResultsMock.mockResolvedValue(5);
    refreshCampaignProfitMetricsMock.mockRejectedValue(new Error("campaign refresh failed"));

    const response = await POST(
      new Request("http://localhost/api/seed-demo", {
        method: "POST",
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ensureDemoDataMock).toHaveBeenCalledWith("test-auth-user");
    expect(data.success).toBe(true);
    expect(data.warning).toContain("Demo verisi yüklendi ancak bazı özet hesaplar tamamlanamadı.");
  });
});
