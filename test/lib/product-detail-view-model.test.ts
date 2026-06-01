import { describe, expect, it } from "vitest";

import { buildProductDetailViewModel, type ProductDetailResponse, type ProductDetailTrendPoint } from "@/lib/product-detail-view-model";

function buildTrend(days: number, units = 3, revenue = 1500): ProductDetailTrendPoint[] {
  return Array.from({ length: days }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1} May`,
    units,
    revenue,
    order_count: Math.max(1, Math.round(units / 2)),
  }));
}

function buildResponse(overrides: Partial<ProductDetailResponse> = {}): ProductDetailResponse {
  return {
    success: true,
    product: {
      id: 7,
      name: "Hesap G Smart Bottle Pro",
      sku: "HG-BTL-007",
      barcode: "869100000777",
      categoryPath: "Home > Smart Living > Bottles",
      categoryName: "Bottles",
      imageUrl: "/demo-products/product-01.jpg",
      description:
        "Smart insulated bottle with hydration reminders, spill protection, and thermal retention for all-day daily use across work, commute, and training sessions.",
      cost: 120,
      packagingCost: 18,
      desi: 1.2,
      status: "active",
      stock: 90,
    },
    channels: [
      {
        channelName: "Trendyol",
        slug: "trendyol",
        salePrice: 399,
        buyboxPrice: 389,
        shipping: 32,
        commission: 48,
        totalCost: 248,
        netProfit: 151,
        margin: 37.8,
      },
      {
        channelName: "Hepsiburada",
        slug: "hepsiburada",
        salePrice: 405,
        buyboxPrice: 395,
        shipping: 34,
        commission: 44,
        totalCost: 252,
        netProfit: 153,
        margin: 37.7,
      },
      {
        channelName: "Own Website",
        slug: "own_website",
        salePrice: 419,
        buyboxPrice: null,
        shipping: 28,
        commission: 14,
        totalCost: 228,
        netProfit: 191,
        margin: 45.6,
      },
    ],
    salesTrend30: buildTrend(30, 3, 1200),
    salesTrend90: buildTrend(90, 2, 900),
    salesSummary30: {
      totalUnits: 90,
      totalRevenue: 36000,
      activeDays: 30,
      avgDailyUnits: 3,
      peakDay: { date: "2026-05-18", units: 6 },
    },
    salesSummary90: {
      totalUnits: 180,
      totalRevenue: 72000,
      activeDays: 90,
      avgDailyUnits: 2,
      peakDay: { date: "2026-04-11", units: 5 },
    },
    ...overrides,
  };
}

describe("buildProductDetailViewModel", () => {
  it("prioritizes Edit Product when critical completeness gaps exist", () => {
    const response = buildResponse({
      product: {
        ...buildResponse().product!,
        cost: 0,
        packagingCost: 0,
      },
      channels: [
        {
          channelName: "Trendyol",
          slug: "trendyol",
          salePrice: null,
          buyboxPrice: 389,
          shipping: 32,
          commission: 48,
          totalCost: 248,
          netProfit: 151,
          margin: 37.8,
        },
      ],
    });

    const viewModel = buildProductDetailViewModel(response);

    expect(viewModel?.nextActionId).toBe("edit");
    expect(viewModel?.completeness.readyCount).toBeLessThan(viewModel?.completeness.totalCount ?? 0);
  });

  it("prioritizes Optimize Price when one active channel is margin-risky", () => {
    const response = buildResponse({
      channels: [
        {
          channelName: "Trendyol",
          slug: "trendyol",
          salePrice: 399,
          buyboxPrice: 389,
          shipping: 32,
          commission: 48,
          totalCost: 382,
          netProfit: 17,
          margin: 4.2,
        },
        {
          channelName: "Hepsiburada",
          slug: "hepsiburada",
          salePrice: 405,
          buyboxPrice: 395,
          shipping: 34,
          commission: 44,
          totalCost: 252,
          netProfit: 153,
          margin: 37.7,
        },
        {
          channelName: "Own Website",
          slug: "own_website",
          salePrice: 419,
          buyboxPrice: null,
          shipping: 28,
          commission: 14,
          totalCost: 228,
          netProfit: 191,
          margin: 45.6,
        },
      ],
    });

    const viewModel = buildProductDetailViewModel(response);

    expect(viewModel?.nextActionId).toBe("optimize");
    expect(viewModel?.channelCards).toHaveLength(3);
    expect(viewModel?.channelCards.find((card) => card.id === "trendyol")?.tone).toBe("warning");
  });

  it("prioritizes View Forecast when commerce is healthy but stock coverage is tight", () => {
    const response = buildResponse({
      product: {
        ...buildResponse().product!,
        stock: 40,
      },
      salesSummary30: {
        totalUnits: 120,
        totalRevenue: 48000,
        activeDays: 30,
        avgDailyUnits: 2,
        peakDay: { date: "2026-05-18", units: 6 },
      },
    });

    const viewModel = buildProductDetailViewModel(response);

    expect(viewModel?.nextActionId).toBe("forecast");
    expect(viewModel?.stockRisk.label).toBe("Takip");
  });

  it("prioritizes Generate SEO when finance and stock are healthy but content is weak", () => {
    const response = buildResponse({
      product: {
        ...buildResponse().product!,
        description: "Short copy.",
        imageUrl: null,
      },
    });

    const viewModel = buildProductDetailViewModel(response);

    expect(viewModel?.nextActionId).toBe("seo");
    expect(viewModel?.seoReadiness.score).toBeLessThan(80);
  });
});
