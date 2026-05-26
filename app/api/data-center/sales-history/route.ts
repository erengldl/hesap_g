import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type SalesHistorySummaryRow = {
  total_orders: number;
  total_units: number;
  total_revenue: number;
  unique_products: number;
  active_marketplaces: number;
};

type TopMarketplaceRow = {
  marketplace_name: string | null;
  marketplace_slug: string | null;
  order_count: number;
  revenue: number;
};

type TopProductRow = {
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  units: number;
  revenue: number;
};

type SalesHistoryRow = {
  order_id: number;
  order_date: string;
  status: string | null;
  external_order_number: string | null;
  external_package_number: string | null;
  marketplace_name: string | null;
  marketplace_slug: string | null;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type SalesHistoryCountRow = {
  total_rows: number;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toWholeNumber(value: unknown) {
  return Math.max(0, Math.round(Number(value ?? 0)));
}

function isValidDate(value: string | null): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getTodayKey() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const url = new URL(request.url);
    const viewParam = url.searchParams.get("view") ?? "sales";
    const exportParam = url.searchParams.get("export");
    const searchParam = (url.searchParams.get("search") ?? "").trim();
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const daysParam = Number.parseInt(url.searchParams.get("days") ?? "90", 10);
    const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSizeParam = Number.parseInt(url.searchParams.get("page_size") ?? "40", 10);
    const exportAll = exportParam === "all";
    const pageSize = exportAll ? 5000 : Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 5000) : 40;
    const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const isReturnView = viewParam === "returns";

    const hasCustomRange = isValidDate(fromParam) && isValidDate(toParam);
    const todayKey = getTodayKey();

    let rangeDays = 90;
    let rangeStart = addDays(todayKey, -(rangeDays - 1));
    let rangeEnd = todayKey;
    let baseWhere = `
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      LEFT JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
      LEFT JOIN products p ON p.product_id = COALESCE(oi.product_id, o.product_id)
      WHERE o.order_date >= CURRENT_DATE + CAST(? AS interval)
        AND ${isReturnView ? "COALESCE(o.status, 'completed') = 'returned'" : "COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')"}
    `;
    let whereParams: Array<string> = [`-${rangeDays - 1} days`];

    if (hasCustomRange) {
      const firstDate = fromParam as string;
      const secondDate = toParam as string;
      rangeStart = firstDate <= secondDate ? firstDate : secondDate;
      rangeEnd = firstDate <= secondDate ? secondDate : firstDate;
      const startDate = new Date(`${rangeStart}T00:00:00.000Z`);
      const endDate = new Date(`${rangeEnd}T00:00:00.000Z`);
      rangeDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
      baseWhere = `
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        LEFT JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
        LEFT JOIN products p ON p.product_id = COALESCE(oi.product_id, o.product_id)
        WHERE o.order_date >= ?
          AND o.order_date <= ?
          AND ${isReturnView ? "COALESCE(o.status, 'completed') = 'returned'" : "COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')"}
      `;
      whereParams = [rangeStart, rangeEnd];
    } else if (Number.isFinite(daysParam) && daysParam > 0) {
      rangeDays = Math.min(Math.max(daysParam, 1), 3650);
      rangeStart = addDays(todayKey, -(rangeDays - 1));
      whereParams = [`-${rangeDays - 1} days`];
    }

    if (searchParam.length > 0) {
      const searchLike = `%${searchParam.replace(/\s+/g, "%")}%`;
      baseWhere += `
        AND (
          COALESCE(p.name, '') LIKE ?
          OR COALESCE(p.sku, '') LIKE ?
          OR COALESCE(oi.merchant_sku, '') LIKE ?
          OR CAST(o.order_id AS TEXT) LIKE ?
          OR COALESCE(o.external_order_number, '') LIKE ?
          OR COALESCE(o.external_package_number, '') LIKE ?
          OR COALESCE(m.name, m.slug, '') LIKE ?
        )
      `;
      whereParams.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
    }

    const summaryRow = (await query<SalesHistorySummaryRow>(
      `
        SELECT
          COUNT(DISTINCT o.order_id) AS total_orders,
          COALESCE(SUM(oi.quantity), 0) AS total_units,
          COALESCE(SUM(oi.line_total), 0) AS total_revenue,
          COUNT(DISTINCT COALESCE(oi.product_id, o.product_id)) AS unique_products,
          COUNT(DISTINCT o.marketplace_id) AS active_marketplaces
        ${baseWhere}
      `,
      whereParams
    ))[0] ?? {
      total_orders: 0,
      total_units: 0,
      total_revenue: 0,
      unique_products: 0,
      active_marketplaces: 0,
    };

    const topMarketplace = (await query<TopMarketplaceRow>(
      `
        SELECT
          COALESCE(m.name, m.slug, 'Kanal') AS marketplace_name,
          COALESCE(m.slug, 'market') AS marketplace_slug,
          COUNT(DISTINCT o.order_id) AS order_count,
          COALESCE(SUM(oi.line_total), 0) AS revenue
        ${baseWhere}
        GROUP BY o.marketplace_id
        ORDER BY revenue DESC, order_count DESC
        LIMIT 1
      `,
      whereParams
    ))[0] ?? null;

    const topProduct = (await query<TopProductRow>(
      `
        SELECT
          COALESCE(oi.product_id, o.product_id) AS product_id,
          COALESCE(p.name, oi.merchant_sku, 'Ürün') AS product_name,
          COALESCE(p.sku, oi.merchant_sku) AS product_sku,
          COALESCE(SUM(oi.quantity), 0) AS units,
          COALESCE(SUM(oi.line_total), 0) AS revenue
        ${baseWhere}
        GROUP BY COALESCE(oi.product_id, o.product_id)
        ORDER BY units DESC, revenue DESC
        LIMIT 1
      `,
      whereParams
    ))[0] ?? null;

    const totalRows = toNumber(
      (await query<SalesHistoryCountRow>(
        `
          SELECT COUNT(*) AS total_rows
          ${baseWhere}
        `,
        whereParams
      ))[0]?.total_rows
    );
    const totalPages = totalRows > 0 ? Math.ceil(totalRows / pageSize) : 0;
    const currentPage = exportAll ? 1 : totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
    const offset = (currentPage - 1) * pageSize;

    const salesHistoryQuery = `
        SELECT
          o.order_id,
          o.order_date,
          COALESCE(o.status, 'completed') AS status,
          o.external_order_number,
          o.external_package_number,
          COALESCE(m.name, m.slug, 'Kanal') AS marketplace_name,
          COALESCE(m.slug, 'market') AS marketplace_slug,
          COALESCE(oi.product_id, o.product_id) AS product_id,
          COALESCE(p.name, oi.merchant_sku, 'Ürün') AS product_name,
          COALESCE(p.sku, oi.merchant_sku) AS product_sku,
          oi.quantity,
          oi.unit_price,
          oi.line_total
        ${baseWhere}
        ORDER BY o.order_date DESC, o.order_id DESC, oi.order_item_id DESC
        ${exportAll ? "" : `LIMIT ${pageSize} OFFSET ${offset}`}
      `;

    const salesHistory = (await query<SalesHistoryRow>(salesHistoryQuery, whereParams)).map((row) => ({
      ...row,
      quantity: toWholeNumber(row.quantity),
      unit_price: toNumber(row.unit_price),
      line_total: toNumber(row.line_total),
    }));

    const totalOrders = toNumber(summaryRow.total_orders);
    const totalRevenue = toNumber(summaryRow.total_revenue);

    return NextResponse.json({
      success: true,
      view: viewParam,
      range_days: rangeDays,
      applied_range: {
        from: rangeStart,
        to: rangeEnd,
      },
      pagination: {
        page: currentPage,
        page_size: pageSize,
        total_rows: totalRows,
        total_pages: exportAll ? 1 : totalPages,
      },
      search: searchParam,
      summary: {
        total_orders: toWholeNumber(totalOrders),
        total_units: toWholeNumber(summaryRow.total_units),
        total_revenue: totalRevenue,
        average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        unique_products: toWholeNumber(summaryRow.unique_products),
        active_marketplaces: toWholeNumber(summaryRow.active_marketplaces),
        top_marketplace_name: topMarketplace?.marketplace_name ?? null,
        top_marketplace_slug: topMarketplace?.marketplace_slug ?? null,
        top_marketplace_revenue: toNumber(topMarketplace?.revenue),
        top_product_id: topProduct?.product_id ?? null,
        top_product_name: topProduct?.product_name ?? null,
        top_product_sku: topProduct?.product_sku ?? null,
        top_product_units: toWholeNumber(topProduct?.units),
        top_product_revenue: toNumber(topProduct?.revenue),
      },
      sales_history: salesHistory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sales history fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Satış geçmişi yüklenemedi.",
      },
      { status: 500 }
    );
  }
}
