import { query } from "@/lib/db";

type TrendRow = {
  date: string;
  units: number;
  revenue: number;
  order_count: number;
};

type OrderHistoryRow = {
  order_id: number;
  order_date: string;
  marketplace_name: string;
  external_order_number: string | null;
  external_package_number: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string | null;
  merchant_sku: string | null;
  barcode: string | null;
};

type CostResultRow = {
  marketplace_id: number;
  marketplace_name: string | null;
  marketplace_slug: string | null;
  list_price: number | null;
  total_unit_cost: number | null;
  net_profit: number | null;
  profit_margin_percent: number | null;
  warning_notes: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function roundWhole(value: number) {
  return Math.max(0, Math.round(value));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildContinuousSeries(rows: TrendRow[], days: number) {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  const cursor = new Date(start);
  const lookup = new Map(rows.map((row) => [row.date, row]));
  const series: Array<TrendRow & { label: string }> = [];

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const row = lookup.get(key);
    series.push({
      date: key,
      units: roundWhole(row?.units ?? 0),
      revenue: round2(row?.revenue ?? 0),
      order_count: Math.round(row?.order_count ?? 0),
      label: new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

export async function getProductSalesTrend(productId: number, days: 30 | 90 = 30, marketplaceId?: number) {
  const rows = await query<TrendRow>(
    `
      SELECT
        o.order_date AS date,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(SUM(oi.line_total), 0) AS revenue,
        COUNT(DISTINCT o.order_id) AS order_count
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      WHERE o.product_id = ?
        AND COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
        AND o.order_date >= CURRENT_DATE + CAST(? AS interval)
        ${marketplaceId ? "AND o.marketplace_id = ?" : ""}
      GROUP BY o.order_date
      ORDER BY o.order_date ASC
    `,
    marketplaceId ? [productId, `-${days - 1} days`, marketplaceId] : [productId, `-${days - 1} days`]
  );

  return buildContinuousSeries(rows, days);
}

export async function getProductOrderHistory(productId: number, limit = 20) {
  return (await query<OrderHistoryRow>(
    `
      SELECT
        o.order_id,
        o.order_date,
        m.name AS marketplace_name,
        o.external_order_number,
        o.external_package_number,
        oi.quantity,
        oi.unit_price,
        oi.line_total,
        COALESCE(o.status, 'completed') AS status,
        oi.merchant_sku,
        oi.barcode
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      LEFT JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
      WHERE o.product_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC, oi.order_item_id DESC
      LIMIT ?
    `,
    [productId, limit]
  )).map((row) => ({
    ...row,
    quantity: roundWhole(row.quantity),
    unit_price: round2(Number(row.unit_price ?? 0)),
    line_total: round2(Number(row.line_total ?? 0)),
  }));
}

export async function getProductSalesVelocity(productId: number, days = 30, marketplaceId?: number) {
  const row = (await query<{ units: number }>(
    `
      SELECT COALESCE(SUM(oi.quantity), 0) AS units
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      WHERE o.product_id = ?
        AND COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
        AND o.order_date >= CURRENT_DATE + CAST(? AS interval)
        ${marketplaceId ? "AND o.marketplace_id = ?" : ""}
    `,
    marketplaceId ? [productId, `-${days - 1} days`, marketplaceId] : [productId, `-${days - 1} days`]
  ))[0];

  return round2((row?.units ?? 0) / Math.max(1, days));
}

export async function getProductMarginSnapshots(productId: number) {
  return (await query<CostResultRow>(
    `
      SELECT
        cr.marketplace_id,
        cr.marketplace_name,
        cr.marketplace_slug,
        cr.list_price,
        cr.total_unit_cost,
        cr.net_profit,
        cr.profit_margin_percent,
        cr.warning_notes
      FROM cost_results cr
      WHERE cr.product_id = ?
      ORDER BY cr.profit_margin_percent DESC, cr.marketplace_id ASC
    `,
    [productId]
  )).map((row) => ({
    ...row,
    list_price: round2(Number(row.list_price ?? 0)),
    total_unit_cost: round2(Number(row.total_unit_cost ?? 0)),
    net_profit: round2(Number(row.net_profit ?? 0)),
    profit_margin_percent: round2(Number(row.profit_margin_percent ?? 0)),
  }));
}

export function summarizeProductTrend(rows: Array<{ date: string; units: number; revenue: number }>) {
  const totalUnits = rows.reduce((sum, row) => sum + Number(row.units ?? 0), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);
  const activeDays = rows.filter((row) => Number(row.units ?? 0) > 0).length;
  const avgDailyUnits = rows.length > 0 ? totalUnits / rows.length : 0;
  const peakDay = rows.reduce<{ date: string; units: number } | null>((best, row) => {
    if (!best || Number(row.units ?? 0) > best.units) {
      return { date: row.date, units: roundWhole(Number(row.units ?? 0)) };
    }
    return best;
  }, null);

  return {
    totalUnits: roundWhole(totalUnits),
    totalRevenue: round2(totalRevenue),
    activeDays,
    avgDailyUnits: round2(avgDailyUnits),
    peakDay,
  };
}

export function buildProductDescriptionFallback(product: {
  name: string;
  category_path?: string | null;
  category_name?: string | null;
  cost: number;
  packaging_cost: number;
  sale_price: number;
}) {
  const category = product.category_path ?? product.category_name ?? "genel ürün grubu";
  const margin = product.sale_price > 0 ? ((product.sale_price - product.cost - product.packaging_cost) / product.sale_price) * 100 : 0;
  return `${product.name}, ${category} içinde konumlanan ve ${round2(margin)}% civarında brüt marj hedefleyen bir demo üründür. Son 30/90 günlük satış trendi, stok geçişleri ve kanal bazlı kârlılık testleri için optimize edilmiştir.`;
}
