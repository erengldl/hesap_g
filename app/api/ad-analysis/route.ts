import { NextResponse } from 'next/server';
import { buildAdAnalysis } from '@/lib/ad-analysis';
import { getCachedValue } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getCachedValue('ad-analysis:default', 30_000, buildAdAnalysis);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Reklam analizi verisi bulunamadı.' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ad Analysis API error:', error);
    return NextResponse.json({ success: false, error: 'Reklam analizi oluşturulamadı.' }, { status: 500 });
  }
}
