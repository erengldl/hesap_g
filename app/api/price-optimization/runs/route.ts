import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { PriceOptimizationRunListResponse, PriceOptimizationRunSummary } from "@/lib/price-optimization-types";

export const dynamic = "force-dynamic";

type RawRunRow = {
  run_id: string;
  product_id: number;
  marketplace_id: number;
  product_name: string;
  marketplace_name: string;
  status: "DRAFT" | "PUBLISHED";
  current_price: number;
  recommended_price: number;
  expected_profit_current: number;
  expected_profit_recommended: number;
  confidence_score: "Low" | "Medium" | "High";
  created_at: string;
  published_at: string | null;
};

function parseNumeric(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLimit(value: number) {
  return Math.max(1, Math.min(25, Math.round(value)));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = clampLimit(parseNumeric(url.searchParams.get("limit"), 8));
    const productId = parseNumeric(url.searchParams.get("productId"), 0);
    const marketplaceId = parseNumeric(url.searchParams.get("marketplaceId"), 0);

    const filters: string[] = [];
    const params: Array<number> = [];

    if (productId > 0) {
      filters.push("r.product_id = ?");
      params.push(productId);
    }

    if (marketplaceId > 0) {
      filters.push("r.marketplace_id = ?");
      params.push(marketplaceId);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const runs = query<RawRunRow>(
      `
      SELECT
        r.run_id,
        r.product_id,
        r.marketplace_id,
        COALESCE(p.name, 'Bilinmeyen Ürün') AS product_name,
        COALESCE(m.name, 'Bilinmeyen Kanal') AS marketplace_name,
        UPPER(COALESCE(r.status, 'DRAFT')) AS status,
        r.current_price,
        r.recommended_price,
        r.expected_profit_current,
        r.expected_profit_recommended,
        r.confidence_score,
        COALESCE(r.created_at, CURRENT_TIMESTAMP) AS created_at,
        r.published_at
      FROM price_optimization_runs r
      LEFT JOIN products p ON p.product_id = r.product_id
      LEFT JOIN marketplaces m ON m.marketplace_id = r.marketplace_id
      ${whereClause}
      ORDER BY COALESCE(r.published_at, r.created_at) DESC, r.run_id DESC
      LIMIT ${limit}
      `,
      params
    );

    const payload: PriceOptimizationRunListResponse = {
      success: true,
      runs: runs.map((run): PriceOptimizationRunSummary => {
        const profitChangePercent =
          run.expected_profit_current !== 0
            ? Math.round(((run.expected_profit_recommended - run.expected_profit_current) / Math.abs(run.expected_profit_current)) * 10000) / 100
            : null;

        return {
          run_id: run.run_id,
          product_id: run.product_id,
          marketplace_id: run.marketplace_id,
          product_name: run.product_name,
          marketplace_name: run.marketplace_name,
          status: run.status,
          current_price: run.current_price,
          recommended_price: run.recommended_price,
          expected_profit_current: run.expected_profit_current,
          expected_profit_recommended: run.expected_profit_recommended,
          confidence_score: run.confidence_score,
          created_at: run.created_at,
          published_at: run.published_at,
          profit_change_percent: profitChangePercent,
        };
      }),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Price optimization runs GET error:", error);
    return NextResponse.json(
      { success: false, runs: [], error: "Fiyat optimizasyon geçmişi yüklenemedi." } satisfies PriceOptimizationRunListResponse,
      { status: 500 }
    );
  }
}
