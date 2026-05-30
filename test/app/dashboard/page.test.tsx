import { render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "@/app/dashboard/page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: passthrough,
    ComposedChart: () => <div data-testid="chart" />,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Area: () => null,
    Line: () => null,
  };
});

const populatedPayload = {
  success: true,
  aggregate: {
    totalRevenue: 145000,
    totalOrders: 284,
    totalProducts: 18,
    avgMargin: 31.4,
    totalProfit: 45530,
    channelBreakdown: [],
    topProducts: [
      { id: 1, name: "Akıllı Saat", sku: "AKL-001", revenue: 42000, orders: 76, qty: 80, margin: 33.2 },
      { id: 2, name: "Kulaklık", sku: "KLK-002", revenue: 35000, orders: 58, qty: 61, margin: 24.1 },
    ],
    salesTrend: [
      { date: "2026-05-01", revenue: 3200, orders: 8 },
      { date: "2026-05-02", revenue: 4200, orders: 11 },
      { date: "2026-05-03", revenue: 5100, orders: 13 },
    ],
    stockAlerts: [
      { id: 10, name: "Akıllı Saat", sku: "AKL-001", stock: 4, channel: "Trendyol" },
    ],
    methodology: "Demo methodology",
  },
  adAnalysis: {
    totalSpend: 12000,
    totalNetProfit: 6400,
    averagePoas: 0.52,
    lossMakingCount: 2,
    watchCount: 3,
    scaleCount: 1,
    totalCampaigns: 12,
    lastSyncedAt: "2026-05-30T09:30:00.000Z",
  },
  bestChannelName: "Kendi Websitem",
  bestNetProfit: 8500,
  methodology: "Demo methodology",
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(populatedPayload), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders exactly four primary KPI cards for a populated dashboard", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Net Kâr")).not.toBeNull();
      expect(screen.getAllByText("Ciro").length).toBeGreaterThan(0);
      expect(screen.getByText("Ortalama Marj")).not.toBeNull();
      expect(screen.getByText("Kritik Alarm")).not.toBeNull();
    });

    expect(screen.getByText("Acil Aksiyonlar")).not.toBeNull();
    expect(screen.getByText("Kârlılık Trendi")).not.toBeNull();
  });

  it("falls back to the onboarding empty state when no meaningful data exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({
        success: true,
        aggregate: {
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          avgMargin: 0,
          totalProfit: 0,
          channelBreakdown: [],
          topProducts: [],
          salesTrend: [],
          stockAlerts: [],
          methodology: "Empty",
        },
      }), { status: 200 }))
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Önce veri hazırlığını tamamlayın")).not.toBeNull();
      expect(screen.getByText("Veri Merkezi'ni Aç")).not.toBeNull();
    });
  });
});
