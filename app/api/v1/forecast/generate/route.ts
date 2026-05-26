import { NextResponse } from "next/server";
import { buildDemandForecastBootstrap, generateDemandForecast } from "@/lib/demand-forecast";
import { getMarketplaces, getProducts } from "@/lib/database-readers";
import type { ForecastHorizon } from "@/lib/demand-forecast-types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseProductId(url: URL) {
  const value = Number(url.searchParams.get("productId") ?? url.searchParams.get("product_id") ?? 0);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseMarketplaceId(url: URL) {
  const value = Number(url.searchParams.get("marketplaceId") ?? url.searchParams.get("marketplace_id") ?? 0);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseHorizonDays(value: string | null): ForecastHorizon | undefined {
  const parsed = Number(value ?? 0);
  if (parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }
  return undefined;
}

function readHorizonDays(value: unknown): ForecastHorizon | undefined {
  const parsed = Number(value ?? 0);
  if (parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }
  return undefined;
}

function toMaybeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function buildSafeBootstrap(input: {
  productId?: number;
  marketplaceId?: number;
  horizonDays: ForecastHorizon;
}) {
  try {
    return {
      ...await buildDemandForecastBootstrap(input.productId, input.marketplaceId, input.horizonDays),
      success: true as const,
    };
  } catch (error) {
    console.error("Forecast bootstrap fallback error:", error);
    const products = (await getProducts()).slice(0, 100).map((product) => ({
      ...product,
      current_stock: Number((product as { stock?: number }).stock ?? 0),
      current_sales_volume: 0,
      current_unit_cost: Number(product.cost ?? 0),
      current_net_profit: 0,
      confidence_score: "Low",
      stock_status: "healthy" as const,
    }));
    const marketplaces = (await getMarketplaces()).slice(0, 20).map((marketplace) => ({
      ...marketplace,
      current_price: 0,
      current_unit_cost: 0,
      current_net_profit: 0,
      stock_status: "healthy" as const,
    }));
    const fallbackProduct = products[0] ?? {
      id: 0,
      name: "Demo ҼrҼn",
      sku: "",
      barcode: "",
      image_url: "",
      category_id: null,
      profile_id: null,
      category_name: "",
      category_path: "",
      description: "",
      cost: 0,
      packaging_cost: 0,
      desi: 0,
      sale_price: 0,
      stock: 0,
      active_channels: [],
      status: "draft",
      status_label: "Taslak",
      current_stock: 0,
      current_sales_volume: 0,
      current_unit_cost: 0,
      current_net_profit: 0,
      confidence_score: "Low",
      stock_status: "healthy" as const,
    };
    const fallbackMarketplace = marketplaces[0] ?? {
      id: 0,
      name: "Demo pazaryeri",
      slug: "demo",
      current_price: 0,
      current_unit_cost: 0,
      current_net_profit: 0,
      stock_status: "healthy" as const,
    };

    return {
      products: products.length > 0 ? products : [fallbackProduct],
      marketplaces: marketplaces.length > 0 ? marketplaces : [fallbackMarketplace],
      horizons: [7, 14, 30] as ForecastHorizon[],
      defaults: {
        productId: input.productId ?? fallbackProduct.id,
        marketplaceId: input.marketplaceId ?? fallbackMarketplace.id,
        horizonDays: input.horizonDays,
      },
      selectedProduct: fallbackProduct,
      selectedMarketplace: fallbackMarketplace,
      result: {
        product: fallbackProduct,
        marketplace: fallbackMarketplace,
        selection: {
          productId: input.productId ?? fallbackProduct.id,
          marketplaceId: input.marketplaceId ?? fallbackMarketplace.id,
          horizonDays: input.horizonDays,
        },
        summary: {
          horizonDays: input.horizonDays,
          historyWindowDays: 0,
          currentStock: 0,
          currentSalesVolume: 0,
          currentPrice: 0,
          currentUnitCost: 0,
          unitNetProfit: 0,
          totalForecastUnits: 0,
          monthlyDemand: 0,
          expectedRevenue: 0,
          expectedNetProfit: 0,
          wmape: 1,
          confidenceScore: "Low",
          modelName: "FallbackBaseline",
          forecastStartDate: new Date().toISOString().slice(0, 10),
          forecastEndDate: new Date().toISOString().slice(0, 10),
          stockWarning: "Veri bulunamadı.",
          dataSource: "synthetic",
        },
        chartData: [],
        tableRows: [],
        methodology: "Veri bulunamadığı için yedek tahmin üretildi.",
        warnings: ["Tahmin verisi Ҽretilemedi, yedek gҶrҼnҼm gҶsteriliyor."],
        generatedAt: new Date().toISOString(),
      },
      historyDepthDays: 0,
      warnings: ["Tahmin verisi Ҽretilemedi, yedek gҶrҼnҼm gҶsteriliyor."],
      methodology: "Veri bulunamadığı için yedek tahmin üretildi.",
    };
  }
}

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const url = new URL(request.url);
    const bootstrap = await buildSafeBootstrap({
      productId: parseProductId(url),
      marketplaceId: parseMarketplaceId(url),
      horizonDays: parseHorizonDays(url.searchParams.get("horizonDays")) ?? 14,
    });

    return NextResponse.json(bootstrap);
  } catch (error) {
    console.error("Forecast bootstrap error:", error);
    return NextResponse.json(await buildSafeBootstrap({ horizonDays: 14 }), { status: 200 });
  }
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const input = {
      productId: Number(body.productId ?? body.product_id ?? 0) || undefined,
      marketplaceId: Number(body.marketplaceId ?? body.marketplace_id ?? 0) || undefined,
      horizonDays: readHorizonDays(body.horizonDays ?? body.horizon_days),
      currentSalesVolume: toMaybeNumber(body.currentSalesVolume ?? body.current_sales_volume),
      currentStock: toMaybeNumber(body.currentStock ?? body.current_stock),
      persist: body.persist !== false,
    };

    const result = await generateDemandForecast(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Forecast generation error:", error);
    const bootstrap = await buildSafeBootstrap({ horizonDays: 14 });
    return NextResponse.json({
      success: true,
      result: bootstrap.result,
      savedRows: 0,
      warnings: bootstrap.warnings,
    });
  }
}
