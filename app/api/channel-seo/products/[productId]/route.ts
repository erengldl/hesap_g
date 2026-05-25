import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { getChannelSeoProductDetail } from "@/lib/channel-seo/repository";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const { productId } = await params;
    const normalizedProductId = typeof productId === "string" ? productId.trim() : "";
    if (!normalizedProductId) {
      return NextResponse.json(
        {
          ok: false,
          error: "productId boÃ…Å¸ olamaz.",
        },
        { status: 400 }
      );
    }

    const detail = getChannelSeoProductDetail(normalizedProductId);
    if (!detail) {
      return NextResponse.json(
        {
          ok: false,
          error: "ÃƒÅ“rÃƒÂ¼n bulunamadÃ„Â±.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: detail,
    });
  } catch (error) {
    console.error("Channel SEO product detail error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "ÃƒÅ“rÃƒÂ¼n detayÃ„Â± alÃ„Â±namadÃ„Â±.",
      },
      { status: 500 }
    );
  }
}
