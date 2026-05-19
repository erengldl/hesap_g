import { NextRequest, NextResponse } from "next/server";

import { upsertChannelSeoContents } from "@/lib/channel-seo/repository";
import { validateChannelSeoSavePayload } from "@/lib/channel-seo/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const validation = validateChannelSeoSavePayload(body);
    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Doğrulama hatası.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    const saved = upsertChannelSeoContents(validation.value);
    return NextResponse.json({
      ok: true,
      data: {
        saved,
        savedCount: saved.length,
      },
    });
  } catch (error) {
    console.error("Channel SEO save error:", error);
    const message = error instanceof Error ? error.message : "Kayıt işlemi tamamlanamadı.";
    return NextResponse.json(
      {
        ok: false,
        error: message.includes("Ürün bulunamadı") ? message : "Kayıt işlemi tamamlanamadı.",
      },
      { status: message.includes("Ürün bulunamadı") ? 404 : 500 }
    );
  }
}
