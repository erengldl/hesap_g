import type {
  ReturnRiskContext,
  ReturnRiskFeatureVector,
  ReturnRiskPredictionInput,
  ReturnRiskStats,
  ReturnRiskStatsSlice,
  ReturnRiskTrainingRow,
} from "./types";

export const RETURN_RISK_FEATURE_NAMES = [
  "product_id_encoded",
  "category_id_encoded",
  "brand_encoded",
  "channel_encoded",
  "product_cost",
  "sale_price",
  "gross_margin_before_return",
  "product_age_days",
  "stock_level",
  "variant_count",
  "commission_rate",
  "shipping_cost",
  "platform_fee",
  "price_change_rate",
  "price_vs_product_avg",
  "price_vs_category_avg",
  "discount_rate",
  "product_order_count_30d",
  "product_order_count_90d",
  "product_return_count_30d",
  "product_return_count_90d",
  "product_return_rate_30d",
  "product_return_rate_90d",
  "category_return_rate_90d",
  "channel_return_rate_90d",
  "forecasted_demand",
  "demand_confidence",
  "stock_risk_score",
  "day_of_week",
  "month",
  "is_weekend",
  "season_index",
  "low_data_flag",
  "high_price_increase_flag",
  "high_return_category_flag",
  "high_shipping_cost_flag",
] as const;

const DEFAULT_RETURN_RATE = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function nullableFinite(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

function round(value: number) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : 0;
}

function stableHash(value: string | undefined) {
  const source = value?.trim().toLowerCase() || "unknown";
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1000;
}

function makeSlice(orderCount: number, returnedCount: number): ReturnRiskStatsSlice {
  const safeOrders = Math.max(0, Math.round(finite(orderCount)));
  const safeReturned = clamp(Math.round(finite(returnedCount)), 0, safeOrders);
  return {
    orderCount: safeOrders,
    returnedCount: safeReturned,
    returnRate: safeOrders > 0 ? round(safeReturned / safeOrders) : DEFAULT_RETURN_RATE,
  };
}

function emptyStats(): ReturnRiskStats {
  return {
    product: makeSlice(0, 0),
    category: makeSlice(0, 0),
    channel: makeSlice(0, 0),
    global: makeSlice(0, 0),
    productAveragePrice: null,
    categoryAveragePrice: null,
    expectedCostIfReturned: null,
  };
}

function normalizeSlice(input: Partial<ReturnRiskStatsSlice> | undefined): ReturnRiskStatsSlice {
  return makeSlice(finite(input?.orderCount), finite(input?.returnedCount));
}

export function normalizeReturnRiskStats(input?: Partial<ReturnRiskStats>): ReturnRiskStats {
  const fallback = emptyStats();
  return {
    product: normalizeSlice(input?.product ?? fallback.product),
    category: normalizeSlice(input?.category ?? fallback.category),
    channel: normalizeSlice(input?.channel ?? fallback.channel),
    global: normalizeSlice(input?.global ?? fallback.global),
    productAveragePrice: nullableFinite(input?.productAveragePrice),
    categoryAveragePrice: nullableFinite(input?.categoryAveragePrice),
    expectedCostIfReturned: nullableFinite(input?.expectedCostIfReturned),
  };
}

export function calculateReturnRate(orderCount: number, returnedCount: number) {
  return makeSlice(orderCount, returnedCount).returnRate;
}

function aggregateSlice(
  rows: ReturnRiskTrainingRow[],
  predicate: (row: ReturnRiskTrainingRow) => boolean
) {
  const filtered = rows.filter(predicate);
  return makeSlice(filtered.length, filtered.filter((row) => row.isReturnedOrLost).length);
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (validValues.length === 0) {
    return null;
  }

  return round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

export function buildReturnRiskStats(
  rows: ReturnRiskTrainingRow[],
  params?: {
    productId?: string;
    categoryId?: string;
    channel?: string;
  }
): ReturnRiskStats {
  const productId = params?.productId;
  const categoryId = params?.categoryId;
  const channel = params?.channel;
  const productRows = productId ? rows.filter((row) => row.productId === productId) : [];
  const categoryRows = categoryId ? rows.filter((row) => row.categoryId === categoryId) : [];

  return {
    product: productId ? aggregateSlice(rows, (row) => row.productId === productId) : makeSlice(0, 0),
    category: categoryId ? aggregateSlice(rows, (row) => row.categoryId === categoryId) : makeSlice(0, 0),
    channel: channel ? aggregateSlice(rows, (row) => row.channel === channel) : makeSlice(0, 0),
    global: aggregateSlice(rows, () => true),
    productAveragePrice: average(productRows.map((row) => row.salePrice)),
    categoryAveragePrice: average(categoryRows.map((row) => row.salePrice)),
    expectedCostIfReturned: average(
      rows.map((row) => finite(row.shippingCost) + finite(row.packagingCost))
    ),
  };
}

function resolveStats(input: ReturnRiskPredictionInput) {
  return normalizeReturnRiskStats(input.context?.stats);
}

function priceRatio(price: number, baseline: number | null | undefined) {
  const safeBaseline = finite(baseline, 0);
  if (safeBaseline <= 0) {
    return 0;
  }

  return round(price / safeBaseline - 1);
}

function resolveExpectedCostIfReturned(input: ReturnRiskPredictionInput, stats: ReturnRiskStats) {
  const statsCost = finite(stats.expectedCostIfReturned, 0);
  const manualCost = finite(input.shippingCost) + finite(input.packagingCost);
  return round(Math.max(0, statsCost || manualCost));
}

function temporalFeatures(dateValue?: string) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const dayOfWeek = Number.isFinite(date.getTime()) ? date.getDay() : 0;
  const month = Number.isFinite(date.getTime()) ? date.getMonth() + 1 : 1;
  return {
    dayOfWeek,
    month,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
    seasonIndex: Math.floor(((month % 12) + 3) / 3),
  };
}

export function buildReturnRiskFeatureVector(
  input: ReturnRiskPredictionInput,
  dateValue?: string
): ReturnRiskFeatureVector {
  const context: ReturnRiskContext = input.context ?? {};
  const stats = resolveStats(input);
  const price = Math.max(0, finite(input.price));
  const productCost = finite(input.productCost);
  const shippingCost = finite(input.shippingCost);
  const packagingCost = finite(input.packagingCost);
  const platformFee = finite(input.platformFee);
  const productAveragePrice =
    nullableFinite(context.historicalAveragePrice) ??
    nullableFinite(input.basePrice) ??
    stats.productAveragePrice;
  const categoryAveragePrice =
    nullableFinite(context.categoryAveragePrice) ?? stats.categoryAveragePrice;
  const discountRate = price > 0 ? clamp(finite(context.discountAmount) / price, 0, 1) : 0;
  const forecastedDemand =
    nullableFinite(input.demandForecast) ??
    nullableFinite(context.forecastedDemand) ??
    nullableFinite(input.baseDemand) ??
    0;
  const grossMarginBeforeReturn = price > 0 ? (price - productCost - shippingCost - packagingCost) / price : 0;
  const temporal = temporalFeatures(dateValue);
  const expectedCostIfReturned = resolveExpectedCostIfReturned(input, stats);
  const missingValueCount = [
    input.productCost,
    input.shippingCost,
    input.packagingCost,
    input.commissionRate,
    context.categoryId,
    context.historicalAveragePrice,
    forecastedDemand,
  ].filter((value) => value === undefined || value === null || value === "").length;

  const values: Record<string, number> = {
    product_id_encoded: stableHash(input.productId),
    category_id_encoded: stableHash(context.categoryId),
    brand_encoded: stableHash(context.brand),
    channel_encoded: stableHash(input.channel),
    product_cost: productCost,
    sale_price: price,
    gross_margin_before_return: round(grossMarginBeforeReturn),
    product_age_days: finite(context.productAgeDays),
    stock_level: finite(context.stockLevel, finite(input.stockLimit)),
    variant_count: finite(context.variantCount, 1),
    commission_rate: finite(input.commissionRate),
    shipping_cost: shippingCost,
    platform_fee: platformFee,
    price_change_rate: priceRatio(price, productAveragePrice),
    price_vs_product_avg: priceRatio(price, productAveragePrice),
    price_vs_category_avg: priceRatio(price, categoryAveragePrice),
    discount_rate: round(discountRate),
    product_order_count_30d: stats.product.orderCount,
    product_order_count_90d: stats.product.orderCount,
    product_return_count_30d: stats.product.returnedCount,
    product_return_count_90d: stats.product.returnedCount,
    product_return_rate_30d: stats.product.returnRate,
    product_return_rate_90d: stats.product.returnRate,
    category_return_rate_90d: stats.category.returnRate,
    channel_return_rate_90d: stats.channel.returnRate,
    forecasted_demand: finite(forecastedDemand),
    demand_confidence: clamp(finite(context.demandConfidence, stats.product.orderCount >= 30 ? 0.7 : 0.35), 0, 1),
    stock_risk_score: clamp(finite(context.stockRiskScore), 0, 1),
    day_of_week: temporal.dayOfWeek,
    month: temporal.month,
    is_weekend: temporal.isWeekend,
    season_index: temporal.seasonIndex,
    low_data_flag: stats.product.orderCount < 30 ? 1 : 0,
    high_price_increase_flag: priceRatio(price, productAveragePrice) > 0.2 ? 1 : 0,
    high_return_category_flag: stats.category.returnRate >= 0.12 ? 1 : 0,
    high_shipping_cost_flag: price > 0 && shippingCost / price >= 0.12 ? 1 : 0,
  };

  return {
    values,
    missingValueCount,
    stats,
    expectedCostIfReturned,
  };
}

export function buildReturnRiskTrainingExample(
  row: ReturnRiskTrainingRow,
  allRows: ReturnRiskTrainingRow[]
) {
  const stats = buildReturnRiskStats(allRows, {
    productId: row.productId,
    categoryId: row.categoryId,
    channel: row.channel,
  });
  const vector = buildReturnRiskFeatureVector(
    {
      productId: row.productId,
      channel: row.channel,
      price: row.salePrice,
      productCost: row.productCost,
      packagingCost: row.packagingCost,
      shippingCost: row.shippingCost,
      commissionRate: row.commissionRate,
      platformFee: row.platformFee,
      basePrice: row.historicalAveragePrice,
      demandForecast: row.demandForecast,
      stockLimit: row.stock,
      context: {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        brand: row.brand,
        productAgeDays: row.productAgeDays,
        variantCount: row.variantCount,
        stockLevel: row.stock,
        historicalAveragePrice: row.historicalAveragePrice,
        categoryAveragePrice: row.categoryAveragePrice,
        discountAmount: row.discountAmount,
        campaignFlag: row.campaignFlag,
        adAttributedFlag: row.adAttributedFlag,
        demandConfidence: row.demandConfidence,
        stockRiskScore: row.stockRiskScore,
        stats,
      },
    },
    row.orderDate
  );

  return {
    vector,
    label: row.isReturnedOrLost ? 1 : 0,
  };
}

export function getReturnRiskFeatureArray(vector: ReturnRiskFeatureVector) {
  return RETURN_RISK_FEATURE_NAMES.map((name) => finite(vector.values[name]));
}
