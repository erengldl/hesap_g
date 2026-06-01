import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ProductDetailClient from "@/components/products/ProductDetailClient";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="composed-chart">{children}</svg>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Area: () => null,
  Line: () => null,
}));

const mockResponse = {
  success: true,
  product: {
    id: 1,
    name: "Hesap G Smart Bottle Pro",
    sku: "HG-BTL-001",
    barcode: "869100001001",
    categoryPath: "Home > Smart Living > Bottles",
    categoryName: "Bottles",
    imageUrl: "/demo-products/product-01.jpg",
    description:
      "Smart insulated bottle with hydration reminders, spill protection, and thermal retention for daily use across work, commute, and training sessions.",
    cost: 120,
    packagingCost: 18,
    desi: 1.2,
    status: "active",
    stock: 42,
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
      warningNotes: null,
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
      warningNotes: null,
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
      warningNotes: null,
    },
  ],
  salesTrend30: Array.from({ length: 30 }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    label: `May ${index + 1}`,
    units: 3,
    revenue: 1200,
    order_count: 2,
  })),
  salesTrend90: Array.from({ length: 90 }, (_, index) => ({
    date: `2026-03-${String((index % 30) + 1).padStart(2, "0")}`,
    label: `Day ${index + 1}`,
    units: 2,
    revenue: 900,
    order_count: 1,
  })),
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
};

describe("ProductDetailClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the analytical product profile with actions and key sections", async () => {
    render(<ProductDetailClient />);

    await waitFor(() => {
      expect(screen.getByText("Hesap G Smart Bottle Pro")).toBeInTheDocument();
    });

    expect(screen.getByText("Edit Product")).toBeInTheDocument();
    expect(screen.getAllByText("Optimize Price").length).toBeGreaterThan(0);
    expect(screen.getAllByText("View Forecast").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Generate SEO").length).toBeGreaterThan(0);
    expect(screen.getByText("Product financial snapshot")).toBeInTheDocument();
    expect(screen.getByText("Channel performance")).toBeInTheDocument();
    expect(screen.getByText("Sales history trend")).toBeInTheDocument();
    expect(screen.getByText("Stock and demand risk")).toBeInTheDocument();
    expect(screen.getByText("SEO and content readiness")).toBeInTheDocument();
    expect(screen.getByText("Product data completeness")).toBeInTheDocument();
  });
});
