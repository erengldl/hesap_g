import { NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import { calculateManualAdMetrics } from "@/lib/manual-ads/metrics";
import { createManualAdReportRecord, appendManualAdMessage, getManualAdCampaignDetail } from "@/lib/manual-ads/repository";
import { evaluateManualAdDecision } from "@/lib/manual-ads/decision-engine";
import { generateManualAdReport } from "@/lib/manual-ads/report-generator";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(_request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const detail = getManualAdCampaignDetail(user.userId, id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    const metrics = calculateManualAdMetrics(detail.campaign, detail.conversationState);
    const decision = evaluateManualAdDecision(detail.campaign, metrics, detail.conversationState);
    const generated = await generateManualAdReport({
      campaign: detail.campaign,
      metrics,
      decision,
      revenueSource:
        detail.campaign.revenueFromAds !== null && detail.campaign.revenueFromAds !== undefined
          ? "manual"
          : detail.campaign.productSalePrice !== null && detail.campaign.productSalePrice !== undefined
            ? "estimated_from_product"
            : "missing",
      conversationState: detail.conversationState,
      messages: detail.messages,
    });

    const report = createManualAdReportRecord(id, generated);
    const assistantMessage = appendManualAdMessage(id, "assistant", `Analiz raporu oluşturuldu: ${report.summary}`, {
      kind: "report_generated",
      reportId: report.id,
      decision: report.decision,
      score: report.score,
      aiModel: generated.aiModel,
      readyToReport: true,
      missingFields: detail.conversationState.missingFields,
    });

    return NextResponse.json({
      success: true,
      report,
      assistantMessage,
      fallbackUsed: generated.fallbackUsed,
      aiModel: generated.aiModel,
    });
  } catch (error) {
    console.error("Manual ads report generation error:", error);
    return NextResponse.json({ success: false, error: "Rapor oluşturulamadı." }, { status: 500 });
  }
}
