import { NextResponse } from 'next/server';
import { requireAuth } from "@/lib/api-auth";
import {
  getCommissionTariffsByMarketplace, 
  getCommissionForCategory, 
  getCommissionTariffSummaryByMarketplace,
  getShippingTariffMatrix,
  getCarriersByMarketplace,
  getCheapestCarrierForDesi,
} from '@/lib/database-readers';

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const marketplace = searchParams.get('marketplace');
  const categoryId = searchParams.get('categoryId');
  const queryText = (searchParams.get('query') ?? '').trim();
  const desi = searchParams.get('desi');

  if (!marketplace) {
    return NextResponse.json({ success: false, error: 'Marketplace is required' }, { status: 400 });
  }

  try {
    if (type === 'carriers') {
      const carriers = await getCarriersByMarketplace(marketplace);
      return NextResponse.json({
        success: true,
        carriers: carriers.map(c => ({ id: c.shipping_company_id, name: c.name })),
      });
    }

    if (type === 'cheapest_carrier' && desi) {
      const result = await getCheapestCarrierForDesi(marketplace, parseFloat(desi));
      return NextResponse.json({
        success: true,
        cheapest: result,
      });
    }

    if (type === 'commission') {
      if (categoryId) {
        const commission = await getCommissionForCategory(marketplace, parseInt(categoryId));
        return NextResponse.json({ success: true, commission });
      }

      if (queryText) {
        const tariffs = (await getCommissionTariffsByMarketplace(marketplace)) as Array<{
          category_name?: string | null;
          category_path?: string | null;
          raw_category_name?: string | null;
        }>;
        const lowerQuery = queryText.toLowerCase();
        const filteredTariffs = tariffs.filter((item) => {
          const label = `${item.category_name ?? ''} ${item.category_path ?? ''} ${item.raw_category_name ?? ''}`.toLowerCase();
          return label.includes(lowerQuery);
        });
        return NextResponse.json({ success: true, tariffs: filteredTariffs, mode: 'detail' });
      }

      const summary = await getCommissionTariffSummaryByMarketplace(marketplace);
      const tariffs = await getCommissionTariffsByMarketplace(marketplace);
      return NextResponse.json({ success: true, summary, tariffs, mode: 'summary' });
    } else if (type === 'shipping') {
      const matrix = await getShippingTariffMatrix(marketplace);
      return NextResponse.json({ success: true, matrix });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz tür.' }, { status: 400 });
  } catch (error) {
    console.error('Tariffs API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
