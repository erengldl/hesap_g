import { getDb, getOne, query } from "./db";
import {
  getCarriersByMarketplace,
  getMarketplaceById,
  getOwnWebsiteGatewayRule,
  getProductMarketplaceSetting,
} from "./database-readers";
import { predictNetCostSignals } from "./net-cost-ml";
import type { NetCostMlInput } from "./net-cost-ml";
import type { ChannelCostResult } from "./types";

type ProductMarketplaceSettingRow = {
  setting_id: number;
  product_id: number;
  marketplace_id: number;
  shipping_company_id: number | null;
  sale_price: number | null;
  manual_shipping_cost: number | null;
  payment_gateway_rule_id: number | null;
  shipping_mode: string | null;
  traffic_cpa: number | null;
  marketplace_name?: string | null;
  marketplace_slug?: string | null;
};

type HistoricalCostRow = {
  product_id: number;
  marketplace_id: number;
  shipping_company_id: number | null;
  list_price: number | null;
  net_profit: number | null;
  calculated_at: string | null;
  category_id: number | null;
  category_path: string | null;
  desi: number | null;
  cost: number | null;
  packaging_cost: number | null;
};

type ProductRow = {
  id: number;
  category_id: number | null;
  category_path: string | null;
  desi: number | null;
  cost: number | null;
  packaging_cost: number | null;
  sale_price: number | null;
  profile_id: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMarketplaceDefaultCarrierId(marketplaceId: number) {
  const row = getOne<{ shipping_company_id: number | null }>(
    "SELECT shipping_company_id FROM marketplace_shipping_options WHERE marketplace_id = ? ORDER BY shipping_company_id ASC LIMIT 1",
    [marketplaceId]
  );
  return row?.shipping_company_id ?? null;
}

function getCarrierIdByName(marketplaceName: string, carrierName?: string | null) {
  if (!carrierName) return null;
  const carrier = getCarriersByMarketplace(marketplaceName).find((item) => item.name === carrierName);
  return carrier?.shipping_company_id ?? null;
}

function getProductContext(productId: number) {
  return getOne<ProductRow>(
    `
      SELECT
        p.product_id AS id,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.desi,
        p.cost,
        p.packaging_cost,
        NULL AS sale_price,
        p.profile_id
      FROM products p
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE p.product_id = ?
      LIMIT 1
    `,
    [productId]
  );
}

function getHistoricalCostRows(productId: number, marketplaceId: number) {
  return query<HistoricalCostRow>(
    `
      SELECT
        cr.product_id,
        cr.marketplace_id,
        cr.shipping_company_id,
        cr.list_price,
        cr.net_profit,
        cr.calculated_at,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.desi,
        p.cost,
        p.packaging_cost
      FROM cost_results cr
      JOIN products p ON p.product_id = cr.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE cr.marketplace_id = ?
        AND cr.shipping_company_id IS NOT NULL
        AND cr.product_id <> ?
      ORDER BY cr.calculated_at DESC, cr.id DESC
      LIMIT 300
    `,
    [marketplaceId, productId]
  );
}

function resolveHistoricalWeight(target: ProductRow, row: HistoricalCostRow) {
  const targetDesi = safeNumber(target.desi, 0);
  const targetCost = safeNumber(target.cost, 0) + safeNumber(target.packaging_cost, 0);
  const rowCost = safeNumber(row.cost, 0) + safeNumber(row.packaging_cost, 0);
  const rowDesi = safeNumber(row.desi, 0);

  const categorySimilarity = row.category_id && target.category_id
    ? row.category_id === target.category_id
      ? 1.9
      : String(row.category_path ?? "").split(" > ")[0] === String(target.category_path ?? "").split(" > ")[0]
        ? 1.25
        : 0.9
    : 1;

  const desiSimilarity = 1 / (1 + Math.abs(rowDesi - targetDesi));
  const costSimilarity = 1 / (1 + Math.abs(rowCost - targetCost) / Math.max(1, targetCost));
  const ageDays = row.calculated_at ? Math.max(0, (Date.now() - new Date(row.calculated_at).getTime()) / 86_400_000) : 365;
  const recency = 1 / (1 + ageDays / 30);
  const profitSignal = safeNumber(row.net_profit, 0) > 0
    ? 1 + Math.min(1, safeNumber(row.net_profit, 0) / Math.max(1, safeNumber(row.list_price, 1)))
    : 0.45;

  return round2(categorySimilarity * desiSimilarity * costSimilarity * recency * profitSignal);
}

function recommendMarketplaceCarrierId(productId: number, marketplaceId: number, product: ProductRow) {
  const historicalRows = getHistoricalCostRows(productId, marketplaceId);
  if (historicalRows.length === 0) {
    return getMarketplaceDefaultCarrierId(marketplaceId);
  }

  const scoreMap = new Map<number, number>();

  for (const row of historicalRows) {
    if (!row.shipping_company_id) continue;
    const weight = resolveHistoricalWeight(product, row);
    scoreMap.set(row.shipping_company_id, (scoreMap.get(row.shipping_company_id) ?? 0) + weight);
  }

  if (scoreMap.size === 0) {
    return getMarketplaceDefaultCarrierId(marketplaceId);
  }

  return [...scoreMap.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? getMarketplaceDefaultCarrierId(marketplaceId);
}

function buildFallbackProductSetting(product: ProductRow, marketplaceId: number): ProductMarketplaceSettingRow {
  const marketplace = getMarketplaceById(marketplaceId);
  const salePrice = round2(safeNumber(product.sale_price, 0) > 0 ? safeNumber(product.sale_price, 0) : Math.max((safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0)) * 1.95, 0));
  const isOwnWebsite = marketplace?.slug === "own_website";
  const gateway = isOwnWebsite ? getOwnWebsiteGatewayRule() : null;
  const recommendedCarrierId = isOwnWebsite ? null : recommendMarketplaceCarrierId(product.id, marketplaceId, product);
  const mlProduct: NetCostMlInput["product"] = {
    id: product.id,
    category_id: product.category_id ?? undefined,
    category_name: undefined,
    category_path: product.category_path ?? undefined,
    profile_id: product.profile_id ?? undefined,
    cost: Number(product.cost ?? 0),
    packaging_cost: Number(product.packaging_cost ?? 0),
    desi: Number(product.desi ?? 0),
  };
  const mlSignals = isOwnWebsite
    ? predictNetCostSignals({
        product: mlProduct,
        marketplaceId,
        salePrice,
        baseShippingCost: round2(safeNumber(gateway?.manual_shipping_cost, 95)),
        shippingCompanyId: null,
        channelType: "own_website",
        currentTrafficCpa: round2(safeNumber(gateway?.avg_ad_cost, 56.2)),
      })
    : null;

  return {
    setting_id: 0,
    product_id: product.id,
    marketplace_id: marketplaceId,
    shipping_company_id: recommendedCarrierId,
    sale_price: salePrice,
    manual_shipping_cost: isOwnWebsite ? round2(safeNumber(gateway?.manual_shipping_cost, 95)) : null,
    payment_gateway_rule_id: isOwnWebsite ? gateway?.id ?? null : null,
    shipping_mode: isOwnWebsite ? "manual" : "marketplace_rate",
    traffic_cpa: isOwnWebsite ? mlSignals?.ml_predicted_cpa ?? round2(safeNumber(gateway?.avg_ad_cost, 56.2)) : null,
    marketplace_name: marketplace?.name ?? null,
    marketplace_slug: marketplace?.slug ?? null,
  };
}

export function resolveProductMarketplaceDefaults(productId: number, marketplaceId: number) {
  const persisted = getProductMarketplaceSetting(productId, marketplaceId);
  const product = getProductContext(productId);
  if (!product) {
    return persisted ? (persisted as ProductMarketplaceSettingRow) : null;
  }

  const fallback = buildFallbackProductSetting(product, marketplaceId);
  if (!persisted) {
    return fallback;
  }

  return {
    ...fallback,
    ...persisted,
    shipping_company_id: persisted.shipping_company_id ?? fallback.shipping_company_id,
    sale_price: Number(persisted.sale_price ?? 0) > 0 ? persisted.sale_price : fallback.sale_price,
    manual_shipping_cost: Number(persisted.manual_shipping_cost ?? 0) > 0 ? persisted.manual_shipping_cost : fallback.manual_shipping_cost,
    payment_gateway_rule_id: persisted.payment_gateway_rule_id ?? fallback.payment_gateway_rule_id,
    shipping_mode: persisted.shipping_mode ?? fallback.shipping_mode,
    traffic_cpa: Number(persisted.traffic_cpa ?? 0) > 0 ? persisted.traffic_cpa : fallback.traffic_cpa,
  } as ProductMarketplaceSettingRow;
}

function readChannelInput(body: Record<string, unknown>, channelKey: string) {
  const channels = body.channels as Record<string, unknown> | undefined;
  if (channels && typeof channels === "object") {
    const channel = channels[channelKey] as Record<string, unknown> | undefined;
    if (channel && typeof channel === "object") {
      return channel;
    }
  }

  if (channelKey === "trendyol" || channelKey === "hepsiburada" || channelKey === "my_website") {
    return body;
  }

  return null;
}

function upsertSetting(
  db: NonNullable<ReturnType<typeof getDb>>,
  productId: number,
  marketplaceId: number,
  values: {
    shippingCompanyId: number | null;
    salePrice: number;
    manualShippingCost: number | null;
    paymentGatewayRuleId: number | null;
    shippingMode: string | null;
    trafficCpa: number | null;
  }
) {
  db.prepare(`
    INSERT INTO product_marketplace_settings (
      product_id,
      marketplace_id,
      shipping_company_id,
      sale_price,
      manual_shipping_cost,
      payment_gateway_rule_id,
      shipping_mode,
      traffic_cpa
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id, marketplace_id) DO UPDATE SET
      shipping_company_id = excluded.shipping_company_id,
      sale_price = excluded.sale_price,
      manual_shipping_cost = excluded.manual_shipping_cost,
      payment_gateway_rule_id = excluded.payment_gateway_rule_id,
      shipping_mode = excluded.shipping_mode,
      traffic_cpa = excluded.traffic_cpa
  `).run(
    productId,
    marketplaceId,
    values.shippingCompanyId,
    values.salePrice,
    values.manualShippingCost,
    values.paymentGatewayRuleId,
    values.shippingMode,
    values.trafficCpa
  );
}

export function persistNetCostDefaultsFromCalculation(
  productId: number,
  body: Record<string, unknown>,
  results: ChannelCostResult[]
) {
  const db = getDb();
  if (!db) {
    return false;
  }

  const product = getProductContext(productId);
  if (!product) {
    return false;
  }

  const byMarketplaceId = new Map(results.map((result) => [Number(result.marketplace_id ?? 0), result]));
  const trendyolResult = byMarketplaceId.get(1) ?? null;
  const hepsiburadaResult = byMarketplaceId.get(2) ?? null;
  const websiteResult = byMarketplaceId.get(3) ?? null;

  const trendyolInput = readChannelInput(body, "trendyol");
  const hepsiburadaInput = readChannelInput(body, "hepsiburada");
  const websiteInput = readChannelInput(body, "my_website");

  db.transaction(() => {
    if (trendyolResult) {
      upsertSetting(db, productId, 1, {
        shippingCompanyId: trendyolResult.shipping_company_id ?? null,
        salePrice: round2(Number(trendyolResult.sale_price ?? trendyolInput?.salePrice ?? trendyolInput?.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: null,
        paymentGatewayRuleId: null,
        shippingMode: trendyolResult.shipping_mode ?? String(trendyolInput?.shipmentType ?? "normal"),
        trafficCpa: null,
      });
    }

    if (hepsiburadaResult) {
      upsertSetting(db, productId, 2, {
        shippingCompanyId: hepsiburadaResult.shipping_company_id ?? null,
        salePrice: round2(Number(hepsiburadaResult.sale_price ?? hepsiburadaInput?.salePrice ?? hepsiburadaInput?.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: null,
        paymentGatewayRuleId: null,
        shippingMode: hepsiburadaResult.shipping_mode ?? null,
        trafficCpa: null,
      });
    }

    if (websiteResult) {
      const trafficSettings = websiteInput?.trafficSettings as { manualCpa?: number; mode?: string } | undefined;
      const ownWebsiteGateway = getOwnWebsiteGatewayRule();
      const fallbackGatewayRuleId = Number(websiteInput?.gatewayRuleId ?? websiteInput?.payment_gateway_rule_id ?? null) || null;
      upsertSetting(db, productId, 3, {
        shippingCompanyId: null,
        salePrice: round2(Number(websiteResult.sale_price ?? websiteInput?.salePrice ?? websiteInput?.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: round2(Number(websiteResult.manual_shipping_cost ?? websiteInput?.shippingCost ?? websiteInput?.manual_shipping_cost ?? 0)),
        paymentGatewayRuleId: websiteResult.payment_gateway_rule_id ?? ownWebsiteGateway?.id ?? fallbackGatewayRuleId,
        shippingMode: websiteResult.shipping_mode ?? "manual",
        trafficCpa: round2(Number(trafficSettings?.manualCpa ?? websiteInput?.cpa ?? websiteInput?.manualCpa ?? websiteResult.ml_predicted_cpa ?? websiteResult.traffic_ad_cost ?? 0)),
      });
    }
  })();

  return true;
}

export function persistNetCostDefaultsFromForm(productId: number, body: Record<string, unknown>) {
  const db = getDb();
  if (!db) {
    return false;
  }

  const product = getProductContext(productId);
  if (!product) {
    return false;
  }

  const trendyolInput = readChannelInput(body, "trendyol");
  const hepsiburadaInput = readChannelInput(body, "hepsiburada");
  const websiteInput = readChannelInput(body, "my_website");

  const trendyolActive = trendyolInput?.active !== false;
  const hepsiburadaActive = hepsiburadaInput?.active !== false;
  const websiteActive = websiteInput?.active !== false;

  db.transaction(() => {
    if (trendyolActive && trendyolInput) {
      upsertSetting(db, productId, 1, {
        shippingCompanyId: getCarrierIdByName("Trendyol", String(trendyolInput.carrierName ?? "")),
        salePrice: round2(Number(trendyolInput.salePrice ?? trendyolInput.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: null,
        paymentGatewayRuleId: null,
        shippingMode: String(trendyolInput.shipmentType ?? trendyolInput.shippingMode ?? "normal"),
        trafficCpa: null,
      });
    }

    if (hepsiburadaActive && hepsiburadaInput) {
      upsertSetting(db, productId, 2, {
        shippingCompanyId: getCarrierIdByName("Hepsiburada", String(hepsiburadaInput.carrierName ?? "")),
        salePrice: round2(Number(hepsiburadaInput.salePrice ?? hepsiburadaInput.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: null,
        paymentGatewayRuleId: null,
        shippingMode: String(hepsiburadaInput.shipmentType ?? hepsiburadaInput.shippingMode ?? "marketplace_rate"),
        trafficCpa: null,
      });
    }

    if (websiteActive && websiteInput) {
      const trafficSettings = websiteInput.trafficSettings as { manualCpa?: number; mode?: string } | undefined;
      const ownWebsiteGateway = getOwnWebsiteGatewayRule();
      const fallbackGatewayRuleId = Number(websiteInput.gatewayRuleId ?? websiteInput.payment_gateway_rule_id ?? null) || null;
      upsertSetting(db, productId, 3, {
        shippingCompanyId: null,
        salePrice: round2(Number(websiteInput.salePrice ?? websiteInput.sale_price ?? product.sale_price ?? 0)),
        manualShippingCost: round2(Number(websiteInput.shippingCost ?? websiteInput.manualShippingCost ?? websiteInput.manual_shipping_cost ?? ownWebsiteGateway?.manual_shipping_cost ?? 0)),
        paymentGatewayRuleId: fallbackGatewayRuleId ?? ownWebsiteGateway?.id ?? null,
        shippingMode: String(websiteInput.shippingMode ?? "manual"),
        trafficCpa: round2(Number(trafficSettings?.manualCpa ?? websiteInput.cpa ?? websiteInput.manualCpa ?? 0)),
      });
    }
  })();

  return true;
}
