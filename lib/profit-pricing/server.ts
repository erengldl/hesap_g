import "server-only";

import { randomUUID } from "node:crypto";

import {
  getCommissionForCategory,
  getMarketplaces,
  getOwnWebsiteGatewayRule,
  getPaymentGatewayRuleById,
  getPlatformFeeRulesByMarketplaceId,
  getProductSnapshot,
  getProductMarketplaceSetting,
  getProfitPricingProductOptions,
  getSellerProfileById,
  getStoreExpenseMonthlyTotal,
} from "@/lib/database-readers";
import { getDb, getOne, query } from "@/lib/db";
import { getProductSalesVelocity } from "@/lib/product-history";
import { buildReturnRiskContextForProduct } from "@/lib/return-risk/repository";
import type { Marketplace, Product } from "@/lib/types";

import { buildChannelComparison } from "./channel-comparison";
import { calculateProfitPricing } from "./orchestrator";
import type {
  DataQuality,
  ProfitDecision,
  ProfitPricingBootstrap,
  ProfitPricingBootstrapProduct,
  ProfitPricingChannelProfile,
  ProfitPricingInput,
  SalesChannel,
} from "./types";
import {
  applyEditableProfitPricingOverrides,
  channelLabel,
  isSupportedSalesChannel,
  mapSalesChannelToMarketplaceSlug,
  roundCurrency,
  toFiniteNumber,
} from "./utils";

type PlatformFeeRuleRow = {
  fee_type: "fixed" | "percent";
  fee_value_net: number | null;
  fee_value_gross: number | null;
  fee_rate_percent_net: number | null;
  fee_rate_percent_gross: number | null;
  vat_rate_percent: number | null;
  shipment_type: string | null;
};

type ShippingRateRow = {
  marketplace_id: number;
  shipping_company_id: number;
  desi_min: number;
  desi_max: number;
  price: number;
};

type CategoryTaxRow = {
  tax_rate: number;
};

type CategoryParentRow = {
  parent_id: number | null;
};

type ProfitPricingRunRow = {
  run_id: string;
  product_id: number;
  channel: SalesChannel;
  marketplace_id: number | null;
  note: string | null;
  input_json: string;
  result_json: string;
  decision: ProfitDecision;
  data_quality: DataQuality;
  recommended_min: number | null;
  recommended_max: number | null;
  recommended_preferred: number | null;
  applied_at: string | null;
  applied_old_price: number | null;
  applied_new_price: number | null;
  created_at: string;
};

type ProfitPricingRunSummary = {
  runId: string;
  productId: string;
  productName: string;
  channel: SalesChannel;
  decision: ProfitDecision;
  dataQuality: DataQuality;
  recommendedPreferred: number | null;
  createdAt: string;
  appliedAt: string | null;
};

type ProfitPricingProductOption = {
  id: number;
  name: string;
  sku?: string;
  active_channels: string[];
};

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function resolveDefaultElasticity(categoryPath?: string, categoryName?: string) {
  const text = `${categoryPath ?? ""} ${categoryName ?? ""}`.toLowerCase();

  if (/(kozmetik|parfüm|parfum|cilt|guzellik|güzellik|makyaj)/.test(text)) {
    return -2.3;
  }

  if (/(giyim|ayakkabi|ayakkabı|canta|çanta|taki|takı|aksesuar|elbise)/.test(text)) {
    return -1.9;
  }

  if (/(elektronik|telefon|bilgisayar|kulaklik|kulaklık|tablet)/.test(text)) {
    return -1.4;
  }

  if (/(ev|yasam|yaşam|mutfak|dekor|aydinlatma|aydınlatma)/.test(text)) {
    return -1.6;
  }

  return -1.7;
}

async function resolveCategoryVatRate(categoryId: number | undefined) {
  if (!categoryId) {
    return 0;
  }

  const visited = new Set<number>();
  let currentCategoryId: number | null = categoryId;

  while (currentCategoryId && !visited.has(currentCategoryId)) {
    visited.add(currentCategoryId);

    const directRule = await getOne<CategoryTaxRow>(
      "SELECT tax_rate FROM category_tax_rules WHERE category_id = ? LIMIT 1",
      [currentCategoryId]
    );

    if (directRule) {
      return roundCurrency(toFiniteNumber(directRule.tax_rate, 0) / 100);
    }

    const parentRow: CategoryParentRow | null = await getOne<CategoryParentRow>(
      "SELECT parent_id FROM categories WHERE category_id = ? LIMIT 1",
      [currentCategoryId]
    );
    currentCategoryId = parentRow?.parent_id ?? null;
  }

  return 0;
}

async function resolveShippingCost(params: {
  marketplaceId: number;
  shippingCompanyId?: number | null;
  desi: number;
}) {
  const shippingRates = await query<ShippingRateRow>(
    `
      SELECT marketplace_id, shipping_company_id, desi_min, desi_max, price
      FROM shipping_rate_rules
      WHERE marketplace_id = ?
      ORDER BY price ASC
    `,
    [params.marketplaceId]
  );
  const roundedDesi = Math.max(0, Math.ceil(params.desi));
  const matchingRates = shippingRates.filter(
    (rate) => roundedDesi >= rate.desi_min && roundedDesi <= rate.desi_max
  );

  if (params.shippingCompanyId) {
    const exact = matchingRates.find((rate) => rate.shipping_company_id === params.shippingCompanyId);
    if (exact) {
      return roundCurrency(exact.price);
    }
  }

  return roundCurrency(matchingRates[0]?.price ?? 0);
}

async function resolvePlatformFeeConfig(marketplaceId: number, shipmentType?: string | null) {
  const rules = await getPlatformFeeRulesByMarketplaceId(marketplaceId) as PlatformFeeRuleRow[];
  const relevant = rules.filter((rule) => {
    if (shipmentType === "fast") {
      return rule.shipment_type === "fast" || rule.shipment_type === null;
    }

    return rule.shipment_type === null || rule.shipment_type === "normal";
  });

  return relevant.reduce(
    (accumulator, rule) => {
      const vatRate = toFiniteNumber(rule.vat_rate_percent, 0);
      if (rule.fee_type === "fixed") {
        const fixedValue =
          rule.fee_value_net ??
          (rule.fee_value_gross !== null && vatRate > 0
            ? rule.fee_value_gross / (1 + vatRate / 100)
            : rule.fee_value_gross ?? 0);
        accumulator.fixed += toFiniteNumber(fixedValue, 0);
      } else {
        const percentValue =
          rule.fee_rate_percent_net ??
          (rule.fee_rate_percent_gross !== null && vatRate > 0
            ? rule.fee_rate_percent_gross / (1 + vatRate / 100)
            : rule.fee_rate_percent_gross ?? 0);
        accumulator.rate += toFiniteNumber(percentValue, 0) / 100;
      }

      return accumulator;
    },
    { fixed: 0, rate: 0 }
  );
}

async function resolveFixedCostShare(
  productId: number,
  profileId: number | undefined,
  recentMonthlyOrders?: number
) {
  const sellerProfile = await getSellerProfileById(profileId ?? 1) as
    | {
        expected_monthly_order_count?: number | null;
      }
    | null;
  const safeRecentMonthlyOrders =
    recentMonthlyOrders !== undefined
      ? Math.max(1, Math.round(recentMonthlyOrders))
      : Math.max(1, Math.round((await getProductSalesVelocity(productId, 30)) * 30));
  const expectedOrders = Math.max(
    1,
    Number(sellerProfile?.expected_monthly_order_count ?? 0) || safeRecentMonthlyOrders
  );

  return roundCurrency((await getStoreExpenseMonthlyTotal(profileId ?? 1)) / expectedOrders);
}

async function resolveIncomeTaxRate(profileId: number | undefined) {
  const sellerProfile = await getSellerProfileById(profileId ?? 1) as
    | {
        tax_bracket?: number | null;
      }
    | null;

  return roundCurrency(toFiniteNumber(sellerProfile?.tax_bracket, 20) / 100);
}

function resolveAutomaticReturnRate(context: ProfitPricingInput["returnRiskContext"]) {
  const productRate = context?.stats?.product;
  if (productRate && productRate.orderCount > 0) {
    return roundCurrency(productRate.returnRate);
  }

  const categoryRate = context?.stats?.category;
  if (categoryRate && categoryRate.orderCount > 0) {
    return roundCurrency(categoryRate.returnRate);
  }

  const channelRate = context?.stats?.channel;
  if (channelRate && channelRate.orderCount > 0) {
    return roundCurrency(channelRate.returnRate);
  }

  const globalRate = context?.stats?.global;
  if (globalRate && globalRate.orderCount > 0) {
    return roundCurrency(globalRate.returnRate);
  }

  return 0;
}

async function buildChannelProfile(params: {
  product: Product;
  channel: SalesChannel;
  marketplacesBySlug: Map<string, Marketplace>;
  fixedCostShare: number;
  incomeTaxRate: number;
  vatRate: number;
  ownWebsiteGateway: Awaited<ReturnType<typeof getOwnWebsiteGatewayRule>>;
  resolveBaseDemand: (marketplaceId: number) => Promise<number>;
}): Promise<ProfitPricingChannelProfile | null> {
  const marketplaceSlug = mapSalesChannelToMarketplaceSlug(params.channel);
  const marketplace = params.marketplacesBySlug.get(marketplaceSlug);
  if (!marketplace) {
    return null;
  }

  const productSetting = await getProductMarketplaceSetting(params.product.id, marketplace.id);
  const commissionRule =
    params.channel === "website"
      ? null
      : await getCommissionForCategory(marketplace.name, params.product.category_id ?? 0);
  const platformFeeConfig =
    params.channel === "website"
      ? { fixed: 0, rate: 0 }
      : await resolvePlatformFeeConfig(marketplace.id, productSetting?.shipping_mode);

  const websiteGateway =
    params.channel === "website"
      ? productSetting?.payment_gateway_rule_id
        ? await getPaymentGatewayRuleById(productSetting.payment_gateway_rule_id)
        : params.ownWebsiteGateway
      : null;

  const salePrice = roundCurrency(
    toFiniteNumber(productSetting?.sale_price, params.product.sale_price || params.product.cost)
  );
  const shippingCost =
    params.channel === "website"
      ? roundCurrency(
          toFiniteNumber(
            productSetting?.manual_shipping_cost,
            toFiniteNumber(websiteGateway?.manual_shipping_cost, 0)
          )
        )
      : await resolveShippingCost({
          marketplaceId: marketplace.id,
          shippingCompanyId: productSetting?.shipping_company_id ?? null,
          desi: params.product.desi,
        });
  const returnRiskContext = await buildReturnRiskContextForProduct({
    productId: params.product.id,
    channel: params.channel,
  });

  const input: ProfitPricingInput = {
    productId: String(params.product.id),
    productName: params.product.name,
    channel: params.channel,
    salePrice,
    buyboxPrice:
      productSetting?.buybox_price != null && Number.isFinite(productSetting.buybox_price)
        ? Number(productSetting.buybox_price)
        : undefined,
    productCost: roundCurrency(params.product.cost),
    packagingCost: roundCurrency(params.product.packaging_cost),
    shippingCost,
    commissionRate:
      params.channel === "website"
        ? 0
        : roundCurrency(toFiniteNumber(commissionRule?.commissionRate, 0) / 100),
    platformFee: roundCurrency(platformFeeConfig.fixed + salePrice * platformFeeConfig.rate),
    adCostPerOrder:
      params.channel === "website"
        ? roundCurrency(
            toFiniteNumber(productSetting?.traffic_cpa, toFiniteNumber(websiteGateway?.avg_ad_cost, 0))
          )
        : 0,
    returnRate: resolveAutomaticReturnRate(returnRiskContext),
    returnCostPerOrder: roundCurrency(shippingCost + roundCurrency(params.product.packaging_cost)),
    returnRiskContext,
    fixedCostShare: params.fixedCostShare,
    vatRate: params.vatRate,
    withholdingRate: 0.01,
    incomeTaxRate: params.incomeTaxRate,
    targetMargin: 0.15,
    baseDemand: await params.resolveBaseDemand(marketplace.id),
    basePrice: salePrice,
    demandElasticity: resolveDefaultElasticity(params.product.category_path, params.product.category_name),
    stockLimit: params.product.stock,
    dataSource: "product",
  };

  return {
    channel: params.channel,
    label: channelLabel(params.channel),
    input,
    marketplaceId: marketplace.id,
    marketplaceSlug: marketplace.slug,
  };
}

async function buildChannelProfiles(product: Product) {
  const marketplacesBySlug = new Map(
    (await getMarketplaces()).map((marketplace) => [marketplace.slug, marketplace] as const)
  );
  const ownWebsiteGateway = await getOwnWebsiteGatewayRule();
  const recentMonthlyOrders = roundCurrency(await getProductSalesVelocity(product.id, 30) * 30);
  const fixedCostShare = await resolveFixedCostShare(product.id, product.profile_id, recentMonthlyOrders);
  const incomeTaxRate = await resolveIncomeTaxRate(product.profile_id);
  const vatRate = await resolveCategoryVatRate(product.category_id);
  const baseDemandCache = new Map<number, number>();
  const resolveBaseDemand = async (marketplaceId: number) => {
    const cached = baseDemandCache.get(marketplaceId);
    if (cached !== undefined) {
      return cached;
    }

    const value = roundCurrency(await getProductSalesVelocity(product.id, 30, marketplaceId) * 30);
    baseDemandCache.set(marketplaceId, value);
    return value;
  };

  const profiles = await Promise.all(
    (["trendyol", "hepsiburada", "website"] as const).map((channel) =>
      buildChannelProfile({
        product,
        channel,
        marketplacesBySlug,
        fixedCostShare,
        incomeTaxRate,
        vatRate,
        ownWebsiteGateway,
        resolveBaseDemand,
      })
    )
  );

  return profiles.filter((profile): profile is ProfitPricingChannelProfile => profile !== null);
}

function normalizeIncomingInput(
  partialInput: Partial<ProfitPricingInput>,
  baseInput: ProfitPricingInput
): ProfitPricingInput {
  return {
    ...applyEditableProfitPricingOverrides(baseInput, partialInput),
    channel: isSupportedSalesChannel(String(partialInput.channel))
      ? (partialInput.channel as SalesChannel)
      : baseInput.channel,
    productId: partialInput.productId ? String(partialInput.productId) : baseInput.productId,
    productName: partialInput.productName ?? baseInput.productName,
  };
}

function resolveDefaultChannel(product: ProfitPricingProductOption | null, requestedChannel?: string) {
  if (requestedChannel && isSupportedSalesChannel(requestedChannel)) {
    return requestedChannel;
  }

  const active = product?.active_channels.find((channel) => {
    if (channel === "my_website") return true;
    return channel === "trendyol" || channel === "hepsiburada";
  });

  if (active === "my_website") {
    return "website";
  }

  if (active === "trendyol" || active === "hepsiburada") {
    return active;
  }

  return "trendyol";
}

export async function buildProfitPricingBootstrap(params?: {
  productId?: number;
  channel?: string;
}): Promise<ProfitPricingBootstrap> {
  const productOptionsSource = await getProfitPricingProductOptions();
  const selectedProductOption =
    productOptionsSource.find((product) => product.id === params?.productId) ?? productOptionsSource[0];

  if (!selectedProductOption) {
    const fallbackInput: ProfitPricingInput = {
      channel: "trendyol",
      salePrice: 0,
      productCost: 0,
      dataSource: "product",
    };
    const fallbackResult = calculateProfitPricing(fallbackInput);

    return {
      products: [],
      channelProfiles: [],
      initialInput: fallbackInput,
      initialResult: fallbackResult,
    };
  }

  const selectedProduct = await getProductSnapshot(selectedProductOption.id);
  if (!selectedProduct) {
    const fallbackInput: ProfitPricingInput = {
      channel: "trendyol",
      salePrice: 0,
      productCost: 0,
      dataSource: "product",
    };
    const fallbackResult = calculateProfitPricing(fallbackInput);

    return {
      products: productOptionsSource.map((product) => ({
        id: String(product.id),
        label: product.name,
        sku: product.sku,
        channels: product.active_channels
          .map((channel) => (channel === "my_website" ? "website" : channel))
          .filter((channel): channel is SalesChannel => isSupportedSalesChannel(channel)),
      })),
      channelProfiles: [],
      initialInput: fallbackInput,
      initialResult: fallbackResult,
    };
  }

  const channelProfiles = await buildChannelProfiles(selectedProduct);
  const selectedChannel = resolveDefaultChannel(selectedProductOption, params?.channel);
  const selectedProfile = channelProfiles.find((profile) => profile.channel === selectedChannel) ?? channelProfiles[0];
  const initialInput = selectedProfile?.input ?? {
    channel: selectedChannel,
    salePrice: selectedProduct.sale_price,
    productCost: selectedProduct.cost,
    packagingCost: selectedProduct.packaging_cost,
    dataSource: "product",
  };
  const initialResult = calculateProfitPricing(initialInput);
  initialResult.channelComparison = buildChannelComparison(initialResult.input, channelProfiles);
  const productOptions: ProfitPricingBootstrapProduct[] = productOptionsSource.map((product) => ({
    id: String(product.id),
    label: product.name,
    sku: product.sku,
    channels: product.active_channels
      .map((channel) => (channel === "my_website" ? "website" : channel))
      .filter((channel): channel is SalesChannel => isSupportedSalesChannel(channel)),
  }));

  return {
    products: productOptions,
    channelProfiles,
    initialInput,
    initialResult,
  };
}

export async function resolveProfitPricingRequest(
  partialInput: Partial<ProfitPricingInput> & { productId?: string | number; channel?: string }
) {
  const requestedProductId = Number(partialInput.productId ?? 0);
  const bootstrap = await buildProfitPricingBootstrap({
    productId: Number.isFinite(requestedProductId) && requestedProductId > 0 ? requestedProductId : undefined,
    channel: partialInput.channel,
  });

  const requestedChannel = partialInput.channel;
  const selectedChannel = requestedChannel && isSupportedSalesChannel(requestedChannel)
    ? requestedChannel
    : bootstrap.initialInput.channel;
  const selectedProfile =
    bootstrap.channelProfiles.find((profile) => profile.channel === selectedChannel) ??
    bootstrap.channelProfiles[0];
  const mergedInput = normalizeIncomingInput(partialInput, selectedProfile?.input ?? bootstrap.initialInput);
  const result = calculateProfitPricing(mergedInput);
  result.channelComparison = buildChannelComparison(result.input, bootstrap.channelProfiles);

  return {
    channelProfiles: bootstrap.channelProfiles,
    input: mergedInput,
    result,
  };
}

export async function listProfitPricingRuns(limit = 8, productId?: number) {
  const rows = await query<
    ProfitPricingRunRow & {
      product_name: string | null;
    }
  >(
    `
      SELECT
        r.run_id,
        r.product_id,
        r.channel,
        r.marketplace_id,
        r.note,
        r.input_json,
        r.result_json,
        r.decision,
        r.data_quality,
        r.recommended_min,
        r.recommended_max,
        r.recommended_preferred,
        r.applied_at,
        r.applied_old_price,
        r.applied_new_price,
        r.created_at,
        p.name AS product_name
      FROM profit_pricing_runs r
      LEFT JOIN products p ON p.product_id = r.product_id
      ${productId ? "WHERE r.product_id = ?" : ""}
      ORDER BY r.created_at DESC, r.run_id DESC
      LIMIT ${Math.max(1, Math.min(limit, 25))}
    `,
    productId ? [productId] : []
  );

  return rows.map<ProfitPricingRunSummary>((row) => ({
    runId: row.run_id,
    productId: String(row.product_id),
    productName: row.product_name ?? "Bilinmeyen Ürün",
    channel: row.channel,
    decision: row.decision,
    dataQuality: row.data_quality,
    recommendedPreferred: row.recommended_preferred,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
  }));
}

export async function saveProfitPricingRun(payload: {
  input: Partial<ProfitPricingInput>;
  note?: string;
}) {
  const db = getDb();
  if (!db) {
    throw new Error("Veritabanı bağlantısı kurulamadı.");
  }

  const resolved = await resolveProfitPricingRequest(payload.input);
  const runId = randomUUID();
  const productId = Number(resolved.result.input.productId ?? 0);
  const marketplaceId =
    resolved.channelProfiles.find((profile) => profile.channel === resolved.result.input.channel)?.marketplaceId ?? null;

  await db.prepare(
    `
      INSERT INTO profit_pricing_runs (
        run_id,
        product_id,
        channel,
        marketplace_id,
        note,
        input_json,
        result_json,
        decision,
        data_quality,
        recommended_min,
        recommended_max,
        recommended_preferred
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    runId,
    productId,
    resolved.result.input.channel,
    marketplaceId,
    payload.note ?? null,
    JSON.stringify(resolved.result.input),
    JSON.stringify(resolved.result),
    resolved.result.decision,
    resolved.result.dataQuality,
    resolved.result.recommendedPriceRange?.min ?? null,
    resolved.result.recommendedPriceRange?.max ?? null,
    resolved.result.recommendedPriceRange?.preferred ?? null
  );

  return {
    runId,
    result: resolved.result,
  };
}

async function getProfitPricingRun(runId: string) {
  return await getOne<ProfitPricingRunRow>(
    `
      SELECT
        run_id,
        product_id,
        channel,
        marketplace_id,
        note,
        input_json,
        result_json,
        decision,
        data_quality,
        recommended_min,
        recommended_max,
        recommended_preferred,
        applied_at,
        applied_old_price,
        applied_new_price,
        created_at
      FROM profit_pricing_runs
      WHERE run_id = ?
      LIMIT 1
    `,
    [runId]
  );
}

export async function applyProfitPricingRun(payload: {
  runId: string;
  confirmed: boolean;
  price?: number;
}) {
  if (!payload.confirmed) {
    throw new Error("Fiyat uygulama işlemi için açık onay gerekli.");
  }

  const db = getDb();
  if (!db) {
    throw new Error("Veritabanı bağlantısı kurulamadı.");
  }

  const run = await getProfitPricingRun(payload.runId);
  if (!run) {
    throw new Error("Kayıt bulunamadı.");
  }

  const storedInput = parseJson<ProfitPricingInput>(run.input_json);
  if (!storedInput) {
    throw new Error("Kayıt girdisi okunamadı.");
  }

  const resolved = await resolveProfitPricingRequest(storedInput);
  const allowedScenarioPrices = new Set(
    resolved.result.priceScenarios.map((scenario) => roundCurrency(scenario.price))
  );
  if (resolved.result.recommendedPriceRange) {
    allowedScenarioPrices.add(roundCurrency(resolved.result.recommendedPriceRange.preferred));
  }

  const targetPrice = roundCurrency(
    payload.price ?? resolved.result.recommendedPriceRange?.preferred ?? resolved.result.input.salePrice
  );
  if (!allowedScenarioPrices.has(targetPrice)) {
    throw new Error("Uygulanacak fiyat mevcut senaryolar içinde doğrulanamadı.");
  }

  const marketplaceSlug = mapSalesChannelToMarketplaceSlug(resolved.result.input.channel);
  const marketplace = (await getMarketplaces()).find((item) => item.slug === marketplaceSlug);
  if (!marketplace) {
    throw new Error("Kanal ayarı bulunamadı.");
  }

  const productId = Number(resolved.result.input.productId ?? run.product_id);
  const currentSetting = await getProductMarketplaceSetting(productId, marketplace.id);
  const oldPrice = roundCurrency(toFiniteNumber(currentSetting?.sale_price, 0));

  await db.transaction(async () => {
    await db.prepare(
      `
        UPDATE product_marketplace_settings
        SET sale_price = ?
        WHERE product_id = ? AND marketplace_id = ?
      `
    ).run(targetPrice, productId, marketplace.id);

    await db.prepare(
      `
        UPDATE profit_pricing_runs
        SET applied_at = CURRENT_TIMESTAMP,
            applied_old_price = ?,
            applied_new_price = ?,
            result_json = ?
        WHERE run_id = ?
      `
    ).run(oldPrice, targetPrice, JSON.stringify(resolved.result), payload.runId);

    await db.prepare(
      `
        INSERT INTO audit_logs (
          report_id,
          organization_id,
          user_id,
          action,
          entity_type,
          entity_id,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      null,
      1,
      null,
      "profit_pricing.apply_price",
      "product_marketplace_setting",
      `${productId}:${marketplace.id}`,
      JSON.stringify({
        channel: resolved.result.input.channel,
        old_price: oldPrice,
        new_price: targetPrice,
        run_id: payload.runId,
      })
    );
  });

  return {
    oldPrice,
    newPrice: targetPrice,
    result: (() => {
      const result = calculateProfitPricing(resolved.result.input);
      result.channelComparison = buildChannelComparison(result.input, resolved.channelProfiles);
      return result;
    })(),
  };
}

export async function buildServerSideChannelComparison(input: Partial<ProfitPricingInput>) {
  const resolved = await resolveProfitPricingRequest(input);
  return buildChannelComparison(resolved.result.input, resolved.channelProfiles);
}
