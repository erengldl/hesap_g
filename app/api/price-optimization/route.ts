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
  const preview = buildSynchronizedOptimizationPreview(productId, marketplaceId);
  if (!preview) {
    return NextResponse.json({ success: false, error: "Optimizasyon verisi bulunamadÃ„Â±." }, { status: 404 });
  }

  const payload: PriceOptimizationApiResponse = {
    success: true,
    ...preview.bootstrap,
    result: preview.result
      ? {
          ...preview.result,
        }
      : null,
    warning: preview.result ? undefined : "Optimizasyon hesabÃ„Â± tamamlanamadÃ„Â±; ÃƒÂ¶n bilgi yÃƒÂ¼klendi.",
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
    return NextResponse.json({ success: false, error: "Optimizasyon verisi yÃƒÂ¼klenemedi." }, { status: 500 });
  }
}

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return NextResponse.json(
    {
      success: false,
      error: "Kuru ÃƒÂ§alÃ„Â±Ã…Å¸ma hesaplamalarÃ„Â± iÃƒÂ§in /api/price-optimization/analyze kullanÃ„Â±n.",
    },
    { status: 405 }
  );
}
