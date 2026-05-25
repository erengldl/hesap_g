import { NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import { getLatestManualAdReport, getManualAdCampaignDetail } from "@/lib/manual-ads/repository";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const detail = await getManualAdCampaignDetail(user.userId, id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    const report = detail.latestReport ?? await getLatestManualAdReport(id);
    if (!report) {
      return NextResponse.json({ success: false, error: "Rapor bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Manual ads report fetch error:", error);
    return NextResponse.json({ success: false, error: "Rapor getirilemedi." }, { status: 500 });
  }
}
