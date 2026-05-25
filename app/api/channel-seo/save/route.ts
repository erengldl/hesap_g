import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { upsertChannelSeoContents } from "@/lib/channel-seo/repository";
import { validateChannelSeoSavePayload } from "@/lib/channel-seo/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json().catch(() => null);
    const validation = validateChannelSeoSavePayload(body);
    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "DoÃ„Å¸rulama hatasÃ„Â±.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    const saved = await upsertChannelSeoContents(validation.value);
    return NextResponse.json({
      ok: true,
      data: {
        saved,
        savedCount: saved.length,
      },
    });
  } catch (error) {
    console.error("Channel SEO save error:", error);
    const message = error instanceof Error ? error.message : "KayÃ„Â±t iÃ…Å¸lemi tamamlanamadÃ„Â±.";
    return NextResponse.json(
      {
        ok: false,
        error: message.includes("ÃƒÅ“rÃƒÂ¼n bulunamadÃ„Â±") ? message : "KayÃ„Â±t iÃ…Å¸lemi tamamlanamadÃ„Â±.",
      },
      { status: message.includes("ÃƒÅ“rÃƒÂ¼n bulunamadÃ„Â±") ? 404 : 500 }
    );
  }
}
