import { NextResponse } from "next/server";
import { buildSynchronizedOptimizationPreview } from "@/lib/price-optimization";
import type { PriceOptimizationApiResponse } from "@/lib/price-optimization-types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function parseNumeric(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function buildResponse(productId?: number, marketplaceId?: number) {
  const preview = await buildSynchronizedOptimizationPreview(productId, marketplaceId);
  if (!preview) {
    return NextResponse.json({ success: false, error: "Optimizasyon verisi bulunamadı." }, { status: 404 });
  }

  const payload: PriceOptimizationApiResponse = {
    success: true,
    ...preview.bootstrap,
    result: preview.result
      ? {
          ...preview.result,
        }
      : null,
    warning: preview.result ? undefined : "Optimizasyon hesabı tamamlanamadı; ön bilgi yüklendi.",
  };

  return NextResponse.json(payload);
}

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const url = new URL(request.url);
    const productId = parseNumeric(url.searchParams.get("productId"), 0) || undefined;
    const marketplaceId = parseNumeric(url.searchParams.get("marketplaceId"), 0) || undefined;
    return await buildResponse(productId, marketplaceId);
  } catch (error) {
    console.error("Price optimization GET error:", error);
    return NextResponse.json({ success: false, error: "Optimizasyon verisi yüklenemedi." }, { status: 500 });
  }
}

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return NextResponse.json(
    {
      success: false,
      error: "Kuru çalışma hesaplamaları için /api/price-optimization/analyze kullanın.",
    },
    { status: 405 }
  );
}
