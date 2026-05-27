import { NextResponse } from 'next/server';
import { getDatabaseCounts, getStoreExpenseMonthlyTotal } from '@/lib/database-readers';
import { query } from '@/lib/db';
import { buildScopedCacheKey, getCachedValue } from '@/lib/server-cache';
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";
import { getCurrentSellerProfileId } from "@/lib/seller-profile-helpers";

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
    const payload = await getCachedValue(
      buildScopedCacheKey("data-center-status", authUserId),
      15_000,
      async () => {
      const sellerProfileId = await getCurrentSellerProfileId();
      const counts = await getDatabaseCounts();
      const productStats = (await query<{
        product_count: number;
        active_product_count: number;
        average_price: number;
      }>(`
        SELECT
          COUNT(*) AS product_count,
          SUM(is_active) AS active_product_count,
          AVG(sale_price) AS average_price
        FROM (
          SELECT
            p.product_id,
            COALESCE(MAX(CASE WHEN COALESCE(p.status, 'draft') = 'active' THEN 1 ELSE 0 END), 0) AS is_active,
            COALESCE(AVG(pms.sale_price), 0) AS sale_price
          FROM products p
          LEFT JOIN product_marketplace_settings pms ON p.product_id = pms.product_id AND pms.user_id = p.user_id
          WHERE p.user_id = ?
          GROUP BY p.product_id
        ) per_product
      `, [authUserId]))[0] ?? { product_count: 0, active_product_count: 0, average_price: 0 };

      const marginRows = await query<{ product_id: number; max_margin: number }>(`
        SELECT product_id, MAX(profit_margin_percent) AS max_margin
        FROM cost_results
        WHERE user_id = ?
        GROUP BY product_id
      `, [authUserId]);
      const latestSyncRows = await query<{
        created_at: string;
        sync_scope: string | null;
        product_count: number;
        processed_products: number;
        note: string | null;
      }>(`
        SELECT created_at, sync_scope, product_count, processed_products, note
        FROM data_center_sync_runs
        WHERE user_id = ?
        ORDER BY created_at DESC, sync_id DESC
        LIMIT 1
      `, [authUserId]);
      const latestSync = latestSyncRows[0] ?? null;
      const averageProfitMargin = marginRows.length > 0
        ? marginRows.reduce((sum, row) => sum + Number(row.max_margin ?? 0), 0) / marginRows.length
        : 0;

      return {
        counts,
        product_count: Number(productStats.product_count ?? 0),
        active_product_count: Number(productStats.active_product_count ?? 0),
        average_price: Number(Number(productStats.average_price ?? 0).toFixed(2)),
        average_profit_margin: Number(averageProfitMargin.toFixed(2)),
        active_store_expense_total: Number((sellerProfileId ? await getStoreExpenseMonthlyTotal(sellerProfileId) : 0).toFixed(2)),
        last_bulk_sync_time: latestSync?.created_at ?? null,
        last_bulk_sync_scope: latestSync?.sync_scope ?? null,
        last_bulk_sync_count: Number(latestSync?.product_count ?? 0),
        last_bulk_sync_processed: Number(latestSync?.processed_products ?? 0),
        last_bulk_sync_message: latestSync?.note ?? null,
      };
      },
    );

    return NextResponse.json({ 
      success: true, 
      ...payload.counts,
      product_count: payload.product_count,
      active_product_count: payload.active_product_count,
      average_price: payload.average_price,
      average_profit_margin: payload.average_profit_margin,
      active_store_expense_total: payload.active_store_expense_total,
      last_bulk_sync_time: payload.last_bulk_sync_time,
      last_bulk_sync_scope: payload.last_bulk_sync_scope,
      last_bulk_sync_count: payload.last_bulk_sync_count,
      last_bulk_sync_processed: payload.last_bulk_sync_processed,
      last_bulk_sync_message: payload.last_bulk_sync_message,
      counts: payload.counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Veritabanı sayıları alınamadı.',
      counts: {} 
    }, { status: 500 });
  }
}
