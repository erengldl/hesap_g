import { NextResponse } from 'next/server';
import { buildAdAnalysis } from '@/lib/ad-analysis';
import { getCachedValue } from '@/lib/server-cache';
import { requireAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const data = getCachedValue('ad-analysis:default', 30_000, buildAdAnalysis);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Reklam analizi verisi bulunamadÃ„Â±.' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ad Analysis API error:', error);
    return NextResponse.json({ success: false, error: 'Reklam analizi oluÃ…Å¸turulamadÃ„Â±.' }, { status: 500 });
  }
}
