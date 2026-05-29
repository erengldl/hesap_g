import { NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import { createManualAdCampaign, listManualAdCampaignSummaries } from "@/lib/manual-ads/repository";
import { validateManualAdCampaignInput } from "@/lib/manual-ads/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const campaigns = listManualAdCampaignSummaries(user.userId);
    return NextResponse.json({
      success: true,
      campaigns,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Manual ads list error:", error);
    return NextResponse.json({ success: false, error: "Liste oluşturulamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const validation = validateManualAdCampaignInput(body);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: "Doğrulama başarısız.", errors: validation.errors }, { status: 400 });
    }

    const detail = createManualAdCampaign(user.userId, validation.value);
    return NextResponse.json({
      success: true,
      campaign: detail.campaign,
      detail,
    });
  } catch (error) {
    console.error("Manual ads create error:", error);
    const validationErrors = error instanceof Error && "validationErrors" in error
      ? (error as Error & { validationErrors?: Record<string, string[]> }).validationErrors
      : null;

    if (validationErrors) {
      return NextResponse.json({ success: false, error: "Doğrulama başarısız.", errors: validationErrors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: "Analiz oluşturulamadı." }, { status: 500 });
  }
}
