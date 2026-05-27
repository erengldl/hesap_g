import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recalculateCostResultsForProductFromDatabase } from '@/lib/cost-engine';
import { requireAuth } from "@/lib/api-auth";
import { requireCurrentAuthUserId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const authUserId = requireCurrentAuthUserId();
    const ids = request.nextUrl.searchParams.getAll("id").map(Number).filter((n) => Number.isFinite(n));
    if (ids.length < 2 || ids.length > 4) {
      return NextResponse.json({ success: false, error: "2-4 product IDs required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    const productResults = await Promise.all(ids.map(async (id) => {
      const product = await db.prepare(`
        SELECT p.product_id, p.name, p.sku, p.cost, p.packaging_cost, p.image_url, p.category_path
        FROM products p WHERE p.product_id = ? AND p.user_id = ?
      `).get(id, authUserId) as {
        product_id: number; name: string; sku: string; cost: number;
        packaging_cost: number; image_url: string; category_path: string;
      } | undefined;

      if (!product) return null;

      const channels = await db.prepare(`
        SELECT m.name as channel_name, m.slug, pms.sale_price
        FROM product_marketplace_settings pms
        JOIN products p ON p.product_id = pms.product_id
        JOIN marketplaces m ON pms.marketplace_id = m.marketplace_id
        WHERE pms.product_id = ? AND p.user_id = ?
      `).all(id, authUserId) as Array<{ channel_name: string; slug: string; sale_price: number }>;

      const costs = await recalculateCostResultsForProductFromDatabase(id);

      return {
        id: product.product_id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.image_url,
        category: product.category_path,
        cost: product.cost,
        packagingCost: product.packaging_cost,
        channels: channels.map((ch) => {
          const costResult = costs.find((c) => c.channel_name === ch.channel_name);
          return {
            channelName: ch.channel_name,
            salePrice: ch.sale_price,
            totalCost: costResult?.total_unit_cost ?? 0,
            netProfit: costResult?.net_profit ?? 0,
            margin: costResult?.profit_margin_percent ?? 0,
          };
        }),
      };
    }));

    const products = productResults.filter(Boolean);

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error('Product compare API error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
