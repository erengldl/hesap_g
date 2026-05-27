import { NextResponse } from 'next/server';
import { getDatabaseCounts, getStoreExpenseMonthlyTotal } from '@/lib/database-readers';
import { query } from '@/lib/db';
import { buildScopedCacheKey, getCachedValue } from '@/lib/server-cache';
import { requireAuth } from "@/lib/api-auth";
import { getCurrentSellerProfileId } from "@/lib/seller-profile-helpers";

export const dynamic = 'force-dynamic';

type RevenueTotalsRow = {
  total_revenue: number;
  total_orders: number;
};

type StockAlertCountRow = {
  stock_alert_count: number;
};

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId ?? "";
  try {
    const payload = await getCachedValue(
      buildScopedCacheKey("app-stats", session.authUserId ?? session.userId),
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
          LEFT JOIN product_marketplace_settings pms ON p.product_id = pms.product_id
          WHERE p.user_id = ?
          GROUP BY p.product_id
        ) per_product
      `, [authUserId]))[0] ?? { product_count: 0, active_product_count: 0, average_price: 0 };

      const activeStoreExpenseTotal = sellerProfileId ? await getStoreExpenseMonthlyTotal(sellerProfileId) : 0;
      const revenueTotals = (await query<RevenueTotalsRow>(`
        SELECT
          COALESCE(SUM(oi.line_total), 0) AS total_revenue,
          COUNT(DISTINCT o.order_id) AS total_orders
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.status = 'completed' AND o.user_id = ?
      `, [authUserId]))[0] ?? { total_revenue: 0, total_orders: 0 };
      const stockAlertCount = (await query<StockAlertCountRow>(`
        SELECT COUNT(*) AS stock_alert_count
        FROM inventory_daily id
        WHERE id.inventory_date = (SELECT MAX(inventory_date) FROM inventory_daily)
          AND id.user_id = ?
          AND id.stock_qty < 20
      `, [authUserId]))[0]?.stock_alert_count ?? 0;

      const marginRows = await query<{ product_id: number; max_margin: number }>(`
        SELECT product_id, MAX(profit_margin_percent) AS max_margin
        FROM cost_results
        WHERE user_id = ?
        GROUP BY product_id
      `, [authUserId]);
      const averageProfitMargin = marginRows.length > 0
        ? marginRows.reduce((sum, row) => sum + Number(row.max_margin ?? 0), 0) / marginRows.length
        : 0;

      return {
        counts,
        product_count: Number(productStats.product_count ?? 0),
        active_product_count: Number(productStats.active_product_count ?? 0),
        average_price: Number(Number(productStats.average_price ?? 0).toFixed(2)),
        average_profit_margin: Number(averageProfitMargin.toFixed(2)),
        active_store_expense_total: Number(activeStoreExpenseTotal.toFixed(2)),
        dashboard_summary: {
          total_revenue: Number(revenueTotals.total_revenue ?? 0),
          total_orders: Number(revenueTotals.total_orders ?? 0),
          avg_margin: Number(averageProfitMargin.toFixed(2)),
          stock_alert_count: Number(stockAlertCount),
        },
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
      dashboard_summary: payload.dashboard_summary,
      counts: payload.counts,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
