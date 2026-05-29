import { NextResponse } from 'next/server';
import { buildPriceSimulation } from '@/lib/portfolio-analytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = buildPriceSimulation();
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Fiyat simülasyonu verisi bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('Price simulation API error:', error);
    return NextResponse.json({ success: false, error: 'Fiyat simülasyonu oluşturulamadı.' }, { status: 500 });
  }
}
