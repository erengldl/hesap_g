import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/database-readers';
import { DEMO_PRODUCTS } from '@/lib/demo-data';
import { recalculateCostResultsForProduct } from '@/lib/portfolio-analytics';
import type { ProductUpsertInput } from '@/lib/types';
import { saveProductRecord } from './service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const dbProducts = getProducts();
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 0);
    const products = dbProducts;
    const limitedProducts = Number.isFinite(limit) && limit > 0 ? products.slice(0, limit) : products;
    
    return NextResponse.json({ 
      success: true, 
      products: limitedProducts,
      count: limitedProducts.length,
    });
  } catch {
    return NextResponse.json({ 
      success: true, 
      products: DEMO_PRODUCTS,
      count: DEMO_PRODUCTS.length,
      warning: 'Database unavailable, using demo data'
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<ProductUpsertInput>;
    const parsedCategoryId = Number(body.category_id ?? 0);
    const payload: ProductUpsertInput = {
      name: String(body.name ?? '').trim(),
      sku: String(body.sku ?? '').trim() || undefined,
      barcode: String(body.barcode ?? body.sku ?? '').trim() || undefined,
      image_url: String(body.image_url ?? '').trim() || undefined,
      category_id: Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null,
      category_path: String(body.category_path ?? '').trim(),
      description: String(body.description ?? '').trim() || undefined,
      cost: Number(body.cost ?? 0),
      packaging_cost: Number(body.packaging_cost ?? 0),
      desi: Number(body.desi ?? 0),
      sale_price: Number(body.sale_price ?? 0),
      active_channels: Array.isArray(body.active_channels) ? body.active_channels.map(String) : [],
      status: (body.status === 'passive' || body.status === 'draft' ? body.status : 'active'),
    };

    if (!payload.name || !payload.category_path) {
      return NextResponse.json({ success: false, error: 'Product name and category are required' }, { status: 400 });
    }

    const productId = saveProductRecord(payload);
    const results = recalculateCostResultsForProduct(productId);

    return NextResponse.json({
      success: true,
      productId,
      results,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, error: 'Ürün oluşturulamadı.' }, { status: 500 });
  }
}
