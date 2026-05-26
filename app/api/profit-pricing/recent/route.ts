import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { listProfitPricingRuns } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

function parseProductId(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 8);
  return Math.max(1, Math.min(25, Number.isFinite(parsed) ? Math.round(parsed) : 8));
}

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const url = new URL(request.url);
    const productId = parseProductId(url.searchParams.get("productId"));
    const limit = parseLimit(url.searchParams.get("limit"));

    return NextResponse.json({
      ok: true,
      data: listProfitPricingRuns(limit, productId),
    });
  } catch (error) {
    console.error("Profit pricing recent GET error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Son kayıtlar alınamadı.",
      },
      { status: 500 }
    );
  }
}

