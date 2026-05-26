import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, requireAuthMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { GET } from "@/app/api/data-center/sales-history/route";

function createRequest(url = "http://localhost/api/data-center/sales-history?view=sales&page=1&page_size=40") {
  return new Request(url) as NextRequest;
}

describe("sales history route", () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
  });

  it("uses Postgres-safe group by expressions for marketplace and product summaries", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          total_orders: 4,
          total_units: 9,
          total_revenue: 12500,
          unique_products: 2,
          active_marketplaces: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          marketplace_name: "Trendyol",
          marketplace_slug: "trendyol",
          order_count: 3,
          revenue: 8600,
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 181,
          product_name: "Demo Akıllı Saat Neo S1",
          product_sku: "DEMO-WTCH-001",
          units: 6,
          revenue: 9100,
        },
      ])
      .mockResolvedValueOnce([{ total_rows: 4 }])
      .mockResolvedValueOnce([
        {
          order_id: 42029,
          order_date: "2026-05-16",
          status: "completed",
          external_order_number: "DEMO-ORDER-1",
          external_package_number: "DEMO-PKG-1",
          marketplace_name: "Trendyol",
          marketplace_slug: "trendyol",
          product_id: 181,
          product_name: "Demo Akıllı Saat Neo S1",
          product_sku: "DEMO-WTCH-001",
          quantity: 2,
          unit_price: 2388.86,
          line_total: 4777.72,
        },
      ]);

    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);

    const topMarketplaceSql = queryMock.mock.calls[1]?.[0] as string;
    const topProductSql = queryMock.mock.calls[2]?.[0] as string;

    expect(topMarketplaceSql).toContain("GROUP BY o.marketplace_id, COALESCE(m.name, m.slug, 'Kanal'), COALESCE(m.slug, 'market')");
    expect(topProductSql).toContain("GROUP BY COALESCE(oi.product_id, o.product_id), COALESCE(p.name, oi.merchant_sku, 'Ürün'), COALESCE(p.sku, oi.merchant_sku)");
  });
});
