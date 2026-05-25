import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import type { ProfitPricingInput } from "@/lib/profit-pricing/types";
import { saveProfitPricingRun } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      input?: Partial<ProfitPricingInput>;
      note?: string;
    };

    if (!body.input) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kaydedilecek analiz girdisi bulunamadÃ„Â±.",
        },
        { status: 400 }
      );
    }

    const saved = await saveProfitPricingRun({
      input: body.input,
      note: body.note,
    });

    return NextResponse.json({
      ok: true,
      data: saved.result,
      runId: saved.runId,
      message: "SonuÃƒÂ§ kaydedildi. Bu analiz ÃƒÂ¼rÃƒÂ¼n geÃƒÂ§miÃ…Å¸ine eklendi.",
    });
  } catch (error) {
    console.error("Profit pricing save result POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "SonuÃƒÂ§ kaydedilemedi. Tekrar deneyebilirsin.",
      },
      { status: 500 }
    );
  }
}
