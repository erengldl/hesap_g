import { NextResponse } from "next/server";

import { listChannelSeoChannels } from "@/lib/channel-seo/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      data: listChannelSeoChannels(),
    });
  } catch (error) {
    console.error("Channel SEO channels error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Satış kanalları alınamadı.",
      },
      { status: 500 }
    );
  }
}
