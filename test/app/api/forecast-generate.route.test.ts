import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildDemandForecastBootstrapMock,
  generateDemandForecastMock,
  getMarketplacesMock,
  getProductsMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  buildDemandForecastBootstrapMock: vi.fn(),
  generateDemandForecastMock: vi.fn(),
  getMarketplacesMock: vi.fn(),
  getProductsMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/demand-forecast", () => ({
  buildDemandForecastBootstrap: buildDemandForecastBootstrapMock,
  generateDemandForecast: generateDemandForecastMock,
}));

vi.mock("@/lib/database-readers", () => ({
  getMarketplaces: getMarketplacesMock,
  getProducts: getProductsMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
  primeRequestContextFromApiContext: vi.fn(),
}));

import { POST } from "@/app/api/v1/forecast/generate/route";

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/forecast/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("forecast generate route", () => {
  beforeEach(() => {
    buildDemandForecastBootstrapMock.mockReset();
    generateDemandForecastMock.mockReset();
    getMarketplacesMock.mockReset();
    getProductsMock.mockReset();
    requireAuthMock.mockReset();

    requireAuthMock.mockResolvedValue({
      userId: 1,
      authUserId: "test-auth-user",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
  });

  it("wraps successful POST results in the expected API envelope", async () => {
    generateDemandForecastMock.mockResolvedValue({
      product: { id: 181, name: "Demo Akıllı Saat Neo S1" },
      marketplace: { id: 1, name: "Trendyol", slug: "trendyol" },
      selection: { productId: 181, marketplaceId: 1, horizonDays: 14 },
      summary: {
        horizonDays: 14,
        historyWindowDays: 120,
        currentStock: 30,
        currentSalesVolume: 2.4,
        currentPrice: 2499,
        currentUnitCost: 1800,
        unitNetProfit: 699,
        totalForecastUnits: 28,
        monthlyDemand: 28,
        expectedRevenue: 69972,
        expectedNetProfit: 19572,
        wmape: 0.12,
        confidenceScore: "High",
        modelName: "StatisticalBaselineModel",
        forecastStartDate: "2026-05-28",
        forecastEndDate: "2026-06-10",
        stockWarning: "STOK GUVENDE",
        dataSource: "real",
      },
      chartData: [],
      tableRows: [
        {
          date: "2026-05-28",
          label: "28 May",
          predicted_units: 2,
          lower_bound: 1,
          upper_bound: 3,
          revenue: 4998,
          projected_stock: 28,
          risk_level: "Low",
          is_forecast: true,
        },
      ],
      methodology: "test methodology",
      warnings: [],
      generatedAt: "2026-05-27T00:00:00.000Z",
    });

    const response = await POST(
      createRequest({
        productId: 181,
        marketplaceId: 1,
        horizonDays: 14,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      savedRows: 1,
      warnings: [],
      result: {
        selection: { productId: 181, marketplaceId: 1, horizonDays: 14 },
      },
    });
  });
});
