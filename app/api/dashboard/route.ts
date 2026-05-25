import { NextResponse } from "next/server";

import { buildAdAnalysis, buildAdAnalysisSummary } from "@/lib/ad-analysis";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getProducts } from "@/lib/database-readers";
import { buildAggregateDashboard, buildDashboardSnapshot } from "@/lib/portfolio-analytics";
import { getCachedValue } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

type DashboardDataMode = "demo" | "live" | "partial";

type DashboardDataQuality = {
  score: number;
  warnings: string[];
  lastSyncAt: string | null;
};

function isDemoSku(value?: string | null) {
  return String(value ?? "").trim().toUpperCase().startsWith("DEMO-");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeQualityWarnings(rawWarnings: string[]) {
  const warnings = new Set<string>();

  for (const warning of rawWarnings) {
    if (/KDV/i.test(warning)) warnings.add("KDV hesaplanmadi.");
    if (/komisyon/i.test(warning)) warnings.add("Komisyon kategori eslesmesi yok.");
    if (/kargo/i.test(warning)) warnings.add("Kargo sirketi eslesmesi eksik.");
  }

  return warnings;
}

async function buildDashboardDataSignals(): Promise<{ dataMode: DashboardDataMode; dataQuality: DashboardDataQuality }> {
  const db = getDb();
  const products = await getProducts();
  const hasProducts = products.length > 0;
  const hasDemoProducts = products.some((product) => isDemoSku(product.sku));
  const hasLiveProducts = products.some((product) => !isDemoSku(product.sku));
  const warnings = new Set<string>();

  if (!db) {
    return {
      dataMode: hasDemoProducts && !hasLiveProducts ? "demo" : "partial",
      dataQuality: {
        score: 0,
        warnings: ["Veritabani baglantisi kurulamadi."],
        lastSyncAt: null,
      },
    };
  }

  const orderSignalRow = await db.prepare(`
    SELECT
      SUM(
        CASE
          WHEN COALESCE(o.external_order_number, '') LIKE 'DEMO-%'
            OR COALESCE(o.external_package_number, '') LIKE 'DEMO-%'
            OR COALESCE(o.merchant_sku, '') LIKE 'DEMO-%'
          THEN 1
          ELSE 0
        END
      ) AS demo_orders,
      SUM(
        CASE
          WHEN COALESCE(o.external_order_number, '') LIKE 'DEMO-%'
            OR COALESCE(o.external_package_number, '') LIKE 'DEMO-%'
            OR COALESCE(o.merchant_sku, '') LIKE 'DEMO-%'
          THEN 0
          ELSE 1
        END
      ) AS live_orders
    FROM orders o
    WHERE o.status = 'completed'
  `).get() as { demo_orders: number | null; live_orders: number | null } | undefined;

  const latestSyncRow = await db.prepare(`
    SELECT created_at
    FROM data_center_sync_runs
    ORDER BY created_at DESC, sync_id DESC
    LIMIT 1
  `).get() as { created_at: string | null } | undefined;

  const latestOrderSyncRow = await db.prepare(`
    SELECT COALESCE(last_synced_at, updated_at, created_at) AS sync_at
    FROM orders
    ORDER BY COALESCE(last_synced_at, updated_at, created_at) DESC, order_id DESC
    LIMIT 1
  `).get() as { sync_at: string | null } | undefined;

  const warningRows = await db.prepare(`
    SELECT warning_notes
    FROM cost_results
    WHERE warning_notes IS NOT NULL AND TRIM(warning_notes) <> ''
    LIMIT 100
  `).all() as Array<{ warning_notes: string }>;

  const missingCategoryRow = await db.prepare(`
    SELECT COUNT(*) AS missing_count
    FROM products
    WHERE category_id IS NULL OR TRIM(COALESCE(category_path, '')) = ''
  `).get() as { missing_count: number | null } | undefined;

  const demoOrderCount = Number(orderSignalRow?.demo_orders ?? 0);
  const liveOrderCount = Number(orderSignalRow?.live_orders ?? 0);
  const lastSyncAt = latestSyncRow?.created_at ?? latestOrderSyncRow?.sync_at ?? null;
  const normalizedWarnings = normalizeQualityWarnings(
    warningRows.map((row) => row.warning_notes).filter(Boolean)
  );

  for (const warning of normalizedWarnings) {
    warnings.add(warning);
  }

  if (Number(missingCategoryRow?.missing_count ?? 0) > 0) {
    warnings.add("Kategori eslesmesi eksik.");
  }
  if (!hasProducts) {
    warnings.add("Urun verisi bulunmuyor.");
  }
  if (!lastSyncAt) {
    warnings.add("Veri merkezi henuz senkronize edilmedi.");
  }
  if (liveOrderCount === 0) {
    warnings.add(hasDemoProducts || demoOrderCount > 0 ? "Gercek siparis verisi bulunmuyor." : "Tamamlanmis siparis verisi bulunmuyor.");
  }
  if (hasDemoProducts && hasLiveProducts) {
    warnings.add("Demo ve canli urunler birlikte gorunuyor.");
  }

  const hasDemoSignal = hasDemoProducts || demoOrderCount > 0;
  const hasLiveSignal = hasLiveProducts || liveOrderCount > 0;
  const dataMode: DashboardDataMode =
    hasDemoSignal && !hasLiveSignal
      ? "demo"
      : hasDemoSignal && hasLiveSignal
        ? "partial"
        : hasLiveSignal
          ? "live"
          : "partial";

  let score = hasProducts ? 100 : 0;

  if (dataMode === "demo") score -= 30;
  if (dataMode === "partial") score -= 18;
  if (!lastSyncAt) score -= 12;
  if (liveOrderCount === 0 && dataMode !== "demo") score -= 15;
  if (warnings.has("KDV hesaplanmadi.")) score -= 8;
  if (warnings.has("Komisyon kategori eslesmesi yok.")) score -= 8;
  if (warnings.has("Kargo sirketi eslesmesi eksik.")) score -= 6;
  if (warnings.has("Kategori eslesmesi eksik.")) score -= 6;
  if (warnings.has("Demo ve canli urunler birlikte gorunuyor.")) score -= 5;

  if (dataMode === "demo") {
    score = clamp(score, 65, 70);
  }

  return {
    dataMode,
    dataQuality: {
      score: clamp(Math.round(score), 0, 100),
      warnings: Array.from(warnings),
      lastSyncAt,
    },
  };
}

function buildFallbackAggregate() {
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
    methodology: "Canli ozet uretilemedigi icin bos baslangic verisi gosteriliyor.",
  };
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  try {
    const [aggregate, snapshot, adAnalysis, dataSignals] = await Promise.all([
      getCachedValue("dashboard:aggregate", 15_000, async () => {
        try {
          return await buildAggregateDashboard() ?? buildFallbackAggregate();
        } catch (error) {
          console.error("Dashboard aggregate fallback:", error);
          return buildFallbackAggregate();
        }
      }),
      getCachedValue("dashboard:snapshot", 15_000, async () => {
        try {
          return await buildDashboardSnapshot();
        } catch (error) {
          console.error("Dashboard snapshot fallback:", error);
          return null;
        }
      }),
      getCachedValue("dashboard:ad-analysis", 15_000, async () => {
        try {
          const cachedSummary = await buildAdAnalysisSummary();
          if (cachedSummary) {
            return cachedSummary;
          }

          const computed = await buildAdAnalysis();
          if (!computed) {
            return null;
          }

          return {
            totalSpend: computed.totalSpend,
            totalNetProfit: computed.totalNetProfit,
            averagePoas: computed.averagePoas,
            lossMakingCount: computed.lossMakingCount,
            watchCount: computed.watchCount,
            scaleCount: computed.scaleCount,
            totalCampaigns: computed.totalCampaigns,
            lastSyncedAt: computed.lastSyncedAt,
          };
        } catch (error) {
          console.error("Dashboard ad-analysis fallback:", error);
          return null;
        }
      }),
      getCachedValue("dashboard:data-signals", 15_000, async () => {
        try {
          return await buildDashboardDataSignals();
        } catch (error) {
          console.error("Dashboard data signals fallback:", error);
          return {
            dataMode: "partial" as DashboardDataMode,
            dataQuality: {
              score: 0,
              warnings: ["Veri kalitesi olculemedi."],
              lastSyncAt: null,
            },
          };
        }
      }),
    ]);

    return NextResponse.json({
      success: true,
      aggregate,
      dataMode: dataSignals.dataMode,
      dataQuality: dataSignals.dataQuality,
      ...(snapshot
        ? {
            product: snapshot.product,
            results: snapshot.results,
            bestChannel: snapshot.bestChannel,
            bestChannelName: snapshot.bestChannelName,
            bestNetProfit: snapshot.bestNetProfit,
            bestMargin: snapshot.bestMargin,
            lowestTotalCost: snapshot.lowestTotalCost,
            totalNetProfit: snapshot.totalNetProfit,
            averageMargin: snapshot.averageMargin,
            costBreakdown: snapshot.costBreakdown,
            methodology: aggregate.methodology,
            adAnalysis: adAnalysis
              ? {
                  totalSpend: adAnalysis.totalSpend,
                  totalNetProfit: adAnalysis.totalNetProfit,
                  averagePoas: adAnalysis.averagePoas,
                  lossMakingCount: adAnalysis.lossMakingCount,
                  watchCount: adAnalysis.watchCount,
                  scaleCount: adAnalysis.scaleCount,
                  totalCampaigns: adAnalysis.totalCampaigns,
                  lastSyncedAt: adAnalysis.lastSyncedAt,
                }
              : null,
          }
        : {
            methodology: aggregate.methodology,
            adAnalysis: adAnalysis
              ? {
                  totalSpend: adAnalysis.totalSpend,
                  totalNetProfit: adAnalysis.totalNetProfit,
                  averagePoas: adAnalysis.averagePoas,
                  lossMakingCount: adAnalysis.lossMakingCount,
                  watchCount: adAnalysis.watchCount,
                  scaleCount: adAnalysis.scaleCount,
                  totalCampaigns: adAnalysis.totalCampaigns,
                  lastSyncedAt: adAnalysis.lastSyncedAt,
                }
              : null,
          }),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ success: false, error: "Gosterge paneli ozeti olusturulamadi." }, { status: 500 });
  }
}
