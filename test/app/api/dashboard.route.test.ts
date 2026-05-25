import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildAggregateDashboardMock,
  buildDashboardSnapshotMock,
  buildAdAnalysisMock,
  getProductsMock,
  getDbMock,
  getCachedValueMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  buildAggregateDashboardMock: vi.fn(),
  buildDashboardSnapshotMock: vi.fn(),
  buildAdAnalysisMock: vi.fn(),
  getProductsMock: vi.fn(),
  getDbMock: vi.fn(),
  getCachedValueMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/portfolio-analytics", () => ({
  buildAggregateDashboard: buildAggregateDashboardMock,
  buildDashboardSnapshot: buildDashboardSnapshotMock,
}));

vi.mock("@/lib/ad-analysis", () => ({
  buildAdAnalysis: buildAdAnalysisMock,
}));

vi.mock("@/lib/database-readers", () => ({
  getProducts: getProductsMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/server-cache", () => ({
  getCachedValue: getCachedValueMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { GET } from "@/app/api/dashboard/route";

function createAggregate() {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    avgMargin: 0,
    totalProfit: 0,
    channelBreakdown: [],
    topProducts: [],
    salesTrend: [],
    stockAlerts: [],
    methodology: "Test methodology",
  };
}

function createDb({
  demoOrders,
  liveOrders,
  lastSyncAt,
  orderSyncAt = null,
  warningNotes = [],
  missingCount = 0,
}: {
  demoOrders: number;
  liveOrders: number;
  lastSyncAt: string | null;
  orderSyncAt?: string | null;
  warningNotes?: string[];
  missingCount?: number;
}) {
  return {
    prepare: (sql: string) => {
      if (sql.includes("AS demo_orders")) {
        return {
          get: () => ({ demo_orders: demoOrders, live_orders: liveOrders }),
        };
      }

      if (sql.includes("FROM data_center_sync_runs")) {
        return {
          get: () => ({ created_at: lastSyncAt }),
        };
      }

      if (sql.includes("COALESCE(last_synced_at")) {
        return {
          get: () => ({ sync_at: orderSyncAt }),
        };
      }

      if (sql.includes("FROM cost_results")) {
        return {
          all: () => warningNotes.map((warning_notes) => ({ warning_notes })),
        };
      }

      if (sql.includes("missing_count")) {
        return {
          get: () => ({ missing_count: missingCount }),
        };
      }

      throw new Error(`Unhandled SQL: ${sql}`);
    },
  };
}

describe("dashboard route data signals", () => {
  beforeEach(() => {
    buildAggregateDashboardMock.mockReset();
    buildDashboardSnapshotMock.mockReset();
    buildAdAnalysisMock.mockReset();
    getProductsMock.mockReset();
    getDbMock.mockReset();
    getCachedValueMock.mockReset();
    requireAuthMock.mockReset();

    buildAggregateDashboardMock.mockReturnValue(createAggregate());
    buildDashboardSnapshotMock.mockReturnValue(null);
    buildAdAnalysisMock.mockReturnValue(null);
    getCachedValueMock.mockImplementation((_key: string, _ttl: number, loader: () => unknown) => loader());
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
  });

  it("returns demo mode with a quality score between 65 and 70 for seeded demo data", async () => {
    getProductsMock.mockReturnValue([{ sku: "DEMO-001" }]);
    getDbMock.mockReturnValue(
      createDb({
        demoOrders: 20,
        liveOrders: 0,
        lastSyncAt: "2026-05-25T10:00:00.000Z",
      })
    );

    const response = await GET();
    const data = await response.json();

    expect(data.dataMode).toBe("demo");
    expect(data.dataQuality.score).toBeGreaterThanOrEqual(65);
    expect(data.dataQuality.score).toBeLessThanOrEqual(70);
  });

  it("returns live mode when there are only live products and live orders", async () => {
    getProductsMock.mockReturnValue([{ sku: "SKU-001" }]);
    getDbMock.mockReturnValue(
      createDb({
        demoOrders: 0,
        liveOrders: 12,
        lastSyncAt: "2026-05-25T10:00:00.000Z",
      })
    );

    const response = await GET();
    const data = await response.json();

    expect(data.dataMode).toBe("live");
    expect(data.dataQuality.score).toBeGreaterThan(80);
  });

  it("returns partial mode when demo and live signals are mixed", async () => {
    getProductsMock.mockReturnValue([{ sku: "DEMO-001" }, { sku: "SKU-001" }]);
    getDbMock.mockReturnValue(
      createDb({
        demoOrders: 6,
        liveOrders: 8,
        lastSyncAt: "2026-05-25T10:00:00.000Z",
      })
    );

    const response = await GET();
    const data = await response.json();

    expect(data.dataMode).toBe("partial");
    expect(data.dataQuality.warnings).toContain("Demo ve canli urunler birlikte gorunuyor.");
  });
});
