import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import type { ProfitPricingInput } from "@/lib/profit-pricing/types";
import { resolveProfitPricingRequest } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<ProfitPricingInput> & {
      productId?: string | number;
      channel?: string;
    };
    const resolved = await resolveProfitPricingRequest(body);

    return NextResponse.json({
      ok: true,
      data: resolved.result,
      channelProfiles: resolved.channelProfiles,
    });
  } catch (error) {
    console.error("Profit pricing calculate POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "KÃƒÂ¢rlÃ„Â±lÃ„Â±k hesaplanamadÃ„Â±. ÃƒÅ“rÃƒÂ¼n maliyeti veya satÃ„Â±Ã…Å¸ fiyatÃ„Â± eksik olabilir.",
      },
      { status: 500 }
    );
  }
}

