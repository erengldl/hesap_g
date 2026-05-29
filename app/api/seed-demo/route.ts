import { NextResponse } from 'next/server';
import { ensureDemoData } from '@/lib/seed-demo-data';
import { recalculateAllCostResults } from '@/lib/portfolio-analytics';
import { refreshCampaignProfitMetrics } from '@/lib/ad-analysis';

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
      message: "Beklenmeyen bir hata oluştu."
    }, { status: 500 });
  }
}
