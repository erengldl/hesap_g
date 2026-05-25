import "server-only";

import { query } from "@/lib/db";
import { mapMarketplaceSlugToSalesChannel } from "@/lib/profit-pricing/utils";
import type { SalesChannel } from "@/lib/profit-pricing/types";
import { calculateReturnRate, normalizeReturnRiskStats } from "./feature-builder";
import type { ReturnRiskContext, ReturnRiskTrainingRow } from "./types";

type ReturnRiskOrderRow = {
  order_id: number | string;
  product_id: number | string;
  marketplace_slug: string | null;
  order_date: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount_amount: number | null;
  campaign_id: string | null;
  utm_campaign: string | null;
  status: string | null;
  order_status_detail: string | null;
  shipping_amount: number | null;
  realized_shipping_cost: number | null;
  product_cost: number | null;
  packaging_cost: number | null;
  category_id: number | string | null;
  category_name: string | null;
  stock_level: number | null;
  commission_amount: number | null;
};

type ReturnRiskDataset = {
  rows: ReturnRiskTrainingRow[];
  byProduct: Map<string, ReturnRiskTrainingRow[]>;
  byCategory: Map<string, ReturnRiskTrainingRow[]>;
  byChannel: Map<SalesChannel, ReturnRiskTrainingRow[]>;
  productMeta: Map<string, { categoryId?: string; categoryName?: string; stockLevel?: number }>;
  globalExpectedCostIfReturned: number | null;
};

type CachedDatasetEntry = {
  expiresAt: number;
  dataset: ReturnRiskDataset;
};

type CachedContextEntry = {
  expiresAt: number;
  context: ReturnRiskContext;
};

const RETURN_RISK_CACHE_TTL_MS = 5 * 60 * 1000;
const datasetCache = new Map<number, CachedDatasetEntry>();
const contextCache = new Map<string, CachedContextEntry>();

function finite(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function isReturnedOrLost(status: string | null | undefined, detail: string | null | undefined) {
  const text = `${status ?? ""} ${detail ?? ""}`.toLowerCase();
  return /(returned|return|iade|cancelled|canceled|iptal|lost|damaged|fire|hasar|kayip|kayıp)/.test(text);
}

function toTrainingRow(row: ReturnRiskOrderRow): ReturnRiskTrainingRow | null {
  const channel = mapMarketplaceSlugToSalesChannel(row.marketplace_slug);
  if (!channel) {
    return null;
  }

  const salePrice = finite(row.unit_price);
  const shippingCost = finite(row.realized_shipping_cost, finite(row.shipping_amount));
  const commissionRate = salePrice > 0 ? finite(row.commission_amount) / salePrice : 0;

  return {
    orderId: String(row.order_id),
    productId: String(row.product_id),
    channel,
    orderDate: row.order_date ?? new Date().toISOString(),
    salePrice,
    quantity: Math.max(1, finite(row.quantity, 1)),
    discountAmount: finite(row.discount_amount),
    campaignFlag: Boolean(row.campaign_id || row.utm_campaign),
    adAttributedFlag: Boolean(row.utm_campaign),
    isReturnedOrLost: isReturnedOrLost(row.status, row.order_status_detail),
    categoryId: row.category_id !== null && row.category_id !== undefined ? String(row.category_id) : undefined,
    categoryName: row.category_name ?? undefined,
    productCost: finite(row.product_cost),
    packagingCost: finite(row.packaging_cost),
    shippingCost,
    commissionRate,
    stock: finite(row.stock_level),
  };
}

export async function listReturnRiskTrainingRows(limit = 10000): Promise<ReturnRiskTrainingRow[]> {
  try {
    const rows = await query<ReturnRiskOrderRow>(
      `
        SELECT
          o.order_id,
          o.product_id,
          m.slug AS marketplace_slug,
          o.order_date,
          o.quantity,
          o.unit_price,
          o.discount_amount,
          o.campaign_id,
          o.utm_campaign,
          o.status,
          o.order_status_detail,
          o.shipping_amount,
          o.realized_shipping_cost,
          o.commission_amount,
          p.cost AS product_cost,
          p.packaging_cost,
          p.category_id,
          c.name AS category_name,
          (
            SELECT COALESCE(SUM(id.stock_qty - COALESCE(id.reserved_qty, 0)), 0)
            FROM inventory_daily id
            WHERE id.product_id = o.product_id
              AND id.inventory_date = (
                SELECT MAX(id2.inventory_date)
                FROM inventory_daily id2
                WHERE id2.product_id = o.product_id
              )
          ) AS stock_level
        FROM orders o
        LEFT JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
        LEFT JOIN products p ON p.product_id = o.product_id
        LEFT JOIN categories c ON c.category_id = p.category_id
        ORDER BY o.order_date DESC, o.order_id DESC
        LIMIT ?
      `,
      [Math.max(1, Math.min(50000, Math.round(limit)))]
    );

    return rows
      .map((row) => toTrainingRow(row))
      .filter((row): row is ReturnRiskTrainingRow => row !== null);
  } catch (error) {
    console.error("Return risk training rows could not be read:", error);
    return [];
  }
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) {
    return null;
  }

  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
}

function buildDataset(rows: ReturnRiskTrainingRow[]): ReturnRiskDataset {
  const byProduct = new Map<string, ReturnRiskTrainingRow[]>();
  const byCategory = new Map<string, ReturnRiskTrainingRow[]>();
  const byChannel = new Map<SalesChannel, ReturnRiskTrainingRow[]>();
  const productMeta = new Map<string, { categoryId?: string; categoryName?: string; stockLevel?: number }>();

  for (const row of rows) {
    const productRows = byProduct.get(row.productId) ?? [];
    productRows.push(row);
    byProduct.set(row.productId, productRows);

    if (row.categoryId) {
      const categoryRows = byCategory.get(row.categoryId) ?? [];
      categoryRows.push(row);
      byCategory.set(row.categoryId, categoryRows);
    }

    const channelRows = byChannel.get(row.channel) ?? [];
    channelRows.push(row);
    byChannel.set(row.channel, channelRows);

    const currentMeta = productMeta.get(row.productId) ?? {};
    productMeta.set(row.productId, {
      categoryId: currentMeta.categoryId ?? row.categoryId,
      categoryName: currentMeta.categoryName ?? row.categoryName,
      stockLevel: currentMeta.stockLevel ?? row.stock,
    });
  }

  return {
    rows,
    byProduct,
    byCategory,
    byChannel,
    productMeta,
    globalExpectedCostIfReturned: average(
      rows.map((row) => finite(row.shippingCost) + finite(row.packagingCost))
    ),
  };
}

async function getCachedDataset(limit = 10000) {
  const normalizedLimit = Math.max(1, Math.min(50000, Math.round(limit)));
  const now = Date.now();
  const cached = datasetCache.get(normalizedLimit);
  if (cached && cached.expiresAt > now) {
    return cached.dataset;
  }

  const rows = await listReturnRiskTrainingRows(normalizedLimit);
  const dataset = buildDataset(rows);
  datasetCache.set(normalizedLimit, {
    dataset,
    expiresAt: now + RETURN_RISK_CACHE_TTL_MS,
  });

  return dataset;
}

function makeSlice(rows: ReturnRiskTrainingRow[]) {
  const orderCount = rows.length;
  const returnedCount = rows.reduce((sum, row) => sum + (row.isReturnedOrLost ? 1 : 0), 0);

  return {
    orderCount,
    returnedCount,
    returnRate: calculateReturnRate(orderCount, returnedCount),
  };
}

export async function buildReturnRiskContextForProduct(params: {
  productId: string | number;
  channel: SalesChannel;
}): Promise<ReturnRiskContext> {
  const productId = String(params.productId);
  const cacheKey = `${productId}:${params.channel}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.context;
  }

  const dataset = await getCachedDataset();
  const productRows = dataset.byProduct.get(productId) ?? [];
  const categoryId = dataset.productMeta.get(productId)?.categoryId;
  const categoryRows = categoryId ? dataset.byCategory.get(categoryId) ?? [] : [];
  const channelRows = dataset.byChannel.get(params.channel) ?? [];
  const stats = {
    product: makeSlice(productRows),
    category: makeSlice(categoryRows),
    channel: makeSlice(channelRows),
    global: makeSlice(dataset.rows),
    productAveragePrice: average(productRows.map((row) => finite(row.salePrice))),
    categoryAveragePrice: average(categoryRows.map((row) => finite(row.salePrice))),
    expectedCostIfReturned: average(
      productRows.map((row) => finite(row.shippingCost) + finite(row.packagingCost))
    ),
  };
  const normalizedStats = normalizeReturnRiskStats({
    ...stats,
    expectedCostIfReturned:
      average(productRows.map((row) => finite(row.shippingCost) + finite(row.packagingCost))) ??
      average(channelRows.map((row) => finite(row.shippingCost) + finite(row.packagingCost))) ??
      dataset.globalExpectedCostIfReturned,
  });

  const context: ReturnRiskContext = {
    categoryId,
    categoryName: dataset.productMeta.get(productId)?.categoryName,
    stockLevel: dataset.productMeta.get(productId)?.stockLevel,
    historicalAveragePrice: stats.productAveragePrice ?? undefined,
    categoryAveragePrice: stats.categoryAveragePrice ?? undefined,
    stats: normalizedStats,
    generatedAt: new Date().toISOString(),
    source: dataset.rows.length > 0 ? "data_center" : "fallback",
  };

  contextCache.set(cacheKey, {
    context,
    expiresAt: now + RETURN_RISK_CACHE_TTL_MS,
  });

  return context;
}
