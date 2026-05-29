import { NextResponse } from "next/server";

import { predictReturnRiskFromDataCenter } from "@/lib/return-risk/server";
import { validateReturnRiskPredictionInput } from "@/lib/return-risk/validation";
import type { ReturnRiskPredictionInput } from "@/lib/return-risk/types";
import type { SalesChannel } from "@/lib/profit-pricing/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<ReturnRiskPredictionInput>;
    const validation = validateReturnRiskPredictionInput(body);

    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: validation.errors.join(" "),
        },
        { status: 400 }
      );
    }

    const data = predictReturnRiskFromDataCenter({
      productId: String(body.productId),
      channel: body.channel as SalesChannel,
      price: Number(body.price),
      productCost: body.productCost,
      packagingCost: body.packagingCost,
      shippingCost: body.shippingCost,
      commissionRate: body.commissionRate,
      platformFee: body.platformFee,
      basePrice: body.basePrice,
      baseDemand: body.baseDemand,
      demandForecast: body.demandForecast,
      stockLimit: body.stockLimit,
      context: body.context,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Return risk predict POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Iade/fire risk tahmini hesaplanamadi.",
      },
      { status: 500 }
    );
  }
}
