import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { assessSalesHistoryQuality, type SalesHistoryTrendPoint } from "@/lib/sales-history-insights";

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

type SalesHistoryTrendRow = {
  date_key: string;
  orders: number;
  units: number;
  revenue: number;
  marketplace_name: string | null;
};

type MarketplaceOptionRow = {
  marketplace_name: string | null;
  marketplace_slug: string | null;
  order_count: number;
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

function buildDateKeys(startDate: string, endDate: string) {
  const keys: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return keys;
}

function readPositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewParam = url.searchParams.get("view") ?? "sales";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const daysParam = readPositiveInteger(url.searchParams.get("days")) || 90;
    const pageParam = readPositiveInteger(url.searchParams.get("page")) || 1;
    const selectedProductId = readPositiveInteger(url.searchParams.get("productId"));
    const selectedMarketplace = (url.searchParams.get("marketplace") ?? "").trim();
    const pageSize = 40;
    const isReturnView = viewParam === "returns";

    const hasCustomRange = isValidDate(fromParam) && isValidDate(toParam);
    const todayKey = getTodayKey();

    let rangeStart = addDays(todayKey, -(Math.min(Math.max(daysParam, 1), 3650) - 1));
    let rangeEnd = todayKey;
    let rangeDays = Math.min(Math.max(daysParam, 1), 3650);

    if (hasCustomRange) {
      const firstDate = fromParam as string;
      const secondDate = toParam as string;
      rangeStart = firstDate <= secondDate ? firstDate : secondDate;
      rangeEnd = firstDate <= secondDate ? secondDate : firstDate;
      const startDate = new Date(`${rangeStart}T00:00:00.000Z`);
      const endDate = new Date(`${rangeEnd}T00:00:00.000Z`);
      rangeDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    }

    const baseFrom = `
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      LEFT JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
      LEFT JOIN products p ON p.product_id = COALESCE(oi.product_id, o.product_id)
    `;

    const sharedClauses = [
      "date(o.order_date) >= ?",
      "date(o.order_date) <= ?",
      isReturnView
        ? "COALESCE(o.status, 'completed') = 'returned'"
        : "COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')",
    ];
    const sharedParams: Array<string | number> = [rangeStart, rangeEnd];

    if (selectedProductId > 0) {
      sharedClauses.push("COALESCE(oi.product_id, o.product_id) = ?");
      sharedParams.push(selectedProductId);
    }

    const fullClauses = [...sharedClauses];
    const fullParams = [...sharedParams];
    if (selectedMarketplace) {
      fullClauses.push("COALESCE(m.slug, 'market') = ?");
      fullParams.push(selectedMarketplace);
    }

    const sharedWhere = `${baseFrom} WHERE ${sharedClauses.join(" AND ")}`;
    const fullWhere = `${baseFrom} WHERE ${fullClauses.join(" AND ")}`;

    const summaryRow = query<SalesHistorySummaryRow>(
      `
        SELECT
          COUNT(DISTINCT o.order_id) AS total_orders,
          COALESCE(SUM(oi.quantity), 0) AS total_units,
          COALESCE(SUM(oi.line_total), 0) AS total_revenue,
          COUNT(DISTINCT COALESCE(oi.product_id, o.product_id)) AS unique_products,
          COUNT(DISTINCT o.marketplace_id) AS active_marketplaces
        ${fullWhere}
      `,
      fullParams
    )[0] ?? {
      total_orders: 0,
      total_units: 0,
      total_revenue: 0,
      unique_products: 0,
      active_marketplaces: 0,
    };

    const topMarketplace = query<TopMarketplaceRow>(
      `
        SELECT
          COALESCE(m.name, m.slug, 'Kanal') AS marketplace_name,
          COALESCE(m.slug, 'market') AS marketplace_slug,
          COUNT(DISTINCT o.order_id) AS order_count,
          COALESCE(SUM(oi.line_total), 0) AS revenue
        ${fullWhere}
        GROUP BY COALESCE(m.slug, 'market'), COALESCE(m.name, m.slug, 'Kanal')
        ORDER BY revenue DESC, order_count DESC
        LIMIT 1
      `,
      fullParams
    )[0] ?? null;

    const topProduct = query<TopProductRow>(
      `
        SELECT
          COALESCE(oi.product_id, o.product_id) AS product_id,
          COALESCE(p.name, oi.merchant_sku, 'Ürün') AS product_name,
          COALESCE(p.sku, oi.merchant_sku) AS product_sku,
          COALESCE(SUM(oi.quantity), 0) AS units,
          COALESCE(SUM(oi.line_total), 0) AS revenue
        ${fullWhere}
        GROUP BY COALESCE(oi.product_id, o.product_id), COALESCE(p.name, oi.merchant_sku, 'Ürün'), COALESCE(p.sku, oi.merchant_sku)
        ORDER BY units DESC, revenue DESC
        LIMIT 1
      `,
      fullParams
    )[0] ?? null;

    const totalRows = toNumber(
      query<SalesHistoryCountRow>(
        `
          SELECT COUNT(*) AS total_rows
          ${fullWhere}
        `,
        fullParams
      )[0]?.total_rows
    );
    const totalPages = totalRows > 0 ? Math.ceil(totalRows / pageSize) : 0;
    const currentPage = totalPages > 0 ? Math.min(pageParam, totalPages) : 1;
    const offset = (currentPage - 1) * pageSize;

    const salesHistory = query<SalesHistoryRow>(
      `
        SELECT
          o.order_id,
          date(o.order_date) AS order_date,
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
        ${fullWhere}
        ORDER BY date(o.order_date) DESC, o.order_id DESC, oi.order_item_id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      fullParams
    ).map((row) => ({
      ...row,
      quantity: toWholeNumber(row.quantity),
      unit_price: toNumber(row.unit_price),
      line_total: toNumber(row.line_total),
    }));

    const trendRows = query<SalesHistoryTrendRow>(
      `
        SELECT
          date(o.order_date) AS date_key,
          COUNT(DISTINCT o.order_id) AS orders,
          COALESCE(SUM(oi.quantity), 0) AS units,
          COALESCE(SUM(oi.line_total), 0) AS revenue,
          CASE
            WHEN COUNT(DISTINCT COALESCE(m.name, m.slug, 'Kanal')) = 1 THEN MAX(COALESCE(m.name, m.slug, 'Kanal'))
            WHEN COUNT(DISTINCT COALESCE(m.name, m.slug, 'Kanal')) > 1 THEN COUNT(DISTINCT COALESCE(m.name, m.slug, 'Kanal')) || ' kanal'
            ELSE NULL
          END AS marketplace_name
        ${fullWhere}
        GROUP BY date(o.order_date)
        ORDER BY date(o.order_date) ASC
      `,
      fullParams
    );

    const trendRowMap = new Map(
      trendRows.map((row) => [
        row.date_key,
        {
          orders: toWholeNumber(row.orders),
          units: toWholeNumber(row.units),
          revenue: toNumber(row.revenue),
          marketplace: row.marketplace_name,
        },
      ])
    );

    const trend: SalesHistoryTrendPoint[] = buildDateKeys(rangeStart, rangeEnd).map((dateKey) => {
      const row = trendRowMap.get(dateKey);
      return {
        date: dateKey,
        orders: row?.orders ?? 0,
        units: row?.units ?? 0,
        revenue: row?.revenue ?? 0,
        marketplace: row?.marketplace ?? null,
        missing: !row || row.orders <= 0,
      };
    });

    const quality = assessSalesHistoryQuality({
      trend,
      totalOrders: toWholeNumber(summaryRow.total_orders),
      totalUnits: toWholeNumber(summaryRow.total_units),
      activeMarketplaces: toWholeNumber(summaryRow.active_marketplaces),
    });

    const marketplaceOptions = query<MarketplaceOptionRow>(
      `
        SELECT
          COALESCE(m.name, m.slug, 'Kanal') AS marketplace_name,
          COALESCE(m.slug, 'market') AS marketplace_slug,
          COUNT(DISTINCT o.order_id) AS order_count
        ${sharedWhere}
        GROUP BY COALESCE(m.slug, 'market'), COALESCE(m.name, m.slug, 'Kanal')
        ORDER BY order_count DESC, marketplace_name ASC
      `,
      sharedParams
    ).map((row) => ({
      marketplace_name: row.marketplace_name,
      marketplace_slug: row.marketplace_slug,
      order_count: toWholeNumber(row.order_count),
    }));

    const totalOrders = toWholeNumber(summaryRow.total_orders);
    const totalUnits = toWholeNumber(summaryRow.total_units);
    const totalRevenue = toNumber(summaryRow.total_revenue);

    return NextResponse.json({
      success: true,
      view: viewParam,
      range_days: rangeDays,
      applied_range: {
        from: rangeStart,
        to: rangeEnd,
      },
      selected_filters: {
        product_id: selectedProductId || null,
        marketplace: selectedMarketplace || null,
      },
      filters: {
        marketplace_options: marketplaceOptions,
      },
      pagination: {
        page: currentPage,
        page_size: pageSize,
        total_rows: totalRows,
        total_pages: totalPages,
      },
      summary: {
        total_orders: totalOrders,
        total_units: totalUnits,
        total_revenue: totalRevenue,
        average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        unique_products: toWholeNumber(summaryRow.unique_products),
        active_marketplaces: toWholeNumber(summaryRow.active_marketplaces),
        active_sales_days: quality.active_sales_days,
        average_daily_units: quality.active_sales_days > 0 ? totalUnits / quality.active_sales_days : 0,
        top_marketplace_name: topMarketplace?.marketplace_name ?? null,
        top_marketplace_slug: topMarketplace?.marketplace_slug ?? null,
        top_marketplace_revenue: toNumber(topMarketplace?.revenue),
        top_product_id: topProduct?.product_id ?? null,
        top_product_name: topProduct?.product_name ?? null,
        top_product_sku: topProduct?.product_sku ?? null,
        top_product_units: toWholeNumber(topProduct?.units),
        top_product_revenue: toNumber(topProduct?.revenue),
      },
      trend,
      data_quality: quality,
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
