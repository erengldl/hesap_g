import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { evaluateReturnRiskModel } from "@/lib/return-risk/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const data = evaluateReturnRiskModel();

    if (!data) {
      return NextResponse.json({
        ok: true,
        data: {
          modelVersion: "not-trained",
          modelType: "none",
          metricsAvailable: false,
          fallbackActive: true,
          lastTrainedAt: "not-trained",
        },
        message: "Egitilmis iade/fire risk modeli henuz yok. Tahminlerde fallback kullanilir.",
      });
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Return risk evaluate GET error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Iade/fire risk model metrikleri okunamadi.",
      },
      { status: 500 }
    );
  }
}
