import { NextResponse } from 'next/server';
import { ensureDemoData } from '@/lib/seed-demo-data';
import { recalculateAllCostResults } from '@/lib/portfolio-analytics';
import { refreshCampaignProfitMetrics } from '@/lib/ad-analysis';
import { SEED_DEMO_WARNING_MESSAGE } from '@/lib/seed-demo-contract';
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);

  try {
    const result = await ensureDemoData(authUserId);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    const recalculationResults = await Promise.allSettled([
      recalculateAllCostResults(),
      refreshCampaignProfitMetrics(),
    ]);

    const recalculationFailures = recalculationResults.filter((entry) => entry.status === "rejected");
    if (recalculationFailures.length > 0) {
      console.warn("Seed demo recalculation completed with warnings:", recalculationFailures.map((entry) => entry.status === "rejected" ? entry.reason : null));
      return NextResponse.json({
        ...result,
        warning: `${result.warning} Demo verisi yüklendi ancak bazı özet hesaplar tamamlanamadı.`,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Seed demo error:", error);
    return NextResponse.json({
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: "Demo verisi yüklenemedi.",
      warning: SEED_DEMO_WARNING_MESSAGE,
    }, { status: 500 });
  }
}
