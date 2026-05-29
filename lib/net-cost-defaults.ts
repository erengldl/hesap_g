import { getOne } from "./db";
import {
  getMarketplaceById,
  getOwnWebsiteGatewayRule,
  getProductMarketplaceSetting,
} from "./database-readers";
import type { ChannelCostResult } from "./types";
import { getCachedValue } from "./server-cache";

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

async function getProductContext(productId: number) {
  return await getOne<ProductRow>(
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

/*
async function buildFallbackProductSetting(product: ProductRow, marketplaceId: number): Promise<ProductMarketplaceSettingRow> {
  const marketplace = await getMarketplaceById(marketplaceId);
  const salePrice = round2(safeNumber(product.sale_price, 0) > 0 ? safeNumber(product.sale_price, 0) : Math.max((safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0)) * 1.95, 0));
  const isOwnWebsite = marketplace?.slug === "own_website";
  const gateway = isOwnWebsite ? await getOwnWebsiteGatewayRule() : null;
  const recommendedCarrierId = isOwnWebsite ? null : await recommendMarketplaceCarrierId(product.id, marketplaceId, product);
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
    ? await predictNetCostSignals({
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
*/
export async function resolveProductMarketplaceDefaults(productId: number, marketplaceId: number) {
  const cacheKey = `db:product_marketplace_defaults:${productId}:${marketplaceId}`;
  return getCachedValue(cacheKey, 60_000, async () => {
    const persisted = await getProductMarketplaceSetting(productId, marketplaceId);
    const product = await getProductContext(productId);
    if (!product) {
      return persisted ? (persisted as ProductMarketplaceSettingRow) : null;
    }

    const marketplace = await getMarketplaceById(marketplaceId);
    const salePrice = Number(persisted?.sale_price ?? product.sale_price ?? 0) > 0
      ? Number(persisted?.sale_price ?? product.sale_price ?? 0)
      : Math.max(Number(product.cost ?? 0) + Number(product.packaging_cost ?? 0), 0) * 1.95;

    if (marketplace?.slug === "own_website") {
      const gateway = await getOwnWebsiteGatewayRule();
      const baseShipping = Number(
        persisted?.manual_shipping_cost ??
          gateway?.manual_shipping_cost ??
          0
      );

      return {
        setting_id: persisted?.setting_id ?? 0,
        product_id: productId,
        marketplace_id: marketplaceId,
        shipping_company_id: persisted?.shipping_company_id ?? null,
        sale_price: salePrice,
        manual_shipping_cost: baseShipping,
        payment_gateway_rule_id: persisted?.payment_gateway_rule_id ?? gateway?.id ?? null,
        shipping_mode: persisted?.shipping_mode ?? "manual",
        traffic_cpa: persisted?.traffic_cpa ?? gateway?.avg_ad_cost ?? 0,
        marketplace_name: marketplace?.name ?? null,
        marketplace_slug: marketplace?.slug ?? null,
      };
    }

    return {
      setting_id: persisted?.setting_id ?? 0,
      product_id: productId,
      marketplace_id: marketplaceId,
      shipping_company_id: persisted?.shipping_company_id ?? null,
      sale_price: salePrice,
      manual_shipping_cost: persisted?.manual_shipping_cost ?? null,
      payment_gateway_rule_id: persisted?.payment_gateway_rule_id ?? null,
      shipping_mode: persisted?.shipping_mode ?? "marketplace_rate",
      traffic_cpa: persisted?.traffic_cpa ?? null,
      marketplace_name: marketplace?.name ?? null,
      marketplace_slug: marketplace?.slug ?? null,
    };
  });
}

/*
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

async function upsertSetting(
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
  await db.prepare(`
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
*/

export async function persistNetCostDefaultsFromCalculation(
  productId: number,
  body: Record<string, unknown>,
  results: ChannelCostResult[]
) {
  return Boolean(productId) && results.length >= 0 && typeof body === "object";
}

export async function persistNetCostDefaultsFromForm(productId: number, body: Record<string, unknown>) {
  return Boolean(productId) && typeof body === "object";
}
