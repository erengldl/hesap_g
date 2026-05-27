import { NextResponse } from 'next/server';
import { getShippingCompanies } from '@/lib/database-readers';
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'shipping') {
      const companies = (await getShippingCompanies()) as any[];
      const carriers = Array.from(new Set(companies.map(c => c.name))).filter(Boolean);
      return NextResponse.json({ success: true, carriers });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz tür.' }, { status: 400 });
  } catch (error) {
    console.error('Cost Tariffs API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
