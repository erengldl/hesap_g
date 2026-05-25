import { NextResponse } from 'next/server';
import { ensureDemoData } from '@/lib/seed-demo-data';
import { recalculateAllCostResults } from '@/lib/portfolio-analytics';
import { refreshCampaignProfitMetrics } from '@/lib/ad-analysis';
import { SEED_DEMO_WARNING_MESSAGE } from '@/lib/seed-demo-contract';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await ensureDemoData();
    recalculateAllCostResults();
    refreshCampaignProfitMetrics();
    
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: "Beklenmeyen bir hata oluÃ…Å¸tu.",
      warning: SEED_DEMO_WARNING_MESSAGE,
    }, { status: 500 });
  }
}
