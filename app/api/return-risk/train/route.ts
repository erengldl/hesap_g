import { NextResponse } from "next/server";

import { trainReturnRiskModel } from "@/lib/return-risk/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = trainReturnRiskModel();

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.reason ?? "Iade/fire risk modeli egitilemedi.",
          data: {
            modelVersion: "not-trained",
            modelType: result.modelType,
            trainingRows: result.trainingRows,
            positiveRows: result.positiveRows,
            reason: result.reason ?? "Veri yetersiz.",
            fallbackActive: true,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Return risk train POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Iade/fire risk modeli egitilemedi.",
      },
      { status: 500 }
    );
  }
}
