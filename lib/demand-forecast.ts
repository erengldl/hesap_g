import { getDefaultProductId, getMarketplaces, getProducts } from "./database-readers";
import { getDb, getOne, query } from "./db";
import { recalculateCostResultsForProductFromDatabase } from "./cost-engine";
import type {
  DemandForecastBootstrapResponse,
  DemandForecastChartPoint,
  DemandForecastRequest,
  DemandForecastResult,
  DemandForecastSelection,
  DemandForecastSummary,
  DemandForecastTableRow,
  ForecastHorizon,
  ForecastMarketplaceOption,
  ForecastProductOption,
  ForecastRiskLevel,
} from "./demand-forecast-types";
import type { Marketplace, Product } from "./types";

type CostSnapshotRow = {
  id: number;
  product_id: number;
  marketplace_id: number;
  marketplace_name: string | null;
  marketplace_slug: string | null;
  list_price: number | null;
  total_unit_cost: number | null;
  net_profit: number | null;
  calculated_at: string | null;
  shipping_mode: string | null;
  warning_notes: string | null;
};

type OrderHistoryRow = {
  date: string;
  units: number | null;
};

type InventoryHistoryRow = {
  date: string;
  stock_qty: number | null;
};

type DailyHistoryRow = {
  date: string;
  actualUnits: number;
  stockQty: number;
  source: "real" | "synthetic" | "mixed";
};

type EnrichedHistoryRow = DailyHistoryRow & {
  correctedUnits: number;
  isCensored: boolean;
  dayOfWeek: number;
  isWeekend: boolean;
  month: number;
  lag1: number;
  lag7: number;
  rollingMean7: number;
};

type DateRange = {
  start: Date;
  end: Date;
};

const FORECAST_HORIZONS: ForecastHorizon[] = [7, 14, 30];
const HISTORY_LOOKBACK_DAYS = 120;
const CHART_HISTORY_DAYS = 30;
const HISTORY_SOURCE_WINDOW_DAYS = 30;
const HISTORY_SOURCE_MIXED_THRESHOLD = 0.2;
const HISTORY_SOURCE_SYNTHETIC_THRESHOLD = 0.8;

type HistoryQuality = {
  dataSource: "real" | "mixed" | "synthetic";
  syntheticShare: number;
  syntheticDays: number;
  windowDays: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function roundWhole(value: number) {
  return Math.max(0, Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return new Date(year, Math.max(0, month - 1), day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(date);
}

function formatLongLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function seededRandom(seed: number) {
  let current = seed % 2147483647;
  if (current <= 0) current += 2147483646;
  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sameWeekdayAverage(history: EnrichedHistoryRow[], weekday: number) {
  const values = history
    .filter((row) => row.dayOfWeek === weekday)
    .slice(-8)
    .map((row) => row.correctedUnits);
  return values.length > 0 ? mean(values) : 0;
}

function lastSevenAverage(history: EnrichedHistoryRow[]) {
  const values = history.slice(-7).map((row) => row.correctedUnits);
  return values.length > 0 ? mean(values) : 0;
}

function lastFourteenAverage(history: EnrichedHistoryRow[]) {
  const values = history.slice(-14).map((row) => row.correctedUnits);
  return values.length > 0 ? mean(values) : 0;
}

function buildContinuousDates(range: DateRange) {
  const dates: Date[] = [];
  const cursor = startOfDay(range.start);
  const end = startOfDay(range.end);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildRiskLevel(projectedStock: number, currentStock: number, totalForecast: number): ForecastRiskLevel {
  if (projectedStock <= 0 || currentStock <= 0) return "High";
  if (projectedStock < Math.max(5, totalForecast * 0.25)) return "Medium";
  return "Low";
}

function buildConfidenceScore(wmape: number) {
  if (wmape <= 0.12) return "High" as const;
  if (wmape <= 0.22) return "Medium" as const;
  return "Low" as const;
}

function stockStatusFromValue(stockQty: number, demand: number) {
  if (stockQty <= 0) return "critical" as const;
  if (stockQty < demand * 3) return "tight" as const;
  return "healthy" as const;
}

function assessHistoryQuality(history: EnrichedHistoryRow[]): HistoryQuality {
  const window = history.slice(-HISTORY_SOURCE_WINDOW_DAYS);
  const syntheticDays = window.filter((row) => row.source !== "real").length;
  const syntheticShare = window.length > 0 ? syntheticDays / window.length : 0;
  const dataSource =
    syntheticShare > HISTORY_SOURCE_SYNTHETIC_THRESHOLD
      ? "synthetic"
      : syntheticShare > HISTORY_SOURCE_MIXED_THRESHOLD
        ? "mixed"
        : "real";

  return {
    dataSource,
    syntheticShare,
    syntheticDays,
    windowDays: window.length,
  };
}

async function getLatestCostSnapshots(productId?: number) {
  const rows = await query<CostSnapshotRow>(`
    SELECT
      cr.id,
      cr.product_id,
      cr.marketplace_id,
      m.name AS marketplace_name,
      m.slug AS marketplace_slug,
      cr.list_price,
      cr.total_unit_cost,
      cr.net_profit,
      cr.calculated_at,
      cr.shipping_mode,
      cr.warning_notes
    FROM cost_results cr
    LEFT JOIN marketplaces m ON m.marketplace_id = cr.marketplace_id
    ${productId ? "WHERE cr.product_id = ?" : ""}
    ORDER BY COALESCE(cr.calculated_at, CURRENT_TIMESTAMP) DESC, cr.id DESC
  `, productId ? [productId] : []);

  const latestByProduct = new Map<number, CostSnapshotRow>();
  const latestByProductAndMarketplace = new Map<string, CostSnapshotRow>();

  for (const row of rows) {
    if (!latestByProduct.has(row.product_id)) {
      latestByProduct.set(row.product_id, row);
    }
    const key = `${row.product_id}:${row.marketplace_id}`;
    if (!latestByProductAndMarketplace.has(key)) {
      latestByProductAndMarketplace.set(key, row);
    }
  }

  return { rows, latestByProduct, latestByProductAndMarketplace };
}

async function getSelectedCostSnapshot(productId: number, marketplaceId?: number) {
  const grouped = await getLatestCostSnapshots(productId);
  if (marketplaceId) {
    const direct = grouped.latestByProductAndMarketplace.get(`${productId}:${marketplaceId}`);
    if (direct) return direct;
  }
  return grouped.latestByProduct.get(productId) ?? null;
}

async function getCurrentStockForProduct(productId: number) {
  const row = await getOne<{ stock_qty: number | null }>(`
    SELECT COALESCE(SUM(stock_qty), 0) AS stock_qty
    FROM inventory_daily
    WHERE product_id = ?
      AND inventory_date = (
        SELECT MAX(inventory_date)
        FROM inventory_daily
        WHERE product_id = ?
      )
  `, [productId, productId]);

  return roundWhole(safeNumber(row?.stock_qty, 0));
}

async function getCurrentStockForSelection(productId: number, marketplaceId: number) {
  const row = await getOne<{ stock_qty: number | null }>(`
    SELECT COALESCE(SUM(stock_qty), 0) AS stock_qty
    FROM inventory_daily
    WHERE product_id = ?
      AND marketplace_id = ?
      AND inventory_date = (
        SELECT MAX(inventory_date)
        FROM inventory_daily
        WHERE product_id = ? AND marketplace_id = ?
      )
  `, [productId, marketplaceId, productId, marketplaceId]);

  return roundWhole(safeNumber(row?.stock_qty, 0));
}

async function getCurrentSalesVolumeForProduct(productId: number) {
  const row = await getOne<{ units: number | null }>(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS units
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.product_id = ?
      AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
      AND COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
  `, [productId]);

  return round2(safeNumber(row?.units, 0) / 30);
}

async function getCurrentSalesVolumeForSelection(productId: number, marketplaceId: number) {
  const row = await getOne<{ units: number | null }>(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS units
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.product_id = ?
      AND o.marketplace_id = ?
      AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
      AND COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
  `, [productId, marketplaceId]);

  return round2(safeNumber(row?.units, 0) / 30);
}

async function getOrderHistory(productId: number, marketplaceId: number) {
  return await query<OrderHistoryRow>(`
    SELECT
      o.order_date AS date,
      COALESCE(SUM(oi.quantity), 0) AS units
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.product_id = ?
      AND o.marketplace_id = ?
      AND COALESCE(o.status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
    GROUP BY o.order_date
    ORDER BY o.order_date ASC
  `, [productId, marketplaceId]);
}

async function getInventoryHistory(productId: number, marketplaceId: number) {
  return await query<InventoryHistoryRow>(`
    SELECT
      inventory_date AS date,
      COALESCE(SUM(stock_qty), 0) AS stock_qty
    FROM inventory_daily
    WHERE product_id = ?
      AND marketplace_id = ?
    GROUP BY inventory_date
    ORDER BY inventory_date ASC
  `, [productId, marketplaceId]);
}

function getHistoryRange(orderHistory: OrderHistoryRow[], inventoryHistory: InventoryHistoryRow[]) {
  const orderDate = orderHistory.length > 0 ? fromDateKey(orderHistory[0].date) : null;
  const inventoryDate = inventoryHistory.length > 0 ? fromDateKey(inventoryHistory[0].date) : null;
  const earliest = [orderDate, inventoryDate].filter((value): value is Date => Boolean(value)).sort((left, right) => left.getTime() - right.getTime())[0];
  const today = startOfDay(new Date());
  const lookbackStart = addDays(today, -HISTORY_LOOKBACK_DAYS + 1);
  return {
    start: earliest ? new Date(Math.max(earliest.getTime(), lookbackStart.getTime())) : lookbackStart,
    end: today,
  };
}

function buildSyntheticHistory(productId: number, marketplaceId: number, product: Product, currentStock: number) {
  const today = startOfDay(new Date());
  const stableSeed = (productId * 31) + (marketplaceId * 97) + ((today.getMonth() + 1) * 17);
  const rand = seededRandom(stableSeed);
  const dates = buildContinuousDates({
    start: addDays(startOfDay(new Date()), -HISTORY_LOOKBACK_DAYS + 1),
    end: startOfDay(new Date()),
  });

  const baseDemand = clamp(
    Math.round((safeNumber(product.cost, 0) * 0.018) + (safeNumber(product.packaging_cost, 0) * 0.15) + (safeNumber(product.desi, 0) * 1.8) + 8),
    4,
    120
  );
  const weekdayWeights = [0.84, 0.92, 0.97, 1.03, 1.12, 1.22, 1.08];
  const history: DailyHistoryRow[] = [];
  let stock = currentStock > 0 ? currentStock : Math.max(baseDemand * 9, 60);

  dates.forEach((date, index) => {
    const weekday = date.getDay();
    const seasonality = weekdayWeights[weekday] ?? 1;
    const trend = 1 + (index / Math.max(1, dates.length - 1)) * 0.12;
    const noise = 0.88 + rand() * 0.24;
    const demand = Math.max(0, Math.round(baseDemand * seasonality * trend * noise));

    const stockoutChance = stock < baseDemand * 1.15 && rand() > 0.7;
    const actualUnits = stockoutChance ? 0 : Math.min(stock, demand);
    stock = Math.max(0, stock - actualUnits);

    if (rand() > 0.82) {
      stock += Math.round(baseDemand * (1.8 + rand() * 2.4));
    }

    history.push({
      date: toDateKey(date),
      actualUnits,
      stockQty: stock,
      source: "synthetic",
    });
  });

  return history;
}

async function buildRealHistory(productId: number, marketplaceId: number, product: Product, currentStock: number) {
  const orders = await getOrderHistory(productId, marketplaceId);
  const inventory = await getInventoryHistory(productId, marketplaceId);

  if (orders.length === 0 && inventory.length === 0) {
    return buildSyntheticHistory(productId, marketplaceId, product, currentStock);
  }

  const range = getHistoryRange(orders, inventory);
  const dates = buildContinuousDates(range);
  const orderMap = new Map(orders.map((row) => [row.date, roundWhole(safeNumber(row.units, 0))]));
  const inventoryMap = new Map(inventory.map((row) => [row.date, roundWhole(safeNumber(row.stock_qty, 0))]));

  const baseDemand = clamp(
    Math.round((safeNumber(product.cost, 0) * 0.015) + (safeNumber(product.packaging_cost, 0) * 0.12) + (safeNumber(product.desi, 0) * 1.3) + 6),
    3,
    100
  );
  const syntheticHistory = buildSyntheticHistory(productId, marketplaceId, product, currentStock);
  const syntheticMap = new Map(syntheticHistory.map((row) => [row.date, row]));

  let carryStock = currentStock > 0 ? currentStock : Math.max(baseDemand * 9, 50);
  const history: DailyHistoryRow[] = [];

  for (const date of dates) {
    const key = toDateKey(date);
    const realOrder = orderMap.get(key);
    const realStock = inventoryMap.get(key);
    const synthetic = syntheticMap.get(key);

    let actualUnits = synthetic?.actualUnits ?? Math.max(0, Math.round(baseDemand * 0.85));
    let source: DailyHistoryRow["source"] = "synthetic";

    if (realOrder !== undefined) {
      actualUnits = roundWhole(realOrder);
      source = inventory.length > 0 ? "real" : "mixed";
    } else if (orders.length > 0) {
      source = inventory.length > 0 ? "real" : "mixed";
    }

    let stockQty = synthetic?.stockQty ?? carryStock;
    if (realStock !== undefined) {
      stockQty = roundWhole(realStock);
      source = orders.length > 0 ? (source === "real" ? "real" : "mixed") : "mixed";
    }

    if (inventory.length > 0 && realStock === undefined) {
      stockQty = carryStock;
    }

    carryStock = stockQty;

    history.push({
      date: key,
      actualUnits,
      stockQty,
      source,
    });
  }

  return history;
}

function enrichHistory(history: DailyHistoryRow[]) {
  const enriched: EnrichedHistoryRow[] = [];

  history.forEach((row, index) => {
    const previousValues = enriched.slice(Math.max(0, enriched.length - 7));
    const lag1 = index > 0 ? enriched[index - 1].correctedUnits : row.actualUnits;
    const lag7 = index >= 7 ? enriched[index - 7].correctedUnits : mean(previousValues.map((item) => item.correctedUnits));
    const rollingMean7 = previousValues.length > 0 ? mean(previousValues.map((item) => item.correctedUnits)) : row.actualUnits;
    const isCensored = row.actualUnits === 0 && row.stockQty === 0;
    const correctedUnits = isCensored ? Math.max(1, roundWhole(rollingMean7 || lag1 || row.actualUnits || 1)) : roundWhole(row.actualUnits);
    const date = fromDateKey(row.date);

    enriched.push({
      ...row,
      correctedUnits,
      isCensored,
      dayOfWeek: date.getDay(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      month: date.getMonth() + 1,
      lag1: round2(lag1),
      lag7: round2(lag7 || rollingMean7 || row.actualUnits),
      rollingMean7: round2(rollingMean7 || row.actualUnits),
    });
  });

  return enriched;
}

function predictNextDemand(history: EnrichedHistoryRow[], forecastDate: Date, currentSalesVolume: number) {
  const weekday = forecastDate.getDay();
  const baseRecent = currentSalesVolume > 0 ? currentSalesVolume : lastSevenAverage(history);
  const sameWeekday = sameWeekdayAverage(history, weekday);
  const rolling7 = lastSevenAverage(history);
  const rolling14 = lastFourteenAverage(history);
  const trend = rolling7 - rolling14;
  const weekendBoost = weekday === 0 || weekday === 6 ? 1.08 : 1;
  const blended = (rolling7 * 0.48) + (sameWeekday * 0.34) + (baseRecent * 0.18) + (trend * 0.22);
  return Math.max(1, roundWhole(blended * weekendBoost));
}

function estimateValidationMetrics(history: EnrichedHistoryRow[], horizonDays: ForecastHorizon, validationWindow: number) {
  const residuals: number[] = [];
  const wmapeErrors: number[] = [];
  let wmapeDenominator = 0;
  const trainable = history.slice(0, Math.max(0, history.length - validationWindow));
  const validation = history.slice(Math.max(0, history.length - validationWindow));
  const rollingHistory = [...trainable];

  validation.forEach((row) => {
    const prediction = predictNextDemand(rollingHistory, fromDateKey(row.date), lastSevenAverage(rollingHistory));
    residuals.push(Math.abs(row.correctedUnits - prediction));
    wmapeErrors.push(Math.abs(row.correctedUnits - prediction));
    wmapeDenominator += Math.max(0, row.correctedUnits);
    rollingHistory.push({
      ...row,
      correctedUnits: row.correctedUnits,
    });
  });

  const residualStd = standardDeviation(residuals);
  const residualMedian = median(residuals);
  const bandWidth = Math.max(1.5, residualStd * 1.65 + residualMedian * 0.25 + horizonDays * 0.08);
  const wmape = wmapeDenominator > 0 ? round2(wmapeErrors.reduce((sum, value) => sum + value, 0) / wmapeDenominator) : 0;
  return { bandWidth, wmape };
}

function computeValidationWindow(historyLength: number, horizonDays: ForecastHorizon) {
  const base = horizonDays <= 7 ? 7 : horizonDays <= 14 ? 10 : 14;
  const maxWindow = Math.max(7, Math.floor(historyLength * 0.2));
  return clamp(base, 7, Math.max(7, maxWindow));
}

function buildForecastSeries(
  history: EnrichedHistoryRow[],
  selection: DemandForecastSelection,
  currentStock: number,
  currentSalesVolume: number,
  currentPrice: number,
  currentUnitCost: number
) {
  const historyQuality = assessHistoryQuality(history);
  const validationWindow = computeValidationWindow(history.length, selection.horizonDays);
  const metrics = estimateValidationMetrics(history, selection.horizonDays, validationWindow);
  const bandWidth = metrics.bandWidth;
  const chartHistory = history.slice(-CHART_HISTORY_DAYS);
  const chartData: DemandForecastChartPoint[] = chartHistory.map((row) => ({
    date: row.date,
    label: formatShortLabel(fromDateKey(row.date)),
    actual_units: row.actualUnits,
    forecast_units: null,
    corrected_units: row.correctedUnits,
    lower_bound: null,
    upper_bound: null,
    band_span: null,
    projected_stock: null,
    is_forecast: false,
    is_censored: row.isCensored,
  }));

  const futureRows: DemandForecastTableRow[] = [];
  const futureChartPoints: DemandForecastChartPoint[] = [];
  let remainingStock = currentStock;
  const rollingHistory = [...history];
  let totalForecastUnits = 0;

  for (let offset = 1; offset <= selection.horizonDays; offset += 1) {
    const date = addDays(fromDateKey(history[history.length - 1].date), offset);
    const predictedUnits = predictNextDemand(rollingHistory, date, currentSalesVolume);
    const lowerBound = Math.max(0, Math.floor(predictedUnits - bandWidth));
    const upperBound = Math.max(lowerBound, Math.ceil(predictedUnits + bandWidth));
    remainingStock = Math.max(0, remainingStock - predictedUnits);
    const revenue = round2(predictedUnits * currentPrice);
    const riskLevel = buildRiskLevel(remainingStock, currentStock, predictedUnits);

    const forecastRow: DemandForecastTableRow = {
      date: toDateKey(date),
      label: formatLongLabel(date),
      predicted_units: predictedUnits,
      lower_bound: lowerBound,
      upper_bound: upperBound,
      revenue,
      projected_stock: remainingStock,
      risk_level: riskLevel,
      is_forecast: true,
    };

    futureRows.push(forecastRow);
    futureChartPoints.push({
      date: forecastRow.date,
      label: formatShortLabel(date),
      actual_units: null,
      forecast_units: predictedUnits,
      corrected_units: null,
      lower_bound: lowerBound,
      upper_bound: upperBound,
      band_span: upperBound - lowerBound,
      projected_stock: remainingStock,
      is_forecast: true,
      is_censored: false,
    });

    totalForecastUnits += predictedUnits;

    rollingHistory.push({
      date: forecastRow.date,
      actualUnits: predictedUnits,
      stockQty: remainingStock,
      source: "synthetic",
      correctedUnits: predictedUnits,
      isCensored: false,
      dayOfWeek: date.getDay(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      month: date.getMonth() + 1,
      lag1: rollingHistory[rollingHistory.length - 1]?.correctedUnits ?? predictedUnits,
      lag7: rollingHistory.length >= 7 ? rollingHistory[rollingHistory.length - 7].correctedUnits : predictedUnits,
      rollingMean7: mean(rollingHistory.slice(-7).map((item) => item.correctedUnits)),
    });
  }

  const wmape = metrics.wmape;
  const confidenceScore = buildConfidenceScore(wmape);
  const expectedRevenue = round2(totalForecastUnits * currentPrice);
  const unitNetProfit = round2(currentPrice - currentUnitCost);
  const expectedNetProfit = round2(totalForecastUnits * unitNetProfit);
  const stockWarning =
    currentStock <= 0
      ? "STOK YOK"
      : totalForecastUnits > currentStock
        ? "STOK YETERSIZ"
        : "STOK GUVENDE";

  const summary: DemandForecastSummary = {
    horizonDays: selection.horizonDays,
    historyWindowDays: history.length,
    historyDays: history.length,
    currentStock,
    currentSalesVolume: round2(currentSalesVolume),
    currentPrice: round2(currentPrice),
    currentUnitCost: round2(currentUnitCost),
    unitNetProfit,
    totalForecastUnits,
    monthlyDemand: totalForecastUnits,
    expectedRevenue,
    expectedNetProfit,
    wmape,
    confidenceScore,
    modelName: "StatisticalBaselineModel",
    confidenceMethod: "WMAPE bantları ve veri kapsama oranı",
    forecastStartDate: futureRows[0]?.date ?? toDateKey(addDays(new Date(), 1)),
    forecastEndDate: futureRows[futureRows.length - 1]?.date ?? toDateKey(addDays(new Date(), selection.horizonDays)),
    stockWarning,
    dataSource: historyQuality.dataSource,
    isSyntheticHistory: historyQuality.syntheticShare > 0,
  };

  return {
    summary,
    chartData: [...chartData, ...futureChartPoints],
    tableRows: futureRows,
    validationWindow,
    wmape,
    historyQuality,
  };
}

async function getMarketplaceOptions(): Promise<ForecastMarketplaceOption[]> {
  return (await getMarketplaces())
    .filter((marketplace) => ["trendyol", "hepsiburada", "own_website"].includes(String(marketplace.slug ?? "")))
    .map((marketplace) => ({
      id: marketplace.id,
      name: marketplace.name,
      slug: marketplace.slug,
      current_price: 0,
      current_unit_cost: 0,
      current_net_profit: 0,
      stock_status: "healthy" as const,
    }))
    .sort((left, right) => {
      const order = ["trendyol", "hepsiburada", "own_website"];
      return order.indexOf(String(left.slug ?? "")) - order.indexOf(String(right.slug ?? ""));
    });
}

async function getProductOptions(selectedMarketplaceId?: number): Promise<ForecastProductOption[]> {
  const products = await getProducts();
  const latestCostSnapshots = await getLatestCostSnapshots();

  return await Promise.all(products.map(async (product) => {
    const snapshot = selectedMarketplaceId
      ? latestCostSnapshots.latestByProductAndMarketplace.get(`${product.id}:${selectedMarketplaceId}`) ?? null
      : latestCostSnapshots.latestByProduct.get(product.id) ?? null;
    const fallbackUnitCost = round2(safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0));
    const currentStock = selectedMarketplaceId
      ? await getCurrentStockForSelection(product.id, selectedMarketplaceId)
      : await getCurrentStockForProduct(product.id);
    const currentSalesVolume = selectedMarketplaceId
      ? await getCurrentSalesVolumeForSelection(product.id, selectedMarketplaceId)
      : await getCurrentSalesVolumeForProduct(product.id);
    const currentUnitCost = round2(safeNumber(snapshot?.total_unit_cost, fallbackUnitCost));
    const currentPrice = round2(safeNumber(snapshot?.list_price ?? product.sale_price, product.sale_price));
    const currentNetProfit = round2(safeNumber(snapshot?.net_profit, currentPrice - currentUnitCost));
    const stockStatus = stockStatusFromValue(currentStock, Math.max(1, currentSalesVolume));
    const recentOrders = await query<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE product_id = ?
          AND COALESCE(status, 'completed') NOT IN ('cancelled', 'returned', 'pending')
      `,
      [product.id]
    );
    const recentInventory = await query<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_daily
        WHERE product_id = ?
      `,
      [product.id]
    );
    const dataCoverage = safeNumber(recentOrders[0]?.count, 0) + safeNumber(recentInventory[0]?.count, 0);
    const confidence_score = dataCoverage > 120 ? "High" : dataCoverage > 40 ? "Medium" : "Low";

    return {
      ...product,
      current_stock: currentStock,
      current_sales_volume: round2(currentSalesVolume),
      current_unit_cost: currentUnitCost,
      current_net_profit: currentNetProfit,
      confidence_score,
      stock_status: stockStatus,
      sale_price: currentPrice,
    };
  }));
}

async function resolveSelection(input: Partial<DemandForecastRequest>, products: ForecastProductOption[], marketplaces: ForecastMarketplaceOption[]): Promise<DemandForecastSelection> {
  const defaultProductId = await getDefaultProductId() ?? products[0]?.id ?? 0;
  const selectedProductId = products.some((product) => product.id === input.productId) ? Number(input.productId) : defaultProductId;
  const selectedMarketplaceId = marketplaces.some((marketplace) => marketplace.id === input.marketplaceId)
    ? Number(input.marketplaceId)
    : await (async () => {
        const bestSnapshot = await getSelectedCostSnapshot(selectedProductId);
        return bestSnapshot?.marketplace_id ?? marketplaces[0]?.id ?? 1;
      })();
  const horizonDays = FORECAST_HORIZONS.includes(input.horizonDays as ForecastHorizon)
    ? (input.horizonDays as ForecastHorizon)
    : 14;

  return {
    productId: selectedProductId,
    marketplaceId: selectedMarketplaceId,
    horizonDays,
  };
}

async function resolveCurrentSnapshot(selection: DemandForecastSelection, product: Product, marketplace: Marketplace) {
  const snapshot = await getSelectedCostSnapshot(selection.productId, selection.marketplaceId);
  if (snapshot) return snapshot;

  const maybeRecalculated = await recalculateCostResultsForProductFromDatabase(selection.productId);
  if (maybeRecalculated) {
    const recalculatedSnapshot = await getSelectedCostSnapshot(selection.productId, selection.marketplaceId);
    if (recalculatedSnapshot) return recalculatedSnapshot;
  }

  return {
    id: 0,
    product_id: selection.productId,
    marketplace_id: selection.marketplaceId,
    marketplace_name: marketplace.name,
    marketplace_slug: marketplace.slug,
    list_price: safeNumber(product.sale_price, 0),
    total_unit_cost: round2(safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0)),
    net_profit: round2(safeNumber(product.sale_price, 0) - (safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0))),
    calculated_at: new Date().toISOString(),
    shipping_mode: null,
    warning_notes: "Cost result snapshot unavailable; fallback used.",
  } satisfies CostSnapshotRow;
}

async function buildContext(selection: DemandForecastSelection) {
  const products = await getProductOptions(selection.marketplaceId);
  const marketplaces = await getMarketplaceOptions();
  const product = products.find((item) => item.id === selection.productId) ?? products[0];
  const marketplace = marketplaces.find((item) => item.id === selection.marketplaceId) ?? marketplaces[0];

  if (!product || !marketplace) {
    return null;
  }

  const rawProduct = (await getProducts()).find((item) => item.id === product.id);
  if (!rawProduct) {
    return null;
  }

  const currentSnapshot = await resolveCurrentSnapshot(selection, rawProduct, marketplace);
  const currentPrice = round2(safeNumber(currentSnapshot.list_price, product.sale_price));
  const currentUnitCost = round2(safeNumber(currentSnapshot.total_unit_cost, product.current_unit_cost));
  const currentNetProfit = round2(safeNumber(currentSnapshot.net_profit, currentPrice - currentUnitCost));
  const currentStock = await getCurrentStockForSelection(selection.productId, selection.marketplaceId);
  const currentSalesVolume = await getCurrentSalesVolumeForSelection(selection.productId, selection.marketplaceId);

  return {
    product,
    marketplace,
    rawProduct,
    currentSnapshot,
    currentPrice,
    currentUnitCost,
    currentNetProfit,
    currentStock,
    currentSalesVolume,
  };
}

async function persistForecastRows(selection: DemandForecastSelection, result: DemandForecastResult) {
  const db = getDb();
  if (!db) return 0;

  const insertRow = db.prepare(`
    INSERT INTO demand_forecasts (
      forecast_id,
      product_id,
      marketplace_id,
      forecast_date,
      horizon_days,
      predicted_units,
      lower_bound,
      upper_bound,
      wmape,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const deleteExisting = db.prepare(`
    DELETE FROM demand_forecasts
    WHERE product_id = ? AND marketplace_id = ? AND horizon_days = ?
  `);

  await db.transaction(async () => {
    await deleteExisting.run(selection.productId, selection.marketplaceId, selection.horizonDays);
    for (const row of result.tableRows) {
      await insertRow.run(
        `${selection.productId}-${selection.marketplaceId}-${selection.horizonDays}-${row.date}`,
        selection.productId,
        selection.marketplaceId,
        row.date,
        selection.horizonDays,
        row.predicted_units,
        row.lower_bound,
        row.upper_bound,
        result.summary.wmape
      );
    }
  });

  return result.tableRows.length;
}

export class DemandForecastEngine {
  async buildBootstrap(input: Partial<DemandForecastRequest> = {}): Promise<DemandForecastBootstrapResponse> {
    const marketplaces = await getMarketplaceOptions();
    const selectionProducts = await getProductOptions();
    const defaults = await resolveSelection(input, selectionProducts, marketplaces);
    const context = await buildContext(defaults);

    if (!context) {
      throw new Error("Forecast context could not be resolved");
    }

    const products = await getProductOptions(defaults.marketplaceId);
    const history = enrichHistory(await buildRealHistory(defaults.productId, defaults.marketplaceId, context.rawProduct, context.currentStock));
    const forecast = buildForecastSeries(history, defaults, context.currentStock, context.currentSalesVolume, context.currentPrice, context.currentUnitCost);
    const selectedProduct = products.find((product) => product.id === defaults.productId) ?? products[0];
    const selectedMarketplace = marketplaces.find((marketplace) => marketplace.id === defaults.marketplaceId) ?? marketplaces[0];

    return {
      products,
      marketplaces,
      horizons: FORECAST_HORIZONS,
      defaults,
      selectedProduct,
      selectedMarketplace,
      result: this.buildResult(defaults, context, forecast),
      historyDepthDays: HISTORY_LOOKBACK_DAYS,
      warnings: this.buildWarnings(forecast),
      methodology: this.getMethodology(forecast),
    };
  }

  async generateForecast(input: Partial<DemandForecastRequest> = {}): Promise<DemandForecastResult> {
    const marketplaces = await getMarketplaceOptions();
    const selectionProducts = await getProductOptions();
    const selection = await resolveSelection(input, selectionProducts, marketplaces);
    const context = await buildContext(selection);

    if (!context) {
      throw new Error("Forecast context could not be resolved");
    }

    const currentStock = input.currentStock !== undefined ? roundWhole(safeNumber(input.currentStock, context.currentStock)) : context.currentStock;
    const currentSalesVolume = context.currentSalesVolume;
    const history = enrichHistory(await buildRealHistory(selection.productId, selection.marketplaceId, context.rawProduct, currentStock));
    const forecast = buildForecastSeries(
      history,
      selection,
      currentStock,
      currentSalesVolume,
      context.currentPrice,
      context.currentUnitCost
    );

    const result = this.buildResult(selection, context, forecast);

    if (input.persist !== false) {
      await persistForecastRows(selection, result);
    }

    return result;
  }

  private buildWarnings(forecast: ReturnType<typeof buildForecastSeries>) {
    const warnings: string[] = [];
    if (forecast.historyQuality.syntheticShare > HISTORY_SOURCE_MIXED_THRESHOLD) {
      warnings.push("Yetersiz veri nedeniyle geçmiş satışlar istatistiksel olarak tamamlanmıştır.");
    }

    if (forecast.summary.stockWarning === "STOK YETERSIZ") {
      warnings.push("Seçilen ufukta tahmin edilen talep mevcut stoktan yüksek.");
    }

    return warnings;
  }

  private getMethodology(forecast: ReturnType<typeof buildForecastSeries>) {
    const source = forecast.summary.dataSource;
    const base = source === "real"
      ? "Gerçek sipariş ve stok verileri kullanılarak"
      : source === "mixed"
        ? "Kısmi gerçek veri, kısmi istatistiksel tamamlamayla"
        : "Gerçek veri bulunamadığı için sentetik baz seri ile";

    return `${base} istatistiksel baseline modeli, censored demand düzeltmesi, lag/rolling feature seti ve kısa vadeli sezonluk sinyaller ile tahmin üretildi.`;
  }

  private buildResult(
    selection: DemandForecastSelection,
    context: NonNullable<Awaited<ReturnType<typeof buildContext>>>,
    forecast: ReturnType<typeof buildForecastSeries>
  ): DemandForecastResult {
    const result: DemandForecastResult = {
      product: {
        ...context.rawProduct,
        sale_price: context.currentPrice,
        active_channels: context.product.active_channels,
        status: context.rawProduct.status ?? "active",
        status_label: context.rawProduct.status_label ?? "Aktif",
      },
      marketplace: {
        id: context.marketplace.id,
        name: context.marketplace.name,
        slug: context.marketplace.slug,
      },
      selection,
      summary: forecast.summary,
      chartData: forecast.chartData,
      tableRows: forecast.tableRows,
      methodology: this.getMethodology(forecast),
      warnings: this.buildWarnings(forecast),
      generatedAt: new Date().toISOString(),
    };

    return result;
  }
}

const sharedForecastEngine = new DemandForecastEngine();

export async function buildDemandForecastBootstrap(productId?: number, marketplaceId?: number, horizonDays: ForecastHorizon = 14) {
  return await sharedForecastEngine.buildBootstrap({ productId, marketplaceId, horizonDays });
}

export async function generateDemandForecast(input: Partial<DemandForecastRequest> = {}) {
  return await sharedForecastEngine.generateForecast(input);
}

export async function buildDemandForecast(productId?: number) {
  return await sharedForecastEngine.generateForecast({ productId, horizonDays: 30, persist: false });
}

export async function buildDemandForecastBootstrapResponse(productId?: number, marketplaceId?: number, horizonDays: ForecastHorizon = 14) {
  return await buildDemandForecastBootstrap(productId, marketplaceId, horizonDays);
}

export async function persistDemandForecast(selection: DemandForecastSelection, result: DemandForecastResult) {
  return await persistForecastRows(selection, result);
}
