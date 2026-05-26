import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import type { ProfitPricingInput } from "@/lib/profit-pricing/types";
import { buildServerSideChannelComparison, resolveProfitPricingRequest } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      input?: Partial<ProfitPricingInput> & { productId?: string | number; channel?: string };
      channels?: string[];
    };
    const input = body.input ?? {};
    const resolved = await resolveProfitPricingRequest(input);
    const comparison = await buildServerSideChannelComparison(input);
    const filtered = Array.isArray(body.channels) && body.channels.length > 0
      ? comparison.filter((item) => body.channels?.includes(item.channel))
      : comparison;

    return NextResponse.json({
      ok: true,
      data: filtered.length > 0 ? filtered : resolved.result.channelComparison ?? [],
    });
  } catch (error) {
    console.error("Profit pricing compare channels POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Kanal karşılaştırması tamamlanamadı.",
      },
      { status: 500 }
    );
  }
}

