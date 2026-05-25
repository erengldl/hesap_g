import { randomUUID } from "node:crypto";
import { getDb, getOne } from "@/lib/db";
import { getMarketplaces, getProducts, getProductMarketplaceSetting } from "@/lib/database-readers";
import { calculateChannelCost } from "./cost-engine";
import { getProductSalesVelocity } from "./product-history";
import { recalculateCostResultsForProduct } from "./portfolio-analytics";
import type { Marketplace, Product } from "@/lib/types";

export type ConfidenceScore = "Low" | "Medium" | "High";
export type RiskLevel = "Low" | "Medium" | "High";
export type PriceOptimizationRunStatus = "DRAFT" | "PUBLISHED";

export interface PriceOptimizationInput {
  productId: number;
  marketplaceId: number;
  minPrice: number;
  maxPrice: number;
  currentSalesVolume: number;
  stock: number;
  elasticityEstimate?: number | null;
}

export interface PriceOptimizationScenarioPoint {
  price: number;
  expected_demand: number;
  unit_profit: number;
  total_profit: number;
  revenue: number;
  is_optimum: boolean;
  total_unit_cost?: number;
  commission_cost?: number;
  estimated_vat_payable?: number;
}

export interface PriceOptimizationScenarioRow {
  label: string;
  test_price: number;
  expected_sales: number;
  unit_profit: number;
  total_profit: number;
  risk_level: RiskLevel;
}

export interface PriceOptimizationResult {
  run_id?: string;
  run_status?: PriceOptimizationRunStatus;
  product_id: number;
  marketplace_id: number;
  product: Product;
  marketplace: Marketplace;
  current_price: number;
  recommended_price: number;
  min_price_limit: number;
  max_price_limit: number;
  expected_demand_current: number;
  expected_demand_recommended: number;
  expected_profit_current: number;
  expected_profit_recommended: number;
  current_unit_cost: number;
  current_unit_profit: number;
  current_commission_cost?: number;
  current_estimated_vat_payable?: number;
  current_sales_volume: number;
  stock: number;
  elasticity_estimate: number;
  confidence_score: ConfidenceScore;
  profit_change_percent: number | null;
  demand_change_percent: number | null;
  current_point: PriceOptimizationScenarioPoint;
  recommended_point: PriceOptimizationScenarioPoint;
  recommended_commission_cost?: number;
  recommended_estimated_vat_payable?: number;
  scenario_data: PriceOptimizationScenarioPoint[];
  scenario_table: PriceOptimizationScenarioRow[];
  generated_at: string;
}

export interface PriceOptimizationRunRecord {
  run_id: string;
  product_id: number;
  marketplace_id: number;
  current_price: number;
  recommended_price: number;
  min_price_limit: number;
  max_price_limit: number;
  expected_demand_current: number;
  expected_demand_recommended: number;
  expected_profit_current: number;
  expected_profit_recommended: number;
  elasticity_estimate: number;
  confidence_score: ConfidenceScore;
  status: PriceOptimizationRunStatus;
  stock: number;
  current_sales_volume: number;
  created_at: string;
  published_at: string | null;
}

type CostResultRow = {
  product_id: number;
  marketplace_id: number;
  marketplace_slug: string | null;
  marketplace_name: string | null;
  list_price: number | null;
  total_unit_cost: number | null;
  net_profit: number | null;
  unit_ad_cost: number | null;
  unit_fixed_cost: number | null;
  expected_return_cost: number | null;
  payment_gateway_rule_id: number | null;
  shipping_company_id: number | null;
  manual_shipping_cost: number | null;
  shipping_mode: string | null;
};

type PricePointEconomics = {
  totalUnitCost: number;
  commissionCost: number;
  estimatedVatPayable: number;
  unitProfitAfterVat: number;
};

const DEFAULT_MARKETPLACE_SEQUENCE = ["trendyol", "hepsiburada", "own_website"] as const;
const PRICE_GRID_POINT_COUNT = 41;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function linspace(start: number, stop: number, count: number) {
  if (count <= 1) {
    return [round2(start)];
  }

  const step = (stop - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => round2(start + step * index));
}

function safeNegative(value: number) {
  return -Math.abs(Number.isFinite(value) ? value : 1.5);
}

async function resolveHistoricalSalesVolume(productId: number, marketplaceId?: number) {
  const totalUnits30 =
    (await getProductSalesVelocity(productId, 30, marketplaceId)) * 30 ||
    (await getProductSalesVelocity(productId, 30)) * 30;
  return Math.max(1, round2(totalUnits30));
}

function resolveHistoricalStock(currentSalesVolume: number) {
  return Math.max(60, Math.round(currentSalesVolume * 1.75));
}

function resolveDefaultElasticity(product: Product) {
  const text = `${product.category_path ?? ""} ${product.category_name ?? ""}`.toLowerCase();

  if (/(kozmetik|parfüm|cilt|güzellik|makyaj)/.test(text)) {
    return -2.3;
  }

  if (/(giyim|ayakkabı|çanta|takı|bileklik|kolye|cüzdan|bere|şal|aksesuar|gözlük)/.test(text)) {
    return -1.9;
  }

  if (/(elektronik|teknoloji|telefon|bilgisayar|akıllı saat|kulaklık|mouse|klavye|hoparlör)/.test(text)) {
    return -1.4;
  }

  if (/(ev|yaşam|mutfak|dekor|aydınlatma|kupa|termos)/.test(text)) {
    return -1.6;
  }

  return -1.7;
}

function resolveConfidenceScore(input: PriceOptimizationInput, defaultElasticityUsed: boolean): ConfidenceScore {
  const rangeWidth = Math.max(0, input.maxPrice - input.minPrice);
  const rangeRatio = rangeWidth / Math.max(1, input.minPrice);
  const strongData = input.currentSalesVolume >= 75 && input.stock >= input.currentSalesVolume * 1.5;

  if (!defaultElasticityUsed && strongData && rangeRatio >= 0.2) {
    return "High";
  }

  if (strongData && rangeRatio >= 0.1) {
    return "Medium";
  }

  return "Low";
}

async function getCurrentCostResult(productId: number, marketplaceId: number) {
  return await getOne<CostResultRow>(`
    SELECT
      product_id,
      marketplace_id,
      marketplace_slug,
      marketplace_name,
      list_price,
      total_unit_cost,
      net_profit,
      unit_ad_cost,
      unit_fixed_cost,
      expected_return_cost,
      payment_gateway_rule_id,
      shipping_company_id,
      manual_shipping_cost,
      shipping_mode
    FROM cost_results
    WHERE product_id = ? AND marketplace_id = ?
    LIMIT 1
  `, [productId, marketplaceId]);
}

async function getCurrentCostResultByProduct(productId: number) {
  return await getOne<CostResultRow>(`
    SELECT
      product_id,
      marketplace_id,
      marketplace_slug,
      marketplace_name,
      list_price,
      total_unit_cost,
      net_profit,
      unit_ad_cost,
      unit_fixed_cost,
      expected_return_cost,
      payment_gateway_rule_id,
      shipping_company_id,
      manual_shipping_cost,
      shipping_mode
    FROM cost_results
    WHERE product_id = ?
    ORDER BY net_profit DESC
    LIMIT 1
  `, [productId]);
}

function getCurrentPoint(price: number, unitCost: number, currentSalesVolume: number) {
  const demand = Math.max(0, round2(currentSalesVolume));
  const unitProfit = round2(price - unitCost);
  const totalProfit = round2(unitProfit * demand);
  return {
    price: round2(price),
    expected_demand: demand,
    unit_profit: unitProfit,
    total_profit: totalProfit,
    revenue: round2(price * demand),
    is_optimum: false,
  };
}

async function getPricePointEconomics(
  product: Product,
  marketplace: Marketplace,
  salePrice: number,
  currentCostRow: CostResultRow | null,
  productSetting?: Awaited<ReturnType<typeof getProductMarketplaceSetting>>
) {
  const channelCost = await calculateChannelCost(marketplace.name, {
    product,
    salePrice,
    adCost: Number(currentCostRow?.unit_ad_cost ?? 0),
    fixedCost: Number(currentCostRow?.unit_fixed_cost ?? 0),
    expectedReturnCost: currentCostRow?.expected_return_cost ?? undefined,
    paymentGatewayRuleId: currentCostRow?.payment_gateway_rule_id ?? productSetting?.payment_gateway_rule_id ?? undefined,
    manualShippingCost: currentCostRow?.manual_shipping_cost ?? productSetting?.manual_shipping_cost ?? undefined,
    productSetting: productSetting ?? undefined,
  });

  return {
    totalUnitCost: round2(Number(channelCost.total_unit_cost ?? 0)),
    commissionCost: round2(Number(channelCost.commission_cost ?? 0)),
    estimatedVatPayable: round2(Number(channelCost.estimated_vat_payable ?? 0)),
    unitProfitAfterVat: round2(Number(channelCost.net_profit ?? 0) - Number(channelCost.estimated_vat_payable ?? 0)),
  } satisfies PricePointEconomics;
}

function buildScenarioRows(scenarioData: PriceOptimizationScenarioPoint[]) {
  if (scenarioData.length === 0) {
    return [];
  }

  const bestPoint = scenarioData.reduce((best, current) => (current.total_profit > best.total_profit ? current : best));
  const targets = [
    { label: "Çok Agresif", target: scenarioData[0].price, risk_level: "High" as const },
    { label: "Agresif", target: scenarioData[Math.min(1, scenarioData.length - 1)]?.price ?? scenarioData[0].price, risk_level: "Medium" as const },
    { label: "Optimum", target: bestPoint.price, risk_level: "Low" as const },
    { label: "Korumacı", target: scenarioData[Math.max(0, Math.floor((scenarioData.length - 1) * 0.75))]?.price ?? scenarioData[scenarioData.length - 1].price, risk_level: "Medium" as const },
    { label: "Yüksek Marj", target: scenarioData[scenarioData.length - 1].price, risk_level: "High" as const },
  ];

  const used = new Set<number>();
  return targets.map((targetRow) => {
    let picked = scenarioData[0];
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const point of scenarioData) {
      const distance = Math.abs(point.price - targetRow.target);
      if (!used.has(point.price) && distance < closestDistance) {
        picked = point;
        closestDistance = distance;
      }
    }
    used.add(picked.price);

    return {
      label: targetRow.label,
      test_price: picked.price,
      expected_sales: round2(picked.expected_demand),
      unit_profit: round2(picked.unit_profit),
      total_profit: round2(picked.total_profit),
      risk_level: targetRow.risk_level,
    };
  });
}

export async function listOptimizationMarketplaces() {
  const marketplaces = (await getMarketplaces()).filter((marketplace) =>
    DEFAULT_MARKETPLACE_SEQUENCE.includes((marketplace.slug ?? "") as (typeof DEFAULT_MARKETPLACE_SEQUENCE)[number])
  );

  return marketplaces.sort((a, b) => {
    const aIndex = DEFAULT_MARKETPLACE_SEQUENCE.indexOf((a.slug ?? "") as (typeof DEFAULT_MARKETPLACE_SEQUENCE)[number]);
    const bIndex = DEFAULT_MARKETPLACE_SEQUENCE.indexOf((b.slug ?? "") as (typeof DEFAULT_MARKETPLACE_SEQUENCE)[number]);
    return aIndex - bIndex;
  });
}

export async function getOptimizationBootstrap(productId?: number, marketplaceId?: number) {
  const products = await getProducts();
  const marketplaces = await listOptimizationMarketplaces();

  if (products.length === 0 || marketplaces.length === 0) {
    return null;
  }

  const selectedProduct = products.find((product) => product.id === (productId ?? products[0].id)) ?? products[0];
  const defaultCostRow = await getCurrentCostResultByProduct(selectedProduct.id) ?? null;
  const selectedMarketplace =
    marketplaces.find((marketplace) => marketplace.id === (marketplaceId ?? defaultCostRow?.marketplace_id ?? marketplaces[0].id)) ??
    marketplaces[0];

  const selectedCostRow = await getCurrentCostResult(selectedProduct.id, selectedMarketplace.id) ?? defaultCostRow;
  const currentPrice = Number(selectedCostRow?.list_price ?? selectedProduct.sale_price ?? 0);
  const currentUnitCost = Number(selectedCostRow?.total_unit_cost ?? Math.max(selectedProduct.cost + selectedProduct.packaging_cost, 0));
  const defaultElasticity = resolveDefaultElasticity(selectedProduct);
  const currentSalesVolume = await resolveHistoricalSalesVolume(selectedProduct.id, selectedMarketplace.id);
  const stock = resolveHistoricalStock(currentSalesVolume);
  const minPrice = round2(Math.max(1, Math.min(currentPrice * 0.75, currentUnitCost * 1.05)));
  const maxPrice = round2(Math.max(minPrice + 20, currentPrice * 1.35, currentUnitCost * 1.8));

  return {
    products,
    marketplaces,
    defaults: {
      productId: selectedProduct.id,
      marketplaceId: selectedMarketplace.id,
      minPrice,
      maxPrice,
      currentSalesVolume,
      stock,
      elasticityEstimate: defaultElasticity,
    },
    currentPrice,
    currentUnitCost,
  };
}

export async function buildSynchronizedOptimizationPreview(productId?: number, marketplaceId?: number) {
  const initialBootstrap = await getOptimizationBootstrap(productId, marketplaceId);
  if (!initialBootstrap) {
    return null;
  }

  await recalculateCostResultsForProduct(initialBootstrap.defaults.productId);

  const refreshedBootstrap = await getOptimizationBootstrap(initialBootstrap.defaults.productId, initialBootstrap.defaults.marketplaceId);
  if (!refreshedBootstrap) {
    return null;
  }

  const result = await runPriceOptimizationFromBootstrap(refreshedBootstrap.defaults, refreshedBootstrap);
  if (!result) {
    return null;
  }

  return {
    bootstrap: refreshedBootstrap,
    result,
  };
}

export async function buildSynchronizedOptimizationAnalysis(input: PriceOptimizationInput) {
  const initialBootstrap = await getOptimizationBootstrap(input.productId, input.marketplaceId);
  if (!initialBootstrap) {
    return null;
  }

  await recalculateCostResultsForProduct(initialBootstrap.defaults.productId);

  const refreshedBootstrap = await getOptimizationBootstrap(initialBootstrap.defaults.productId, initialBootstrap.defaults.marketplaceId);
  if (!refreshedBootstrap) {
    return null;
  }

  const result = await runPriceOptimizationFromBootstrap(input, refreshedBootstrap);
  if (!result) {
    return null;
  }

  return {
    bootstrap: refreshedBootstrap,
    result,
  };
}

type OptimizationBootstrap = NonNullable<Awaited<ReturnType<typeof getOptimizationBootstrap>>>;

async function runPriceOptimizationFromBootstrap(
  input: PriceOptimizationInput,
  bootstrap: OptimizationBootstrap
): Promise<PriceOptimizationResult | null> {
  const product = bootstrap.products.find((item) => item.id === input.productId) ?? null;
  const marketplace = bootstrap.marketplaces.find((item) => item.id === input.marketplaceId) ?? null;
  if (!product || !marketplace) {
    return null;
  }

  const currentCostRow = await getCurrentCostResult(product.id, marketplace.id);
  const productSetting = await getProductMarketplaceSetting(product.id, marketplace.id);
  const currentPrice = Number(bootstrap.currentPrice ?? product.sale_price ?? 0);
  const currentEconomics = await getPricePointEconomics(product, marketplace, currentPrice, currentCostRow, productSetting);
  const baseDemand = Math.max(1, await resolveHistoricalSalesVolume(product.id, marketplace.id));
  const stock = Math.max(0, Number(input.stock ?? 0) > 0 ? Number(input.stock) : resolveHistoricalStock(baseDemand));
  const minPrice = round2(Math.max(1, Number(input.minPrice ?? 0)));
  const maxPrice = round2(Math.max(minPrice + 1, Number(input.maxPrice ?? 0)));
  const defaultElasticity = resolveDefaultElasticity(product);
  const elasticityEstimate = safeNegative(
    input.elasticityEstimate === null || input.elasticityEstimate === undefined || Number.isNaN(Number(input.elasticityEstimate))
      ? defaultElasticity
      : Number(input.elasticityEstimate)
  );
  const defaultElasticityUsed = input.elasticityEstimate === null || input.elasticityEstimate === undefined || Number.isNaN(Number(input.elasticityEstimate));
  const confidenceScore = resolveConfidenceScore(
    { ...input, minPrice, maxPrice, currentSalesVolume: baseDemand, stock, elasticityEstimate },
    defaultElasticityUsed
  );

  // Q(P) = Q0 * (P / P0)^E
  // Grid search drives the candidate prices through the elasticity model.
  const priceGrid = linspace(minPrice, maxPrice, PRICE_GRID_POINT_COUNT);
  const scenario_data = await Promise.all(priceGrid.map(async (price) => {
    const safeCurrentPrice = Math.max(0.01, currentPrice);
    const demandRaw = baseDemand * Math.pow(price / safeCurrentPrice, elasticityEstimate);
    const expectedDemand = round2(stock > 0 ? clampNumber(demandRaw, 0, stock) : 0);
    const economics = await getPricePointEconomics(product, marketplace, price, currentCostRow, productSetting);
    const unitProfit = economics.unitProfitAfterVat;
    const totalProfit = round2(unitProfit * expectedDemand);
    const revenue = round2(price * expectedDemand);

    return {
      price,
      expected_demand: expectedDemand,
      unit_profit: unitProfit,
      total_profit: totalProfit,
      revenue,
      is_optimum: false,
      total_unit_cost: economics.totalUnitCost,
      commission_cost: economics.commissionCost,
      estimated_vat_payable: economics.estimatedVatPayable,
    };
  }));

  const recommendedPoint = scenario_data.reduce((best, current) => {
    if (current.total_profit > best.total_profit) return current;
    if (current.total_profit === best.total_profit && Math.abs(current.price - currentPrice) < Math.abs(best.price - currentPrice)) {
      return current;
    }
    return best;
  });

  const scenarioData = scenario_data.map((point) => ({
    ...point,
    is_optimum: point.price === recommendedPoint.price,
  }));

  const currentDemandRaw = baseDemand * Math.pow(Math.max(currentPrice, 0.01) / Math.max(currentPrice, 0.01), elasticityEstimate);
  const currentDemand = round2(stock > 0 ? clampNumber(currentDemandRaw, 0, stock) : 0);
  const currentUnitProfit = currentEconomics.unitProfitAfterVat;
  const currentProfit = round2(currentUnitProfit * currentDemand);
  const currentPoint = {
    ...getCurrentPoint(currentPrice, currentEconomics.totalUnitCost, currentDemand),
    unit_profit: currentUnitProfit,
    total_profit: currentProfit,
    total_unit_cost: currentEconomics.totalUnitCost,
    commission_cost: currentEconomics.commissionCost,
    estimated_vat_payable: currentEconomics.estimatedVatPayable,
  };
  const recommendedProfit = round2(recommendedPoint.total_profit);
  const demandChangePercent = currentDemand > 0 ? round2(((recommendedPoint.expected_demand - currentDemand) / currentDemand) * 100) : null;
  const profitChangePercent = currentProfit !== 0 ? round2(((recommendedProfit - currentProfit) / Math.abs(currentProfit)) * 100) : null;

  const scenario_table = buildScenarioRows(scenarioData);

  return {
    product_id: product.id,
    marketplace_id: marketplace.id,
    product,
    marketplace,
    current_price: round2(currentPrice),
    recommended_price: round2(recommendedPoint.price),
    min_price_limit: minPrice,
    max_price_limit: maxPrice,
    expected_demand_current: currentDemand,
    expected_demand_recommended: round2(recommendedPoint.expected_demand),
    expected_profit_current: currentProfit,
    expected_profit_recommended: recommendedProfit,
    current_unit_cost: round2(currentEconomics.totalUnitCost),
    current_unit_profit: currentUnitProfit,
    current_commission_cost: currentEconomics.commissionCost,
    current_estimated_vat_payable: currentEconomics.estimatedVatPayable,
    current_sales_volume: round2(baseDemand),
    stock: round2(stock),
    elasticity_estimate: elasticityEstimate,
    confidence_score: confidenceScore,
    profit_change_percent: profitChangePercent,
    demand_change_percent: demandChangePercent,
    current_point: currentPoint,
    recommended_point: {
      ...recommendedPoint,
      is_optimum: true,
    },
    recommended_commission_cost: Number(recommendedPoint.commission_cost ?? 0),
    recommended_estimated_vat_payable: Number(recommendedPoint.estimated_vat_payable ?? 0),
    scenario_data: scenarioData,
    scenario_table,
    generated_at: new Date().toISOString(),
  };
}

export async function runPriceOptimization(input: PriceOptimizationInput): Promise<PriceOptimizationResult | null> {
  const bootstrap = await getOptimizationBootstrap(input.productId, input.marketplaceId);
  if (!bootstrap) {
    return null;
  }

  return await runPriceOptimizationFromBootstrap(input, bootstrap);
}

export async function savePriceOptimizationRun(result: PriceOptimizationResult) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const runId = result.run_id ?? randomUUID();
  const status: PriceOptimizationRunStatus = result.run_status ?? "DRAFT";
  const publishedAt = status === "PUBLISHED" ? new Date().toISOString() : null;
  await db.prepare(`
    INSERT INTO price_optimization_runs (
      run_id,
      product_id,
      marketplace_id,
      current_price,
      recommended_price,
      min_price_limit,
      max_price_limit,
      expected_demand_current,
      expected_demand_recommended,
      expected_profit_current,
      expected_profit_recommended,
      elasticity_estimate,
      confidence_score,
      status,
      stock,
      current_sales_volume,
      published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    result.product_id,
    result.marketplace_id,
    result.current_price,
    result.recommended_price,
    result.min_price_limit,
    result.max_price_limit,
    result.expected_demand_current,
    result.expected_demand_recommended,
    result.expected_profit_current,
    result.expected_profit_recommended,
    result.elasticity_estimate,
    result.confidence_score,
    status,
    result.stock,
    result.current_sales_volume,
    publishedAt
  );

  return runId;
}

export async function getPriceOptimizationRun(runId: string) {
  return await getOne<PriceOptimizationRunRecord>(`
    SELECT
      run_id,
      product_id,
      marketplace_id,
      current_price,
      recommended_price,
      min_price_limit,
      max_price_limit,
      expected_demand_current,
      expected_demand_recommended,
      expected_profit_current,
      expected_profit_recommended,
      elasticity_estimate,
      confidence_score,
      UPPER(COALESCE(status, 'DRAFT')) AS status,
      COALESCE(stock, 0) AS stock,
      COALESCE(current_sales_volume, 0) AS current_sales_volume,
      created_at,
      published_at
    FROM price_optimization_runs
    WHERE run_id = ?
    LIMIT 1
  `, [runId]);
}

export async function markPriceOptimizationRunPublished(runId: string) {
  const db = getDb();
  if (!db) {
    return false;
  }

  const publishedAt = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE price_optimization_runs
    SET status = 'PUBLISHED',
        published_at = COALESCE(published_at, ?)
    WHERE run_id = ?
  `).run(publishedAt, runId);

  return result.changes > 0;
}
