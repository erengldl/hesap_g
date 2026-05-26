import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { runChannelSeoBulkOptimization } from "@/lib/channel-seo/batch-optimizer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "İstek gövdesi okunamadı.",
        },
        { status: 400 }
      );
    }

    const result = await runChannelSeoBulkOptimization(body);
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Channel SEO bulk optimize error:", error);
    const message = error instanceof Error ? error.message : "Toplu optimizasyon başlatılamadı.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.includes("geҧersiz") || message.includes("seҧilmelidir") ? 400 : 500 }
    );
  }
}
