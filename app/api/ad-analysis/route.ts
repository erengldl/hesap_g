import { NextResponse } from 'next/server';
import { buildAdAnalysis } from '@/lib/ad-analysis';
import { buildScopedCacheKey, getCachedValue } from '@/lib/server-cache';
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const data = await getCachedValue(
      buildScopedCacheKey("ad-analysis", authUserId),
      30_000,
      buildAdAnalysis,
    );
    if (!data) {
      return NextResponse.json({ success: false, error: 'Reklam analizi verisi bulunamadı.' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ad Analysis API error:', error);
    return NextResponse.json({ success: false, error: 'Reklam analizi oluşturulamadı.' }, { status: 500 });
  }
}
