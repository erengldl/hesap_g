import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { listChannelSeoChannels } from "@/lib/channel-seo/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
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
        error: "SatÃ„Â±Ã…Å¸ kanallarÃ„Â± alÃ„Â±namadÃ„Â±.",
      },
      { status: 500 }
    );
  }
}
