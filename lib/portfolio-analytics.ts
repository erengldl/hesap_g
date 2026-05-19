import { getDb, getOne, query } from "./db";
import { getCommissionForCategory, getDefaultProductId, getOwnWebsiteGatewayRule, getStoreExpenseMonthlyTotal } from "./database-readers";
import { buildDemandForecast as buildDemandForecastEngine } from "./demand-forecast";
import { recalculateAllCostResultsFromDatabase, recalculateCostResultsForProfileFromDatabase, recalculateCostResultsForProductFromDatabase } from "./cost-engine";
import { getProductSalesVelocity } from "./product-history";
import type { AdMetrics, ChannelCostResult, Product } from "./types";

type ProductRow = {
  id: number;
  name: string;
  category_id: number | null;
  profile_id: number | null;
  category_name: string | null;
  category_path: string | null;
  cost: number | null;
  packaging_cost: number | null;
  desi: number | null;
  status: string | null;
};

type MarketplaceRow = {
  marketplace_id: number;
  name: string;
  slug: string | null;
};

type ProductSettingRow = {
  setting_id: number;
  product_id: number;
  marketplace_id: number;
  shipping_company_id: number | null;
  sale_price: number | null;
  manual_shipping_cost: number | null;
  payment_gateway_rule_id: number | null;
  shipping_mode: string | null;
  marketplace_name?: string | null;
  marketplace_slug?: string | null;
};

type SellerProfileRow = {
  profile_id: number;
  company_type: string;
  monthly_employee_cost: number | null;
  monthly_warehouse_cost: number | null;
  monthly_invoice_accounting_cost: number | null;
  monthly_other_expenses: number | null;
  expected_monthly_order_count: number | null;
};

type ShippingCompanyRow = {
  shipping_company_id: number;
  name: string;
};

type PlatformFeeRow = {
  marketplace_id: number;
  fee_type: string;
  fee_value_net: number | null;
  fee_value_gross: number | null;
  fee_rate_percent_net: number | null;
  fee_rate_percent_gross: number | null;
  shipment_type: string | null;
  is_active: number | null;
};

type ProductContext = {
  product: ProductRow;
  productModel: Product;
  sellerProfile: SellerProfileRow;
  websiteGateway: {
    id: number;
    marketplace_id: number;
    gateway_name: string;
    fee_rate_percent: number | null;
    fixed_fee_per_order: number | null;
    vat_rate_percent: number | null;
    fee_values_include_vat: number | null;
    manual_shipping_cost: number | null;
    avg_ad_cost: number | null;
    avg_conversion_rate: number | null;
  } | null;
  settings: ProductSettingRow[];
};

const DEFAULT_SELLER_PROFILE: SellerProfileRow = {
  profile_id: 1,
  company_type: "Şahıs Şirketi",
  monthly_employee_cost: 0,
  monthly_warehouse_cost: 3000,
  monthly_invoice_accounting_cost: 1000,
  monthly_other_expenses: 1000,
  expected_monthly_order_count: 500,
};

const DEFAULT_WEBSITE_GATEWAY = {
  id: 1,
  marketplace_id: 3,
  gateway_name: "Kullanıcı Tanımlı Ödeme Altyapısı",
  fee_rate_percent: 3.49,
  fixed_fee_per_order: 0.25,
  vat_rate_percent: 20,
  fee_values_include_vat: 1,
  manual_shipping_cost: 95,
  avg_ad_cost: 56.2,
  avg_conversion_rate: 2.6,
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeChannelSlug(slug: string | null | undefined) {
  if (!slug) return null;
  if (slug === "own_website" || slug === "own-website" || slug === "website") {
    return "my_website";
  }
  return slug;
}

function toProductModel(row: ProductRow, salePrice: number, activeChannels: string[]): Product {
  return {
    id: row.id,
    name: row.name,
    profile_id: row.profile_id ?? undefined,
    category_id: row.category_id ?? undefined,
    category_name: row.category_name ?? undefined,
    category_path: row.category_path ?? row.category_name ?? undefined,
    cost: Number(row.cost ?? 0),
    packaging_cost: Number(row.packaging_cost ?? 0),
    desi: Number(row.desi ?? 0),
    sale_price: salePrice,
    active_channels: activeChannels,
    status: row.status ?? (activeChannels.length > 0 ? "active" : "draft"),
    status_label:
      row.status === "passive"
        ? "Pasif"
        : row.status === "draft"
          ? "Taslak"
          : "Aktif",
  };
}

function getMarketplaceById(marketplaceId: number) {
  return getOne<MarketplaceRow>("SELECT marketplace_id, name, slug FROM marketplaces WHERE marketplace_id = ? LIMIT 1", [marketplaceId]);
}

function getMarketplaceShippingCompanyId(marketplaceId: number) {
  const row = getOne<{ shipping_company_id: number }>(
    "SELECT shipping_company_id FROM marketplace_shipping_options WHERE marketplace_id = ? ORDER BY shipping_company_id ASC LIMIT 1",
    [marketplaceId]
  );
  return row?.shipping_company_id ?? null;
}

function getShippingCompanyName(shippingCompanyId: number | null) {
  if (!shippingCompanyId) return null;
  const row = getOne<ShippingCompanyRow>(
    "SELECT shipping_company_id, name FROM shipping_companies WHERE shipping_company_id = ? LIMIT 1",
    [shippingCompanyId]
  );
  return row?.name ?? null;
}

function getProductContext(productId?: number): ProductContext | null {
  const resolvedProductId = productId ?? getDefaultProductId();
  if (!resolvedProductId) return null;

  const product = getOne<ProductRow>(`
    SELECT
      p.product_id AS id,
      p.name,
      p.category_id,
      p.profile_id,
      c.name AS category_name,
      COALESCE(p.category_path, c.path) AS category_path,
      p.cost,
      p.packaging_cost,
      p.desi,
      p.status
    FROM products p
    LEFT JOIN categories c ON c.category_id = p.category_id
    WHERE p.product_id = ?
    LIMIT 1
  `, [resolvedProductId]);

  if (!product) return null;

  const rawSettings = query<ProductSettingRow>(`
    SELECT
      ms.setting_id,
      ms.product_id,
      ms.marketplace_id,
      ms.shipping_company_id,
      ms.sale_price,
      ms.manual_shipping_cost,
      ms.payment_gateway_rule_id,
      ms.shipping_mode,
      m.name AS marketplace_name,
      m.slug AS marketplace_slug
    FROM product_marketplace_settings ms
    LEFT JOIN marketplaces m ON m.marketplace_id = ms.marketplace_id
    WHERE ms.product_id = ?
    ORDER BY ms.marketplace_id ASC
  `, [resolvedProductId]);

  const sellerProfile = getOne<SellerProfileRow>(`
    SELECT
      profile_id,
      company_type,
      monthly_employee_cost,
      monthly_warehouse_cost,
      monthly_invoice_accounting_cost,
      monthly_other_expenses,
      expected_monthly_order_count
    FROM seller_profiles
    WHERE profile_id = ?
    LIMIT 1
  `, [product.profile_id ?? 1]) ?? DEFAULT_SELLER_PROFILE;

  const websiteGateway = getOwnWebsiteGatewayRule() ?? DEFAULT_WEBSITE_GATEWAY;

  let settings = rawSettings;
  if (settings.length === 0) {
    const fallbackSalePrice = round2(Math.max((Number(product.cost ?? 0) + Number(product.packaging_cost ?? 0)) * 1.95, Number(product.cost ?? 0) * 1.8 + 150));
    settings = [
      {
        setting_id: 0,
        product_id: product.id,
        marketplace_id: 1,
        shipping_company_id: getMarketplaceShippingCompanyId(1),
        sale_price: fallbackSalePrice,
        manual_shipping_cost: null,
        payment_gateway_rule_id: null,
        shipping_mode: "marketplace_rate",
        marketplace_name: "Trendyol",
        marketplace_slug: "trendyol",
      },
      {
        setting_id: 0,
        product_id: product.id,
        marketplace_id: 2,
        shipping_company_id: getMarketplaceShippingCompanyId(2),
        sale_price: fallbackSalePrice,
        manual_shipping_cost: null,
        payment_gateway_rule_id: null,
        shipping_mode: "marketplace_rate",
        marketplace_name: "Hepsiburada",
        marketplace_slug: "hepsiburada",
      },
      {
        setting_id: 0,
        product_id: product.id,
        marketplace_id: 3,
        shipping_company_id: null,
        sale_price: fallbackSalePrice,
        manual_shipping_cost: websiteGateway.manual_shipping_cost ?? DEFAULT_WEBSITE_GATEWAY.manual_shipping_cost,
        payment_gateway_rule_id: websiteGateway.id,
        shipping_mode: "manual",
        marketplace_name: "Kendi Websitem",
        marketplace_slug: "own_website",
      },
    ];
  }

  return {
    product,
    productModel: toProductModel(
      product,
      Number(settings.find((item) => normalizeChannelSlug(item.marketplace_slug) === "my_website")?.sale_price ?? settings[0]?.sale_price ?? product.cost ?? 0),
      settings
        .map((item) => normalizeChannelSlug(item.marketplace_slug))
        .filter((item): item is string => Boolean(item))
    ),
    sellerProfile,
    websiteGateway,
    settings,
  };
}

function resolveRecentMonthlyOrders(productId: number, fallbackOrders: number) {
  const historyOrders = Math.round(getProductSalesVelocity(productId, 30) * 30);
  return Math.max(1, historyOrders || fallbackOrders);
}

function getSellerFixedCostPerUnit(productId: number, profileId: number, sellerProfile: SellerProfileRow) {
  const totalFixedCost = getStoreExpenseMonthlyTotal(profileId);
  const orders = resolveRecentMonthlyOrders(productId, Number(sellerProfile.expected_monthly_order_count ?? 1));
  return round2(totalFixedCost / orders);
}

function getDefaultShippingCost(product: ProductRow, context: ProductContext, setting: ProductSettingRow) {
  const marketplaceSlug = setting.marketplace_slug ?? "";
  if (marketplaceSlug === "own_website") {
    return round2(Number(setting.manual_shipping_cost ?? context.websiteGateway?.manual_shipping_cost ?? DEFAULT_WEBSITE_GATEWAY.manual_shipping_cost));
  }

  const shippingCompanyId = setting.shipping_company_id ?? getMarketplaceShippingCompanyId(setting.marketplace_id);
  if (!shippingCompanyId) {
    return round2(Number(setting.manual_shipping_cost ?? context.websiteGateway?.manual_shipping_cost ?? DEFAULT_WEBSITE_GATEWAY.manual_shipping_cost));
  }

  const shippingRate = getOne<{ price: number }>(
    `SELECT price
     FROM shipping_rate_rules
     WHERE marketplace_id = ? AND shipping_company_id = ? AND ? BETWEEN desi_min AND desi_max
     ORDER BY desi_min DESC
     LIMIT 1`,
    [setting.marketplace_id, shippingCompanyId, Number(product.desi ?? 0)]
  );

  if (shippingRate) {
    return round2(Number(shippingRate.price));
  }

  return round2(Number(setting.manual_shipping_cost ?? context.websiteGateway?.manual_shipping_cost ?? DEFAULT_WEBSITE_GATEWAY.manual_shipping_cost));
}

function getPlatformFeeCost(marketplaceId: number, salePrice: number, shippingMode: string | null) {
  const feeRows = query<PlatformFeeRow>(
    `SELECT marketplace_id, fee_type, fee_value_net, fee_value_gross, fee_rate_percent_net, fee_rate_percent_gross, shipment_type, is_active
     FROM platform_fee_rules
     WHERE marketplace_id = ? AND is_active = 1`,
    [marketplaceId]
  );

  const relevantRows = feeRows.filter((row) => {
    if (shippingMode === "fast") return row.shipment_type === "fast" || row.shipment_type === null;
    return row.shipment_type === null || row.shipment_type === "normal";
  });

  return round2(
    relevantRows.reduce((sum, row) => {
      if (row.fee_type === "fixed") {
        return sum + Number(row.fee_value_gross ?? row.fee_value_net ?? 0);
      }

      if (row.fee_type === "percent") {
        const rate = Number(row.fee_rate_percent_gross ?? row.fee_rate_percent_net ?? 0);
        return sum + salePrice * (rate / 100);
      }

      return sum;
    }, 0)
  );
}

function getCommissionCost(marketplaceName: string, categoryId: number | null, salePrice: number) {
  if (!categoryId) {
    const fallbackRate = 15;
    return {
      rate: fallbackRate,
      cost: round2(salePrice * (fallbackRate / 100)),
      warning: "Kategori bulunamadığı için genel komisyon oranı kullanıldı.",
      matchType: "fallback",
    };
  }

  const commission = getCommissionForCategory(marketplaceName, categoryId);
  const rate = Number(commission?.commissionRate ?? 0);
  return {
    rate,
    cost: round2(salePrice * (rate / 100)),
    warning: commission?.warning ?? null,
    matchType: commission?.matchType ?? "direct",
  };
}

export function calculateChannelCosts(context: ProductContext) {
    const unitFixedCost = getSellerFixedCostPerUnit(context.product.id, context.product.profile_id ?? 1, context.sellerProfile);
  const results: Array<ChannelCostResult & {
    marketplace_id: number;
    marketplace_slug: string;
    shipping_company_id: number | null;
    shipping_company_name: string | null;
    payment_gateway_rule_id: number | null;
    shipping_mode: string;
    manual_shipping_cost: number | null;
    warning_notes: string | null;
  }> = [];

  for (const setting of context.settings) {
    const marketplace = getMarketplaceById(setting.marketplace_id);
    if (!marketplace) continue;

    const salePrice = round2(Number(setting.sale_price ?? 0));
    const marketplaceSlug = setting.marketplace_slug ?? marketplace.slug ?? "";
    const isOwnWebsite = marketplaceSlug === "own_website" || marketplace.name === "Kendi Websitem";
    const shippingMode = setting.shipping_mode ?? (isOwnWebsite ? "manual" : "marketplace_rate");
    const shippingCompanyId = isOwnWebsite ? null : (setting.shipping_company_id ?? getMarketplaceShippingCompanyId(setting.marketplace_id));
    const shippingCompanyName = getShippingCompanyName(shippingCompanyId);
    const shippingCost = getDefaultShippingCost(context.product, context, {
      ...setting,
      marketplace_name: marketplace.name,
      marketplace_slug: marketplaceSlug,
      shipping_company_id: shippingCompanyId,
    });

    const commission = isOwnWebsite
      ? { rate: 0, cost: 0, warning: null, matchType: "manual" }
      : getCommissionCost(marketplace.name, context.product.category_id, salePrice);

    const platformFeeCost = isOwnWebsite
      ? 0
      : getPlatformFeeCost(setting.marketplace_id, salePrice, shippingMode);

    const gatewayRule = isOwnWebsite ? context.websiteGateway : null;
    const baseGatewayCost = salePrice * (Number(gatewayRule?.fee_rate_percent ?? 0) / 100) + Number(gatewayRule?.fixed_fee_per_order ?? 0);
    const paymentGatewayCost = gatewayRule
      ? round2(
        Boolean(gatewayRule.fee_values_include_vat)
          ? baseGatewayCost
          : baseGatewayCost * (1 + Number(gatewayRule.vat_rate_percent ?? 0) / 100)
      )
      : 0;

    const unitAdCost = isOwnWebsite ? round2(Number(gatewayRule?.avg_ad_cost ?? 0)) : 0;
    const unitCost =
      Number(context.product.cost ?? 0) +
      Number(context.product.packaging_cost ?? 0) +
      shippingCost +
      commission.cost +
      platformFeeCost +
      paymentGatewayCost +
      unitAdCost +
      unitFixedCost;

    const netProfit = round2(salePrice - unitCost);
    const profitMarginPercent = salePrice > 0 ? round2((netProfit / salePrice) * 100) : 0;
    const channelName =
      marketplace.name === "Trendyol"
        ? shippingMode === "fast"
          ? "Trendyol Hızlı"
          : "Trendyol Normal"
        : isOwnWebsite
          ? "Kendi Websitem"
          : marketplace.name;

    const warningParts: string[] = [];
    if (commission.warning) warningParts.push(commission.warning);
    if (!shippingCompanyName && !isOwnWebsite) {
      warningParts.push("Kargo şirketi bulunamadı, varsayılan manuel kargo kullanıldı.");
    }

    results.push({
      channel_name: channelName,
      sale_price: salePrice,
      product_cost: Number(context.product.cost ?? 0),
      packaging_cost: Number(context.product.packaging_cost ?? 0),
      shipping_cost: shippingCost,
      commission_cost: commission.cost,
      platform_fee_cost: platformFeeCost,
      payment_gateway_cost: paymentGatewayCost,
      traffic_ad_cost: isOwnWebsite ? unitAdCost : 0,
      unit_ad_cost: isOwnWebsite ? 0 : unitAdCost,
      unit_fixed_cost: unitFixedCost,
      expected_return_cost: 0,
      total_unit_cost: round2(unitCost),
      net_profit: netProfit,
      profit_margin_percent: profitMarginPercent,
      output_vat: 0,
      input_vat: 0,
      estimated_vat_payable: 0,
      is_fallback: warningParts.length > 0,
      marketplace_id: setting.marketplace_id,
      marketplace_slug: marketplaceSlug,
      shipping_company_id: shippingCompanyId,
      shipping_company_name: shippingCompanyName,
      payment_gateway_rule_id: gatewayRule?.id ?? setting.payment_gateway_rule_id ?? null,
      shipping_mode: shippingMode,
      manual_shipping_cost: isOwnWebsite ? round2(Number(setting.manual_shipping_cost ?? gatewayRule?.manual_shipping_cost ?? DEFAULT_WEBSITE_GATEWAY.manual_shipping_cost)) : null,
      warning_notes: warningParts.length > 0 ? warningParts.join(" ") : null,
    });
  }

  return results;
}

export function recalculateCostResultsForProduct(productId?: number) {
  return recalculateCostResultsForProductFromDatabase(productId);
}

export function recalculateAllCostResults() {
  return recalculateAllCostResultsFromDatabase();
}

export function recalculateCostResultsForProfile(profileId: number) {
  return recalculateCostResultsForProfileFromDatabase(profileId);
}

export function getMostProfitableChannel(results: ChannelCostResult[]) {
  if (results.length === 0) return null;
  return results.reduce((best, current) => (current.net_profit > best.net_profit ? current : best));
}

export function buildDashboardSnapshot(productId?: number) {
  const context = getProductContext(productId);
  if (!context) {
    return null;
  }

  const results = calculateChannelCosts(context);
  const bestChannel = getMostProfitableChannel(results);

  if (!bestChannel) {
    return null;
  }

  const costBreakdown = [
    { label: "Ürün", value: Number(bestChannel.product_cost ?? 0) },
    { label: "Paketleme", value: Number(bestChannel.packaging_cost ?? 0) },
    { label: "Kargo", value: Number(bestChannel.shipping_cost ?? 0) },
    { label: "Komisyon", value: Number(bestChannel.commission_cost ?? 0) },
    { label: "Platform", value: Number(bestChannel.platform_fee_cost ?? 0) },
    { label: "Ödeme", value: Number(bestChannel.payment_gateway_cost ?? 0) },
    { label: "Sabit Gider", value: Number(bestChannel.unit_fixed_cost ?? 0) },
    { label: "Reklam", value: Number(bestChannel.unit_ad_cost ?? 0) },
  ].filter((item) => item.value > 0);

  const totalNetProfit = round2(results.reduce((sum, item) => sum + Number(item.net_profit ?? 0), 0));
  const averageMargin = round2(results.reduce((sum, item) => sum + Number(item.profit_margin_percent ?? 0), 0) / Math.max(1, results.length));

  return {
    product: context.productModel,
    results,
    bestChannel,
    bestChannelName: bestChannel.channel_name,
    bestNetProfit: bestChannel.net_profit,
    bestMargin: bestChannel.profit_margin_percent,
    lowestTotalCost: Math.min(...results.map((item) => Number(item.total_unit_cost ?? 0))),
    totalNetProfit,
    averageMargin,
    costBreakdown,
    methodology: "Bu görünüm, products, cost_results, orders ve order_items üzerinden anlık hesaplanan kural tabanlı baz modeli kullanır.",
  };
}

export type DashboardSnapshot = NonNullable<ReturnType<typeof buildDashboardSnapshot>>;

export function buildPriceSimulation(productId?: number) {
  const snapshot = buildDashboardSnapshot(productId);
  if (!snapshot) return null;

  const { product, bestChannel } = snapshot;
  const baseDemand = Math.max(10, Math.round(getProductSalesVelocity(product.id, 30) * 30) || Math.round(Number(product.sale_price ?? 0) / 8) || 10);
  const slope = 0.3;
  const offsets = [-100, -50, 0, 50, 100, 150];

  const scenarios = offsets.map((offset) => {
    const price = round2(Math.max(1, Number(product.sale_price ?? 0) + offset));
    const estimatedDemand = Math.max(5, Math.round(baseDemand + ((Number(product.sale_price ?? 0) - price) * slope)));
    const unitCost = Number(bestChannel.total_unit_cost ?? 0);
    const revenue = round2(price * estimatedDemand);
    const totalCost = round2(unitCost * estimatedDemand);
    const netProfit = round2((price - unitCost) * estimatedDemand);
    const margin = revenue > 0 ? round2((netProfit / revenue) * 100) : 0;

    return {
      price,
      estimated_demand: estimatedDemand,
      revenue,
      total_cost: totalCost,
      net_profit: netProfit,
      profit_margin: margin,
      status: "normal" as const,
    };
  });

  const recommended = scenarios.reduce((best, current) => (current.net_profit > best.net_profit ? current : best));

  return {
    product,
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      status:
        scenario.price === recommended.price
          ? ("recommended" as const)
          : scenario.net_profit < 0
            ? ("loss" as const)
            : scenario.profit_margin < 25
              ? ("low_profit" as const)
              : ("normal" as const),
      profit: round2(scenario.price - Number(bestChannel.total_unit_cost ?? 0)),
      cost: Number(bestChannel.total_unit_cost ?? 0),
    })),
    recommendedPrice: recommended.price,
    expectedMonthlyNetProfit: recommended.net_profit,
    baseUnitCost: Number(bestChannel.total_unit_cost ?? 0),
    baseDemand,
  };
}

export function buildDemandForecast(productId?: number) {
  return buildDemandForecastEngine(productId);
}

export function buildAdAnalysis(productId?: number, snapshot?: DashboardSnapshot | null) {
  const resolvedSnapshot = snapshot ?? buildDashboardSnapshot(productId);
  if (!resolvedSnapshot) return null;

  const websiteGateway = getOwnWebsiteGatewayRule() ?? DEFAULT_WEBSITE_GATEWAY;
  const sales = Math.max(1, Math.round(getProductSalesVelocity(resolvedSnapshot.product.id, 30) * 30) || 1);
  const ctr = 2.5;
  const conversionRate = Number(websiteGateway.avg_conversion_rate ?? 2.6);
  const clicks = Math.max(1, Math.round(sales / (conversionRate / 100)));
  const impressions = Math.max(clicks, Math.round(clicks / 0.025));
  const unitAdCost = Number(websiteGateway.avg_ad_cost ?? DEFAULT_WEBSITE_GATEWAY.avg_ad_cost);
  const spend = round2(unitAdCost * sales);
  const revenue = round2(sales * Number(resolvedSnapshot.product.sale_price ?? 0));
  const roas = spend > 0 ? round2(revenue / spend) : 0;
  const cpc = round2(spend / clicks);
  const cpa = round2(spend / sales);

  const funnelData = [
    { name: "Gösterim", value: impressions, color: "var(--surface-strong)" },
    { name: "Tıklama", value: clicks, color: "var(--border-strong)" },
    { name: "Satış", value: sales, color: "var(--success)" },
  ];

  return {
    product: resolvedSnapshot.product,
    funnelData,
    metrics: {
      spend,
      impressions,
      clicks,
      sales,
      revenue,
      roas,
      cpc,
      cpa,
      ctr,
      conversion_rate: conversionRate,
      unit_ad_cost: unitAdCost,
    } satisfies AdMetrics,
    note: "Bu analiz, ürünün son 30 günlük order_items hareketi ve mevcut reklam maliyeti varsayımlarıyla hesaplanan operasyonel baz modeldir.",
  };
}

// ─── Aggregate Dashboard ────────────────────────────────────────────

type OrderAggregateRow = {
  total_revenue: number;
  total_orders: number;
  total_quantity: number;
  channel_name: string;
  channel_slug: string;
};

type ProductProfitRow = {
  product_id: number;
  product_name: string;
  sku: string;
  total_revenue: number;
  total_orders: number;
  total_quantity: number;
  avg_margin: number;
  cost: number;
  packaging_cost: number;
  sale_price: number;
};

type DailySalesRow = {
  order_date: string;
  total_revenue: number;
  order_count: number;
};

type StockAlertRow = {
  product_id: number;
  product_name: string;
  sku: string;
  stock_qty: number;
  marketplace_name: string;
};

export type AggregateDashboard = {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgMargin: number;
  totalProfit: number;
  channelBreakdown: Array<{ name: string; slug: string; revenue: number; orders: number; pct: number }>;
  topProducts: Array<{ id: number; name: string; sku: string; revenue: number; orders: number; qty: number; margin: number }>;
  salesTrend: Array<{ date: string; revenue: number; orders: number }>;
  stockAlerts: Array<{ id: number; name: string; sku: string; stock: number; channel: string }>;
  methodology: string;
};

export function buildAggregateDashboard(): AggregateDashboard | null {
  const db = getDb();
  if (!db) return null;

  // Total metrics
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(oi.line_total), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as total_orders,
      COUNT(DISTINCT p.product_id) as total_products
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON o.product_id = p.product_id
    WHERE o.status = 'completed'
  `).get() as { total_revenue: number; total_orders: number; total_products: number };

  // Channel breakdown
  const channelRows = db.prepare(`
    SELECT
      m.name as channel_name,
      m.slug as channel_slug,
      COALESCE(SUM(oi.line_total), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as total_orders
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN marketplaces m ON o.marketplace_id = m.marketplace_id
    WHERE o.status = 'completed'
    GROUP BY m.marketplace_id
    ORDER BY total_revenue DESC
  `).all() as OrderAggregateRow[];

  const channelBreakdown = channelRows.map((row) => ({
    name: row.channel_name,
    slug: row.channel_slug,
    revenue: row.total_revenue,
    orders: row.total_orders,
    pct: totals.total_revenue > 0 ? Math.round((row.total_revenue / totals.total_revenue) * 100) : 0,
  }));

  // Top 5 products
  const topProductRows = db.prepare(`
    SELECT
      p.product_id,
      p.name as product_name,
      p.sku,
      COALESCE(SUM(oi.line_total), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as total_orders,
      SUM(oi.quantity) as total_quantity,
      COALESCE(MAX(p.cost), 0) as cost,
      COALESCE(MAX(p.packaging_cost), 0) as packaging_cost,
      COALESCE(MAX(pms.sale_price), 0) as sale_price
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON o.product_id = p.product_id
    LEFT JOIN (
      SELECT product_id, COALESCE(MAX(sale_price), 0) AS sale_price
      FROM product_marketplace_settings
      GROUP BY product_id
    ) pms ON p.product_id = pms.product_id
    WHERE o.status = 'completed'
    GROUP BY p.product_id
    ORDER BY total_revenue DESC
    LIMIT 5
  `).all() as ProductProfitRow[];

  const topProducts = topProductRows.map((row) => {
    const margin = row.sale_price > 0 ? ((row.sale_price - row.cost - row.packaging_cost) / row.sale_price) * 100 : 0;
    return {
      id: row.product_id,
      name: row.product_name,
      sku: row.sku ?? "",
      revenue: row.total_revenue,
      orders: row.total_orders,
      qty: row.total_quantity,
      margin: Math.round(margin * 10) / 10,
    };
  });

  // Last 30 days sales trend
  const trendRows = db.prepare(`
    SELECT
      o.order_date,
      COALESCE(SUM(oi.line_total), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as order_count
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.status = 'completed' AND o.order_date >= date('now', '-30 days')
    GROUP BY o.order_date
    ORDER BY o.order_date
  `).all() as DailySalesRow[];

  const salesTrend = trendRows.map((row) => ({
    date: row.order_date,
    revenue: row.total_revenue,
    orders: row.order_count,
  }));

  // Stock alerts (products with < 20 stock)
  const stockAlertRows = db.prepare(`
    SELECT
      p.product_id,
      p.name as product_name,
      p.sku,
      id.stock_qty,
      m.name as marketplace_name
    FROM inventory_daily id
    JOIN products p ON id.product_id = p.product_id
    JOIN marketplaces m ON id.marketplace_id = m.marketplace_id
    WHERE id.inventory_date = (SELECT MAX(inventory_date) FROM inventory_daily)
      AND id.stock_qty < 20
    ORDER BY id.stock_qty ASC
    LIMIT 10
  `).all() as StockAlertRow[];

  const stockAlerts = stockAlertRows.map((row) => ({
    id: row.product_id,
    name: row.product_name,
    sku: row.sku ?? "",
    stock: row.stock_qty,
    channel: row.marketplace_name,
  }));

  // Estimated total profit (using avg margin)
  const avgMarginFromProducts = db.prepare(`
    SELECT AVG((pms.sale_price - p.cost - p.packaging_cost) / pms.sale_price) * 100 as avg_margin
    FROM products p
    JOIN product_marketplace_settings pms ON p.product_id = pms.product_id
  `).get() as { avg_margin: number } | undefined;

  const avgMargin = Math.round((avgMarginFromProducts?.avg_margin ?? 35) * 10) / 10;
  const totalProfit = Math.round(totals.total_revenue * (avgMargin / 100));

  return {
    totalRevenue: totals.total_revenue,
    totalOrders: totals.total_orders,
    totalProducts: totals.total_products,
    avgMargin,
    totalProfit,
    channelBreakdown,
    topProducts,
    salesTrend,
    stockAlerts,
    methodology: "orders ve order_items tablolarından hesaplanan 30 günlük canlı özet. Demo veride son 90 günlük sentetik akış kullanılır.",
  };
}

// ─── Ad Analysis (from real orders) ─────────────────────────────────

type AdChannelRow = {
  channel_name: string;
  total_revenue: number;
  order_count: number;
};

export type AdAnalysisAggregate = {
  totalSpend: number;
  totalRevenue: number;
  totalNetProfit: number;
  averagePoas: number;
  averageCac: number;
  roas: number;
  lossMakingCount: number;
  channelPerformance: Array<{
    channel: string;
    spend: number;
    revenue: number;
    orders: number;
    poas: number;
    cac: number;
    roas: number;
  }>;
  methodology: string;
};

export function buildAdAnalysisAggregate(): AdAnalysisAggregate | null {
  const db = getDb();
  if (!db) return null;

  // Get own_website gateway rule for ad cost estimation
  const gateway = db.prepare(
    "SELECT avg_ad_cost, avg_conversion_rate FROM payment_gateway_rules WHERE marketplace_id = (SELECT marketplace_id FROM marketplaces WHERE slug='own_website' LIMIT 1) LIMIT 1"
  ).get() as { avg_ad_cost: number; avg_conversion_rate: number } | undefined;

  const unitAdCost = gateway?.avg_ad_cost ?? 35;

  // Channel performance from actual orders
  const channelRows = db.prepare(`
    SELECT
      m.name as channel_name,
      COALESCE(SUM(oi.line_total), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as order_count
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN marketplaces m ON o.marketplace_id = m.marketplace_id
    WHERE o.status = 'completed'
    GROUP BY m.marketplace_id
    ORDER BY total_revenue DESC
  `).all() as AdChannelRow[];

  let totalRevenue = 0;
  let totalOrders = 0;

  const channelPerformance = channelRows.map((row) => {
    const estimatedSpend = Math.round(row.order_count * unitAdCost * 100) / 100;
    const netProfit = Math.round((row.total_revenue - estimatedSpend) * 100) / 100;
    const poas = estimatedSpend > 0 ? Math.round((netProfit / estimatedSpend) * 100) / 100 : 0;
    const cac = row.order_count > 0 ? Math.round((estimatedSpend / row.order_count) * 100) / 100 : 0;
    const roas = estimatedSpend > 0 ? Math.round((row.total_revenue / estimatedSpend) * 100) / 100 : 0;

    totalRevenue += row.total_revenue;
    totalOrders += row.order_count;

    return {
      channel: row.channel_name,
      spend: estimatedSpend,
      revenue: row.total_revenue,
      orders: row.order_count,
      poas,
      cac,
      roas,
    };
  });

  const totalSpend = Math.round(totalOrders * unitAdCost * 100) / 100;
  const totalNetProfit = Math.round((totalRevenue - totalSpend) * 100) / 100;
  const averagePoas = totalSpend > 0 ? Math.round((totalNetProfit / totalSpend) * 100) / 100 : 0;
  const averageCac = totalOrders > 0 ? Math.round((totalSpend / totalOrders) * 100) / 100 : 0;
  const roas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;

  return {
    totalSpend,
    totalRevenue,
    totalNetProfit,
    averagePoas,
    averageCac,
    roas,
    lossMakingCount: channelPerformance.filter((ch) => ch.poas < 0).length,
    channelPerformance,
    methodology: `Gerçek sipariş verisi (${totalOrders} sipariş) üzerinden hesaplanmıştır. Reklam maliyeti olarak birim başına ₺${round2(unitAdCost)} kullanılmıştır.`,
  };
}
