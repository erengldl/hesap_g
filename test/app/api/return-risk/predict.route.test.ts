import { beforeEach, describe, expect, it, vi } from "vitest";

const { predictReturnRiskFromDataCenter, requireAuthMock } = vi.hoisted(() => ({
  predictReturnRiskFromDataCenter: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/return-risk/server", () => ({
  predictReturnRiskFromDataCenter,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { POST } from "@/app/api/return-risk/predict/route";

describe("return risk predict route", () => {
  beforeEach(() => {
    predictReturnRiskFromDataCenter.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Pro",
    });
  });

  it("returns a valid prediction response", async () => {
    predictReturnRiskFromDataCenter.mockReturnValue({
      productId: "123",
      channel: "trendyol",
      price: 549,
      returnProbability: 0.082,
      expectedCostIfReturned: 95,
      expectedReturnRiskCost: 7.79,
      confidence: "medium",
      modelVersion: "return-risk-v1-test",
      modelType: "typescript-logistic-regression",
      usedFallback: false,
      topRiskFactors: ["Kategori iade/fire oranı yüksek"],
      explanation: "Tahmin hazir.",
    });

    const response = await POST(
      new Request("http://localhost/api/return-risk/predict", {
        method: "POST",
        body: JSON.stringify({
          productId: "123",
          channel: "trendyol",
          price: 549,
          demandForecast: 120,
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.expectedReturnRiskCost).toBe(7.79);
    expect(predictReturnRiskFromDataCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "123",
        channel: "trendyol",
        price: 549,
        demandForecast: 120,
      })
    );
  });

  it("rejects missing productId", async () => {
    const response = await POST(
      new Request("http://localhost/api/return-risk/predict", {
        method: "POST",
        body: JSON.stringify({ channel: "trendyol", price: 549 }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    expect(predictReturnRiskFromDataCenter).not.toHaveBeenCalled();
  });

  it("can return fallback predictions when no model exists", async () => {
    predictReturnRiskFromDataCenter.mockReturnValue({
      productId: "123",
      channel: "trendyol",
      price: 549,
      returnProbability: 0.05,
      expectedCostIfReturned: 80,
      expectedReturnRiskCost: 4,
      confidence: "low",
      modelVersion: "return-risk-fallback-v1",
      modelType: "historical-weighted-average",
      usedFallback: true,
      topRiskFactors: ["Ürün bazlı iade/fire verisi sınırlı"],
      explanation: "Fallback kullanıldı.",
    });

    const response = await POST(
      new Request("http://localhost/api/return-risk/predict", {
        method: "POST",
        body: JSON.stringify({ productId: "123", channel: "trendyol", price: 549 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.usedFallback).toBe(true);
  });
});
