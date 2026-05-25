import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { applyProfitPricingRun } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      runId?: string;
      confirmed?: boolean;
      price?: number;
    };

    if (!body.runId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Uygulanacak analiz kaydÃ„Â± bulunamadÃ„Â±.",
        },
        { status: 400 }
      );
    }

    if (body.confirmed !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "Urun fiyati kullanici onayi olmadan degistirilemez.",
        },
        { status: 409 }
      );
    }

    const applied = await applyProfitPricingRun({
      runId: body.runId,
      confirmed: true,
      price: body.price,
    });

    return NextResponse.json({
      ok: true,
      data: applied.result,
      oldPrice: applied.oldPrice,
      newPrice: applied.newPrice,
      message: "ÃƒÅ“rÃƒÂ¼n fiyatÃ„Â± gÃƒÂ¼ncellendi.",
    });
  } catch (error) {
    console.error("Profit pricing apply price POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ÃƒÅ“rÃƒÂ¼n fiyatÃ„Â± gÃƒÂ¼ncellenemedi.",
      },
      { status: 500 }
    );
  }
}
