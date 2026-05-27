import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildDemoProductDetailResponseMock,
  getDbMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  buildDemoProductDetailResponseMock: vi.fn(),
  getDbMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/cost-engine", () => ({
  recalculateCostResultsForProductFromDatabase: vi.fn(),
}));

vi.mock("@/lib/product-history", () => ({
  getProductMarginSnapshots: vi.fn(),
  getProductOrderHistory: vi.fn(),
  getProductSalesTrend: vi.fn(),
  summarizeProductTrend: vi.fn(),
  buildProductDescriptionFallback: vi.fn(),
}));

vi.mock("@/lib/demo-product-detail", () => ({
  buildDemoProductDetailResponse: buildDemoProductDetailResponseMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
  primeRequestContextFromApiContext: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireCurrentAuthUserId: () => "test-auth-user",
}));

import { GET } from "@/app/api/products/[id]/route";

describe("product detail route", () => {
  beforeEach(() => {
    buildDemoProductDetailResponseMock.mockReset();
    getDbMock.mockReset();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      authUserId: "test-auth-user",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
    delete process.env.ALLOW_DEMO_FALLBACK;
  });

  it("returns 404 in production when the product does not exist", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    getDbMock.mockReturnValue({
      prepare: () => ({
        get: () => undefined,
      }),
    });

    try {
      const response = await GET(
        new Request("http://localhost/api/products/999") as NextRequest,
        { params: Promise.resolve({ id: "999" }) }
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Ürün bulunamadı.",
      });
      expect(buildDemoProductDetailResponseMock).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
