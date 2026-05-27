import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  savePriceOptimizationRun,
  runPriceOptimization,
  type PriceOptimizationInput,
} from "@/lib/price-optimization";
import type { PriceOptimizationResult } from "@/lib/price-optimization-types";

export const dynamic = "force-dynamic";

function parseNumeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInput(payload: Partial<PriceOptimizationInput>) {
  return {
    productId: parseNumeric(payload.productId, 0),
    marketplaceId: parseNumeric(payload.marketplaceId, 0),
    minPrice: parseNumeric(payload.minPrice, 0),
    maxPrice: parseNumeric(payload.maxPrice, 0),
    currentSalesVolume: parseNumeric(payload.currentSalesVolume, 0),
    stock: parseNumeric(payload.stock, 0),
    elasticityEstimate:
      payload.elasticityEstimate === null || payload.elasticityEstimate === undefined
        ? null
        : parseNumeric(payload.elasticityEstimate, 0),
  };
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<PriceOptimizationInput> & { persist?: boolean };
    const input = parseInput(body);
    const shouldPersist = body.persist !== false;

    if (!input.productId || !input.marketplaceId || input.minPrice <= 0 || input.maxPrice <= 0) {
      return NextResponse.json(
        { success: false, error: "productId, marketplaceId, minPrice ve maxPrice alanları zorunludur." },
        { status: 400 }
      );
    }

    const result = await runPriceOptimization(input);
    if (!result) {
      return NextResponse.json({ success: false, error: "Fiyat optimizasyonu hesaplanamadı." }, { status: 404 });
    }

    const draftResult: PriceOptimizationResult = {
      ...result,
      run_status: "DRAFT",
    };

    let runId: string | undefined;
    if (shouldPersist) {
      runId = await savePriceOptimizationRun(draftResult) ?? undefined;
      if (!runId) {
        return NextResponse.json({ success: false, error: "Optimizasyon kaydı oluşturulamadı." }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      run_id: runId,
      result: {
        ...draftResult,
        ...(runId ? { run_id: runId } : {}),
      },
    });
  } catch (error) {
    console.error("Price optimization analyze POST error:", error);
    return NextResponse.json({ success: false, error: "Optimizasyon sonucu hesaplanamadı." }, { status: 500 });
  }
}
