import { NextResponse } from "next/server";
import { getForecastBootstrapData, runDemandForecastData } from "@/lib/forecast-service-client";
import type { ForecastHorizon } from "@/lib/demand-forecast-types";

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

function toMaybeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bootstrap = await getForecastBootstrapData({
      productId: parseProductId(url),
      marketplaceId: parseMarketplaceId(url),
      horizonDays: parseHorizonDays(url.searchParams.get("horizonDays")) ?? 14,
    });

    return NextResponse.json(bootstrap);
  } catch (error) {
    console.error("Forecast bootstrap error:", error);
    return NextResponse.json({ success: false, error: "Tahmin hazırlanamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await runDemandForecastData({
      productId: Number(body.productId ?? body.product_id ?? 0) || undefined,
      marketplaceId: Number(body.marketplaceId ?? body.marketplace_id ?? 0) || undefined,
      horizonDays:
        Number(body.horizonDays ?? body.horizon_days ?? 0) === 7
          ? 7
          : Number(body.horizonDays ?? body.horizon_days ?? 0) === 14
            ? 14
            : Number(body.horizonDays ?? body.horizon_days ?? 0) === 30
              ? 30
              : undefined,
      currentSalesVolume: toMaybeNumber(body.currentSalesVolume ?? body.current_sales_volume),
      currentStock: toMaybeNumber(body.currentStock ?? body.current_stock),
      persist: body.persist !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Forecast generation error:", error);
    return NextResponse.json({ success: false, error: "Tahmin oluşturulamadı." }, { status: 500 });
  }
}
