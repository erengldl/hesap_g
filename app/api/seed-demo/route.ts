import { NextResponse } from 'next/server';
import { ensureDemoData } from '@/lib/seed-demo-data';
import { recalculateAllCostResults } from '@/lib/portfolio-analytics';
import { refreshCampaignProfitMetrics } from '@/lib/ad-analysis';
import { SEED_DEMO_WARNING_MESSAGE } from '@/lib/seed-demo-contract';
import { requireAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  try {
    const result = await ensureDemoData(session.authUserId ?? undefined);
    await Promise.all([
      recalculateAllCostResults(),
      refreshCampaignProfitMetrics(),
    ]);

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
