import { NextResponse } from 'next/server';
import { buildDashboardSnapshot, buildAggregateDashboard } from '@/lib/portfolio-analytics';
import { buildAdAnalysis } from '@/lib/ad-analysis';
import { getCachedValue } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const aggregate = getCachedValue('dashboard:aggregate', 15_000, buildAggregateDashboard);

    if (!aggregate) {
      return NextResponse.json({ success: false, error: 'Özet oluşturulamadı.' }, { status: 404 });
    }

    const snapshot = getCachedValue('dashboard:snapshot', 15_000, () => buildDashboardSnapshot());
    const adAnalysis = getCachedValue('dashboard:ad-analysis', 15_000, buildAdAnalysis);

    return NextResponse.json({
      success: true,
      aggregate,
      ...(snapshot ? {
        product: snapshot.product,
        results: snapshot.results,
        bestChannel: snapshot.bestChannel,
        bestChannelName: snapshot.bestChannelName,
        bestNetProfit: snapshot.bestNetProfit,
        bestMargin: snapshot.bestMargin,
        lowestTotalCost: snapshot.lowestTotalCost,
        totalNetProfit: snapshot.totalNetProfit,
        averageMargin: snapshot.averageMargin,
        costBreakdown: snapshot.costBreakdown,
        methodology: aggregate.methodology,
        adAnalysis: adAnalysis ? {
          totalSpend: adAnalysis.totalSpend,
          totalNetProfit: adAnalysis.totalNetProfit,
          averagePoas: adAnalysis.averagePoas,
          lossMakingCount: adAnalysis.lossMakingCount,
          watchCount: adAnalysis.watchCount,
          scaleCount: adAnalysis.scaleCount,
          totalCampaigns: adAnalysis.totalCampaigns,
          lastSyncedAt: adAnalysis.lastSyncedAt,
        } : null,
      } : {
        methodology: aggregate.methodology,
        adAnalysis: adAnalysis ? {
          totalSpend: adAnalysis.totalSpend,
          totalNetProfit: adAnalysis.totalNetProfit,
          averagePoas: adAnalysis.averagePoas,
          lossMakingCount: adAnalysis.lossMakingCount,
          watchCount: adAnalysis.watchCount,
          scaleCount: adAnalysis.scaleCount,
          totalCampaigns: adAnalysis.totalCampaigns,
          lastSyncedAt: adAnalysis.lastSyncedAt,
        } : null,
      }),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ success: false, error: 'Gösterge paneli özeti oluşturulamadı.' }, { status: 500 });
  }
}
