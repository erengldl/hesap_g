import { getDb, getOne, query } from "./db";
import {
  getCarriersByMarketplace,
  getCommissionForCategory,
  getMarketplaceBySlug,
  getOwnWebsiteGatewayRule,
  getPaymentGatewayRuleById,
  getPlatformFeeRulesByMarketplaceId,
  getProducts,
  getProductMarketplaceSetting,
  getShippingRates,
  getStoreExpenseMonthlyTotal,
} from "./database-readers";
import { resolveProductMarketplaceDefaults } from "./net-cost-defaults";
import { clearNetCostMlSignalCache, predictNetCostSignals } from "./net-cost-ml";
import { getProductSalesVelocity } from "./product-history";
import { requireCurrentAuthUserId } from "./tenant";
import type { ChannelCostResult, Marketplace, Product } from "./types";

/** Traffic cost calculation mode for "Kendi Websitem" */
export type TrafficCostMode = "manual_cpa" | "budget_per_order" | "cpc_conversion";

export interface WebsiteTrafficSettings {
  mode: TrafficCostMode;
  /** Mode 1: Direct CPA entry */
  manualCpa: number;
  /** Mode 2: Budget / orders */
  monthlyAdBudget: number;
  monthlyAdOrders: number;
  /** Mode 3: CPC / conversion rate */
  averageCpc: number;
  conversionRate: number; // percentage, e.g. 5 for 5%
}

export interface TrafficThreshold {
  vsChannel: string;
  maxTrafficCost: number;
}

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

type SellerProfileRow = {
  profile_id: number;
  company_type: string;
  monthly_employee_cost: number | null;
  monthly_warehouse_cost: number | null;
  monthly_invoice_accounting_cost: number | null;
  monthly_other_expenses: number | null;
  expected_monthly_order_count: number | null;
  tax_bracket: number | null;
};

type IncomeTaxBracketRow = {
  company_type: string;
  year: number;
  income_min: number;
  income_max: number | null;
  base_tax_amount: number;
  marginal_rate_percent: number;
};

type PlatformFeeRow = {
  id: number;
  marketplace_id: number;
  fee_name: string;
  fee_type: "fixed" | "percent";
  fee_value_net: number | null;
  fee_value_gross: number | null;
  fee_rate_percent_net: number | null;
  fee_rate_percent_gross: number | null;
  vat_rate_percent: number | null;
  shipment_type: string | null;
  is_active: number | null;
};

type PaymentGatewayRuleRow = {
  id: number;
  seller_profile_id: number | null;
  marketplace_id: number;
  gateway_name: string;
  fee_rate_percent: number | null;
  fixed_fee_per_order: number | null;
  vat_rate_percent: number | null;
  fee_values_include_vat: number | null;
  manual_shipping_cost: number | null;
  avg_ad_cost: number | null;
  avg_conversion_rate: number | null;
  is_active: number | null;
};

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

type CostCalculationRecord = ChannelCostResult & {
  shipping_mode?: string | null;
  manual_shipping_cost?: number | null;
};

export interface CalculationInput {
  product: Product;
  channels: {
    trendyol: {
      active: boolean;
      salePrice: number;
      carrierName: string;
      shipmentType: "normal" | "fast";
      adCost: number;
      fixedCost: number;
      expectedReturnCost?: number;
    };
    hepsiburada: {
      active: boolean;
      salePrice: number;
      carrierName: string;
      adCost: number;
      fixedCost: number;
      expectedReturnCost?: number;
    };
    my_website: {
      active: boolean;
      salePrice: number;
      shippingCost: number;
      gatewayName: string;
      gatewayRate: number;
      gatewayFixedFee: number;
      adCost: number;
      fixedCost: number;
      trafficSettings?: WebsiteTrafficSettings;
      expectedReturnCost?: number;
    };
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIncomeTaxCompanyType(companyType: string) {
  const normalized = companyType
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/\s+/g, "");

  if (normalized.includes("sahis")) {
    return "Sahis";
  }

  return companyType;
}

async function getIncomeTaxYear() {
  const row = await getOne<{ year: number | null }>("SELECT MAX(year) AS year FROM income_tax_brackets");
  return Number(row?.year ?? new Date().getFullYear());
}

async function resolveRecentMonthlyOrders(productId: number, fallbackOrders = 1) {
  const historyOrders = Math.round((await getProductSalesVelocity(productId, 30)) * 30);
  return Math.max(1, historyOrders || fallbackOrders);
}

async function resolveIncomeTaxPerSale(netProfit: number, sellerProfile: SellerProfileRow, productId: number) {
  const taxableProfit = Math.max(0, round2(netProfit));
  if (taxableProfit <= 0) {
    return {
      perSaleTax: 0,
      annualTax: 0,
      warning: null as string | null,
    };
  }

  const monthlyOrders = await resolveRecentMonthlyOrders(productId, safeNumber(sellerProfile.expected_monthly_order_count, 1));
  const annualOrders = Math.max(1, monthlyOrders * 12);
  const annualIncome = round2(taxableProfit * annualOrders);
  const companyType = normalizeIncomeTaxCompanyType(sellerProfile.company_type);
  const incomeTaxYear = await getIncomeTaxYear();

  const bracket = await getOne<IncomeTaxBracketRow>(
    `
      SELECT
        company_type,
        year,
        income_min,
        income_max,
        base_tax_amount,
        marginal_rate_percent
      FROM income_tax_brackets
      WHERE company_type = ?
        AND year = ?
        AND income_min <= ?
        AND (income_max IS NULL OR income_max > ?)
      ORDER BY income_min DESC
      LIMIT 1
    `,
    [companyType, incomeTaxYear, annualIncome, annualIncome]
  );

  if (bracket) {
    const excessIncome = Math.max(0, annualIncome - safeNumber(bracket.income_min, 0));
    const annualTax = round2(
      safeNumber(bracket.base_tax_amount, 0) + excessIncome * (safeNumber(bracket.marginal_rate_percent, 0) / 100)
    );
    return {
      perSaleTax: round2(annualTax / annualOrders),
      annualTax,
      warning: null as string | null,
    };
  }

  const fallbackRate = safeNumber(sellerProfile.tax_bracket, 20);
  const annualTax = round2(annualIncome * (fallbackRate / 100));
  return {
    perSaleTax: round2(taxableProfit * (fallbackRate / 100)),
    annualTax,
    warning: "Gelir vergisi dilimi bulunamadı; seller profile vergi oranı fallback olarak kullanıldı.",
  };
}

function normalizeMarketplaceSlug(slug: string | null | undefined) {
  if (!slug) return null;

  if (slug === "own_website" || slug === "own-website" || slug === "website") {
    return "own_website";
  }

  return slug;
}

async function resolveMarketplaceByChannelName(channelName: string): Promise<Marketplace | null> {
  if (channelName === "Kendi Websitem") {
    return await getMarketplaceBySlug("own_website");
  }
  if (channelName === "Trendyol") {
    return await getMarketplaceBySlug("trendyol");
  }
  if (channelName === "Hepsiburada") {
    return await getMarketplaceBySlug("hepsiburada");
  }
  return await getMarketplaceBySlug(channelName);
}

async function getShippingCompanyNameById(shippingCompanyId: number | null | undefined) {
  if (!shippingCompanyId) return null;
  const row = await getOne<{ name: string }>(
    "SELECT name FROM shipping_companies WHERE shipping_company_id = ? LIMIT 1",
    [shippingCompanyId]
  );
  return row?.name ?? null;
}

async function getSellerFixedCostPerUnit(productId: number, profileId: number) {
  const authUserId = requireCurrentAuthUserId();
  const profile = await getOne<SellerProfileRow>(
    `
      SELECT
        profile_id,
        company_type,
        monthly_employee_cost,
        monthly_warehouse_cost,
        monthly_invoice_accounting_cost,
        monthly_other_expenses,
        expected_monthly_order_count,
        tax_bracket
      FROM seller_profiles
      WHERE profile_id = ? AND user_id = ?
      LIMIT 1
    `,
    [profileId, authUserId]
  );

  const totalMonthlyFixedCost = await getStoreExpenseMonthlyTotal(profileId);
  const expectedOrders = await resolveRecentMonthlyOrders(productId, Number(profile?.expected_monthly_order_count ?? 1));

  return {
    profile,
    totalMonthlyFixedCost: round2(totalMonthlyFixedCost),
    expectedOrders,
    unitFixedCost: round2(totalMonthlyFixedCost / expectedOrders),
    warning: profile ? null : "Satıcı profili bulunamadı, sabit gider 0 kabul edildi.",
  };
}

async function resolveCategoryVatRate(categoryId: number | null) {
  if (!categoryId) {
    return {
      rate: 0,
      sourceCategoryId: null as number | null,
      warning: "Kategori verisi bulunamadığı için KDV 0% kabul edildi.",
    };
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
      return {
        rate: round2(Number(directRule.tax_rate ?? 0)),
        sourceCategoryId: currentCategoryId,
        warning: null,
      };
    }

    const parentRow: CategoryParentRow | null = await getOne<CategoryParentRow>(
      "SELECT parent_id FROM categories WHERE category_id = ? LIMIT 1",
      [currentCategoryId]
    );
    currentCategoryId = parentRow?.parent_id ?? null;
  }

  return {
    rate: 0,
    sourceCategoryId: null as number | null,
    warning: "Kategori bazlı KDV kuralı bulunamadı; 0% kabul edildi.",
  };
}

async function resolveCommissionCost(marketplaceName: string, categoryId: number | null, salePrice: number) {
  if (!categoryId) {
    return {
      rate: 0,
      cost: 0,
      warning: "Kategori olmadığı için komisyon 0 kabul edildi.",
      matchType: "missing_category",
    };
  }

  const commission = await getCommissionForCategory(marketplaceName, categoryId);
  if (!commission) {
    return {
      rate: 0,
      cost: 0,
      warning: "Komisyon kuralı bulunamadı; 0 kabul edildi.",
      matchType: "missing_rule",
    };
  }

  const rate = round2(Number(commission.commissionRate ?? 0));
  return {
    rate,
    cost: round2(salePrice * (rate / 100)),
    warning: commission.warning ?? null,
    matchType: commission.matchType,
  };
}

async function resolveMarketplaceShippingCost(
  marketplaceName: string,
  desi: number,
  carrierName?: string | null,
  fallbackCarrierId?: number | null
) {
  const marketplace = await resolveMarketplaceByChannelName(marketplaceName);
  if (!marketplace) {
    return {
      shippingCompanyId: null as number | null,
      shippingCompanyName: null as string | null,
      cost: 0,
      warning: "Marketplace bulunamadı; kargo 0 kabul edildi.",
    };
  }

  const roundedDesi = Math.max(0, Math.ceil(Number(desi ?? 0)));
  const allRates = await getShippingRates() as ShippingRateRow[];
  const carriers = await getCarriersByMarketplace(marketplace.name);
  const carrierLookup = new Map(carriers.map((carrier) => [carrier.name, carrier.shipping_company_id]));

  const selectedCarrierId = carrierName ? carrierLookup.get(carrierName) ?? null : fallbackCarrierId ?? null;
  const matchingRates = allRates.filter(
    (rate) =>
      rate.marketplace_id === marketplace.id &&
      roundedDesi >= rate.desi_min &&
      roundedDesi <= rate.desi_max
  );

  if (selectedCarrierId) {
    const exactRate = matchingRates.find((rate) => rate.shipping_company_id === selectedCarrierId);
    if (exactRate) {
      return {
        shippingCompanyId: selectedCarrierId,
        shippingCompanyName: await getShippingCompanyNameById(selectedCarrierId),
        cost: round2(Number(exactRate.price)),
        warning: null,
      };
    }
  }

  if (matchingRates.length > 0) {
    const cheapest = matchingRates.reduce((best, current) =>
      current.price < best.price ? current : best
    );

    return {
      shippingCompanyId: cheapest.shipping_company_id,
      shippingCompanyName: await getShippingCompanyNameById(cheapest.shipping_company_id),
      cost: round2(Number(cheapest.price)),
      warning: carrierName
        ? "Seçilen kargo şirketi için fiyat bulunamadı; en ucuz DB kaydı kullanıldı."
        : null,
    };
  }

  return {
    shippingCompanyId: selectedCarrierId,
    shippingCompanyName: await getShippingCompanyNameById(selectedCarrierId),
    cost: 0,
    warning: "Desi aralığı için kargo kaydı bulunamadı; 0 kabul edildi.",
  };
}

async function resolvePlatformFeeCost(marketplaceId: number, salePrice: number, shipmentType?: "normal" | "fast") {
  const feeRows = await getPlatformFeeRulesByMarketplaceId(marketplaceId) as PlatformFeeRow[];
  const relevantRows = feeRows.filter((row) => {
    if (shipmentType === "fast") {
      return row.shipment_type === "fast" || row.shipment_type === null;
    }
    return row.shipment_type === null || row.shipment_type === "normal";
  });

  if (relevantRows.length === 0) {
    return {
      cost: 0,
      inputVat: 0,
      warning: "Platform fee kuralı bulunamadı; 0 kabul edildi.",
    };
  }

  let netCost = 0;
  let inputVat = 0;

  for (const row of relevantRows) {
    const vatRate = safeNumber(row.vat_rate_percent, 0);

    if (row.fee_type === "fixed") {
      const netValue = row.fee_value_net ?? (row.fee_value_gross != null && vatRate > 0 ? row.fee_value_gross / (1 + vatRate / 100) : row.fee_value_gross ?? 0);
      netCost += netValue;
      inputVat += netValue * (vatRate / 100);
      continue;
    }

    const netRate = row.fee_rate_percent_net ?? (row.fee_rate_percent_gross != null && vatRate > 0 ? row.fee_rate_percent_gross / (1 + vatRate / 100) : row.fee_rate_percent_gross ?? 0);
    const netValue = salePrice * (netRate / 100);
    netCost += netValue;
    inputVat += netValue * (vatRate / 100);
  }

  return {
    cost: round2(netCost),
    inputVat: round2(inputVat),
    warning: null,
  };
}

function resolvePaymentGatewayCost(params: {
  salePrice: number;
  gatewayRule: PaymentGatewayRuleRow | null;
  overrideRate?: number;
  overrideFixedFee?: number;
}) {
  const gatewayRule = params.gatewayRule;
  const feeRatePercent = Number(
    params.overrideRate ?? gatewayRule?.fee_rate_percent ?? 0
  );
  const fixedFee = Number(
    params.overrideFixedFee ?? gatewayRule?.fixed_fee_per_order ?? 0
  );
  const vatRate = Number(gatewayRule?.vat_rate_percent ?? 0);
  const feeValuesIncludeVat = Boolean(gatewayRule?.fee_values_include_vat);

  const grossFee = round2(params.salePrice * (feeRatePercent / 100) + fixedFee);

  if (feeValuesIncludeVat && vatRate > 0) {
    const netFee = round2(grossFee / (1 + vatRate / 100));
    return {
      cost: netFee,
      inputVat: round2(grossFee - netFee),
      warning: null,
    };
  }

  const netFee = round2(grossFee);
  return {
    cost: netFee,
    inputVat: round2(netFee * (vatRate / 100)),
    warning: null,
  };
}

function getTrafficCostFromSettings(settings?: WebsiteTrafficSettings) {
  if (!settings) {
    return 0;
  }

  switch (settings.mode) {
    case "manual_cpa":
      return round2(Math.max(0, Number(settings.manualCpa ?? 0)));
    case "budget_per_order": {
      const orders = Math.max(1, Number(settings.monthlyAdOrders ?? 1));
      return round2(Math.max(0, Number(settings.monthlyAdBudget ?? 0)) / orders);
    }
    case "cpc_conversion": {
      const rateDecimal = Math.max(0, Number(settings.conversionRate ?? 0)) / 100;
      if (rateDecimal <= 0) return 0;
      return round2(Math.max(0, Number(settings.averageCpc ?? 0)) / rateDecimal);
    }
    default:
      return 0;
  }
}

function resolveExpectedReturnCost(inputValue?: number, fallbackValue = 0) {
  if (typeof inputValue === "number" && Number.isFinite(inputValue) && inputValue > 0) {
    return {
      cost: round2(inputValue),
      warning: null as string | null,
    };
  }

  if (fallbackValue > 0) {
    return {
      cost: round2(fallbackValue),
      warning: null as string | null,
    };
  }

  return {
    cost: 0,
    warning: "Beklenen iade maliyeti için veri tabanı kaynağı bulunamadı; 0 kabul edildi.",
  };
}

async function getMarketplaceRecord(channelName: string) {
  const marketplace = await resolveMarketplaceByChannelName(channelName);
  if (marketplace) return marketplace;

  return await getOne<Marketplace>(
    "SELECT marketplace_id AS id, name, slug FROM marketplaces WHERE name = ? LIMIT 1",
    [channelName]
  );
}

function buildWarningList(...warnings: Array<string | null | undefined>) {
  return warnings.filter((warning): warning is string => Boolean(warning && warning.trim().length > 0));
}

export function calculateTrafficCost(settings?: WebsiteTrafficSettings): number {
  return getTrafficCostFromSettings(settings);
}

export async function calculateChannelCost(
  marketplaceName: string,
  input: {
    product: Product;
    salePrice: number;
    carrierName?: string;
    shipmentType?: "normal" | "fast";
    manualShippingCost?: number;
    paymentGatewayRate?: number;
    paymentGatewayFixedFee?: number;
    paymentGatewayRuleId?: number;
    adCost: number;
    fixedCost: number;
    trafficSettings?: WebsiteTrafficSettings;
    expectedReturnCost?: number;
    productSetting?: ProductMarketplaceSettingRow | null;
  }
): Promise<CostCalculationRecord> {
  const product = input.product;
  const marketplace = await getMarketplaceRecord(marketplaceName);
  if (!marketplace) {
    throw new Error(`Marketplace not found: ${marketplaceName}`);
  }

  const isOwnWebsite = normalizeMarketplaceSlug(marketplace.slug) === "own_website" || marketplace.name === "Kendi Websitem";
  const salePrice = round2(Number(input.salePrice ?? 0));
  const productSetting = input.productSetting ?? await getProductMarketplaceSetting(product.id, marketplace.id);
  const sellerFixedCost = await getSellerFixedCostPerUnit(product.id, product.profile_id ?? 1);
  const sellerProfile = sellerFixedCost.profile;
  const categoryVat = await resolveCategoryVatRate(product.category_id ?? null);

  const warnings: string[] = [];
  if (sellerFixedCost.warning) warnings.push(sellerFixedCost.warning);
  if (categoryVat.warning) warnings.push(categoryVat.warning);

  // Commission is marketplace-specific and category-driven.
  const commission = isOwnWebsite
    ? { rate: 0, cost: 0, warning: null as string | null, matchType: "manual" }
    : await resolveCommissionCost(marketplace.name, product.category_id ?? null, salePrice);
  if (commission.warning) warnings.push(commission.warning);

  // Shipping comes from the carrier matrix for marketplaces, or directly from the website shipping rule for own site.
  let shippingCost = 0;
  let shippingCompanyId: number | null = null;
  let shippingCompanyName: string | null = null;
  let shippingMode: string | null = input.shipmentType ?? productSetting?.shipping_mode ?? null;
  let manualShippingCost: number | null = null;

  if (isOwnWebsite) {
    const ownWebsiteGateway = input.paymentGatewayRuleId
      ? await getPaymentGatewayRuleById(input.paymentGatewayRuleId)
      : productSetting?.payment_gateway_rule_id
        ? await getPaymentGatewayRuleById(productSetting.payment_gateway_rule_id)
        : await getOwnWebsiteGatewayRule();

    const baseShipping = round2(
      Number(
        input.manualShippingCost ??
          productSetting?.manual_shipping_cost ??
          ownWebsiteGateway?.manual_shipping_cost ??
          0
      )
    );

    shippingCost = round2(baseShipping);
    manualShippingCost = baseShipping;
    shippingMode = "manual";
    if (baseShipping <= 0) {
      warnings.push("Kendi site kargo maliyeti için DB değeri bulunamadı; 0 kabul edildi.");
    }
  } else {
    const carrierSettingId = productSetting?.shipping_company_id ?? null;
    const carrierFromDb = await getShippingCompanyNameById(carrierSettingId);
    const selectedCarrierName = input.carrierName?.trim() || carrierFromDb || undefined;
    const shippingResolution = await resolveMarketplaceShippingCost(
      marketplace.name,
      product.desi,
      selectedCarrierName,
      carrierSettingId
    );
    shippingCost = shippingResolution.cost;
    shippingCompanyId = shippingResolution.shippingCompanyId;
    shippingCompanyName = shippingResolution.shippingCompanyName;
    if (shippingResolution.warning) warnings.push(shippingResolution.warning);
  }

  const platformFee = isOwnWebsite
    ? { cost: 0, inputVat: 0, warning: null as string | null }
    : await resolvePlatformFeeCost(marketplace.id, salePrice, (input.shipmentType ?? productSetting?.shipping_mode ?? "normal") as "normal" | "fast");
  if (platformFee.warning) warnings.push(platformFee.warning);

  const gatewayRule = isOwnWebsite
    ? input.paymentGatewayRuleId
      ? await getPaymentGatewayRuleById(input.paymentGatewayRuleId)
      : productSetting?.payment_gateway_rule_id
        ? await getPaymentGatewayRuleById(productSetting.payment_gateway_rule_id)
        : await getOwnWebsiteGatewayRule()
    : null;

  const paymentGateway = isOwnWebsite
    ? resolvePaymentGatewayCost({
        salePrice,
        gatewayRule,
        overrideRate: Number.isFinite(input.paymentGatewayRate) ? Number(input.paymentGatewayRate) : undefined,
        overrideFixedFee: Number.isFinite(input.paymentGatewayFixedFee) ? Number(input.paymentGatewayFixedFee) : undefined,
      })
    : { cost: 0, inputVat: 0, warning: null as string | null };
  if (paymentGateway.warning) warnings.push(paymentGateway.warning);

  const mlSignals = await predictNetCostSignals({
    product,
    marketplaceId: marketplace.id,
    salePrice,
    baseShippingCost: shippingCost,
    shippingCompanyId,
    channelType: isOwnWebsite ? "own_website" : "marketplace",
    currentTrafficCpa: isOwnWebsite ? productSetting?.traffic_cpa ?? undefined : null,
    commissionCost: commission.cost,
    platformFeeCost: platformFee.cost,
    paymentGatewayCost: paymentGateway.cost,
  });

  shippingCost = mlSignals.ml_effective_shipping_cost;

  const trafficAdCost = isOwnWebsite
    ? Number.isFinite(Number(input.trafficSettings?.manualCpa ?? 0)) && Number(input.trafficSettings?.manualCpa ?? 0) > 0
      ? getTrafficCostFromSettings(input.trafficSettings)
      : mlSignals.ml_predicted_cpa
    : 0;
  const marketplaceAdCost = isOwnWebsite ? round2(Number(input.adCost ?? 0)) : round2(Number(input.adCost ?? 0));
  const expectedReturn = resolveExpectedReturnCost(input.expectedReturnCost, mlSignals.ml_predicted_return_cost);
  const expectedReturnWarning = expectedReturn.warning;

  const totalCost = round2(
    product.cost +
      product.packaging_cost +
      shippingCost +
      commission.cost +
      platformFee.cost +
      paymentGateway.cost +
      trafficAdCost +
      marketplaceAdCost +
      sellerFixedCost.unitFixedCost +
      expectedReturn.cost
  );

  const netProfit = round2(salePrice - totalCost);
  const margin = salePrice > 0 ? round2((netProfit / salePrice) * 100) : 0;

  const productVat = round2(product.cost * (categoryVat.rate / 100));
  const packagingVat = round2(product.packaging_cost * (categoryVat.rate / 100));
  const shippingVat = round2(shippingCost * (categoryVat.rate / 100));
  const commissionVat = round2(commission.cost * (categoryVat.rate / 100));
  const adVat = round2(marketplaceAdCost * (categoryVat.rate / 100));
  const fixedVat = round2(sellerFixedCost.unitFixedCost * (categoryVat.rate / 100));
  const returnVat = round2(expectedReturn.cost * (categoryVat.rate / 100));
  const trafficVat = round2(trafficAdCost * (categoryVat.rate / 100));

  const platformVat = round2(platformFee.inputVat);
  const gatewayVat = round2(paymentGateway.inputVat);
  const inputVat = round2(
    productVat +
      packagingVat +
      shippingVat +
      commissionVat +
      platformVat +
      gatewayVat +
      adVat +
      fixedVat +
      returnVat +
      trafficVat
  );

  // Output VAT is estimated from the gross sale price segment.
  const outputVat = categoryVat.rate > 0
    ? round2(salePrice - salePrice / (1 + categoryVat.rate / 100))
    : 0;
  const estimatedVatPayable = round2(outputVat - inputVat);

  const incomeTaxResult = sellerProfile
    ? await resolveIncomeTaxPerSale(netProfit, sellerProfile, product.id)
    : { perSaleTax: 0, annualTax: 0, warning: null as string | null };
  if (incomeTaxResult.warning) warnings.push(incomeTaxResult.warning);
  const incomeTax = round2(incomeTaxResult.perSaleTax);

  // Stopaj currently has no dedicated persisted rule in the database.
  // Keep the field for the UI and hide it when it is zero.
  const withholdingTax = 0;

  let grossNetProfitWithoutTraffic: number | undefined;
  let grossMarginWithoutTraffic: number | undefined;
  if (isOwnWebsite) {
    const costWithoutTraffic = totalCost - trafficAdCost;
    grossNetProfitWithoutTraffic = round2(salePrice - costWithoutTraffic);
    grossMarginWithoutTraffic = salePrice > 0 ? round2((grossNetProfitWithoutTraffic / salePrice) * 100) : 0;
  }

  const warningNotes = buildWarningList(
    ...warnings,
    !isOwnWebsite && shippingCompanyId === null ? "Kargo şirketi bulunamadı; en ucuz DB kaydı kullanıldı." : null,
    expectedReturnWarning
  );

  return {
    channel_name: marketplace.name,
    marketplace_id: marketplace.id,
    marketplace_name: marketplace.name,
    marketplace_slug: normalizeMarketplaceSlug(marketplace.slug) ?? undefined,
    shipping_company_id: shippingCompanyId,
    shipping_company_name: shippingCompanyName,
    payment_gateway_rule_id: gatewayRule?.id ?? productSetting?.payment_gateway_rule_id ?? null,
    shipping_mode: shippingMode,
    manual_shipping_cost: manualShippingCost,
    sale_price: salePrice,
    product_cost: round2(product.cost),
    packaging_cost: round2(product.packaging_cost),
    shipping_cost: shippingCost,
    commission_cost: round2(commission.cost),
    platform_fee_cost: round2(platformFee.cost),
    payment_gateway_cost: round2(paymentGateway.cost),
    traffic_ad_cost: round2(trafficAdCost),
    unit_ad_cost: round2(marketplaceAdCost),
    unit_fixed_cost: sellerFixedCost.unitFixedCost,
    expected_return_cost: expectedReturn.cost,
    total_unit_cost: totalCost,
    net_profit: netProfit,
    profit_margin_percent: margin,
    output_vat: outputVat,
    input_vat: inputVat,
    estimated_vat_payable: estimatedVatPayable,
    shipping_vat: shippingVat,
    income_tax: incomeTax,
    withholding_tax: withholdingTax,
    ml_return_rate: mlSignals.ml_return_rate,
    ml_predicted_return_cost: mlSignals.ml_predicted_return_cost,
    ml_predicted_cpa: mlSignals.ml_predicted_cpa,
    ml_shipping_multiplier: mlSignals.ml_shipping_multiplier,
    ml_effective_shipping_cost: mlSignals.ml_effective_shipping_cost,
    ml_effective_desi: mlSignals.ml_effective_desi,
    ml_confidence: mlSignals.ml_confidence,
    ml_notes: mlSignals.ml_notes,
    ml_model_source: mlSignals.ml_model_source,
    gross_net_profit_without_traffic: grossNetProfitWithoutTraffic,
    gross_margin_without_traffic: grossMarginWithoutTraffic,
    is_fallback: warnings.length > 0,
    warning_notes: warningNotes.length > 0 ? warningNotes.join(" ") : null,
  };
}

export async function calculateAllChannels(input: CalculationInput) {
  const results: CostCalculationRecord[] = [];

  if (input.channels.trendyol.active) {
    const productSetting = await resolveProductMarketplaceDefaults(input.product.id, 1);
    results.push(await calculateChannelCost("Trendyol", {
      product: input.product,
      salePrice: input.channels.trendyol.salePrice,
      carrierName: input.channels.trendyol.carrierName,
      shipmentType: input.channels.trendyol.shipmentType,
      adCost: input.channels.trendyol.adCost,
      fixedCost: input.channels.trendyol.fixedCost,
      expectedReturnCost: input.channels.trendyol.expectedReturnCost,
      productSetting,
    }));
  }

  if (input.channels.hepsiburada.active) {
    const productSetting = await resolveProductMarketplaceDefaults(input.product.id, 2);
    results.push(await calculateChannelCost("Hepsiburada", {
      product: input.product,
      salePrice: input.channels.hepsiburada.salePrice,
      carrierName: input.channels.hepsiburada.carrierName,
      adCost: input.channels.hepsiburada.adCost,
      fixedCost: input.channels.hepsiburada.fixedCost,
      expectedReturnCost: input.channels.hepsiburada.expectedReturnCost,
      productSetting,
    }));
  }

  if (input.channels.my_website.active) {
    const productSetting = await resolveProductMarketplaceDefaults(input.product.id, 3);
    results.push(await calculateChannelCost("Kendi Websitem", {
      product: input.product,
      salePrice: input.channels.my_website.salePrice,
      manualShippingCost: input.channels.my_website.shippingCost,
      paymentGatewayRate: input.channels.my_website.gatewayRate,
      paymentGatewayFixedFee: input.channels.my_website.gatewayFixedFee,
      adCost: input.channels.my_website.adCost,
      fixedCost: input.channels.my_website.fixedCost,
      trafficSettings: input.channels.my_website.trafficSettings,
      expectedReturnCost: input.channels.my_website.expectedReturnCost,
      productSetting,
    }));
  }

  const bestChannel = results.length > 0
    ? results.reduce((prev, current) => (prev.net_profit > current.net_profit ? prev : current))
    : null;

  const trafficThresholds: TrafficThreshold[] = [];
  const websiteResult = results.find((result) => result.channel_name === "Kendi Websitem");
  if (websiteResult && websiteResult.gross_net_profit_without_traffic !== undefined) {
    const grossProfit = websiteResult.gross_net_profit_without_traffic;
    for (const result of results) {
      if (result.channel_name === "Kendi Websitem") continue;
      trafficThresholds.push({
        vsChannel: result.channel_name,
        maxTrafficCost: round2(grossProfit - result.net_profit),
      });
    }
  }

  return {
    results,
    bestChannel,
    trafficThresholds,
    product: input.product,
  };
}

export async function persistCostResults(productId: number, results: CostCalculationRecord[]) {
  const db = getDb();
  if (!db) {
    return false;
  }

  const insertResult = db.prepare(`
    INSERT INTO cost_results (
      product_id,
      marketplace_id,
      shipping_company_id,
      marketplace_slug,
      marketplace_name,
      list_price,
      product_cost,
      packaging_cost,
      shipping_cost,
      commission_cost,
      platform_fee_cost,
      payment_gateway_cost,
      unit_ad_cost,
      unit_fixed_cost,
      expected_return_cost,
      total_unit_cost,
      net_profit,
      profit_margin_percent,
      output_vat_amount,
      input_vat_amount,
      estimated_vat_payable,
      shipping_vat_amount,
      income_tax_amount,
      withholding_tax_amount,
      ml_return_rate,
      ml_predicted_return_cost,
      ml_predicted_cpa,
      ml_shipping_multiplier,
      ml_effective_shipping_cost,
      ml_effective_desi,
      ml_confidence,
      ml_notes,
      ml_model_source,
      shipping_mode,
      manual_shipping_cost,
      payment_gateway_rule_id,
      warning_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await db.transaction(async () => {
    await db.prepare("DELETE FROM cost_results WHERE product_id = ?").run(productId);
    for (const result of results) {
      await insertResult.run(
        productId,
        result.marketplace_id ?? 0,
        result.shipping_company_id ?? null,
        result.marketplace_slug ?? null,
        result.marketplace_name ?? result.channel_name,
        result.sale_price,
        result.product_cost,
        result.packaging_cost,
        result.shipping_cost,
        result.commission_cost,
        result.platform_fee_cost,
        result.payment_gateway_cost,
        result.unit_ad_cost,
        result.unit_fixed_cost,
        result.expected_return_cost,
        result.total_unit_cost,
        result.net_profit,
        result.profit_margin_percent,
        result.output_vat,
        result.input_vat,
        result.estimated_vat_payable,
        result.shipping_vat ?? 0,
        result.income_tax ?? 0,
        result.withholding_tax ?? 0,
        result.ml_return_rate ?? 0,
        result.ml_predicted_return_cost ?? 0,
        result.ml_predicted_cpa ?? 0,
        result.ml_shipping_multiplier ?? 1,
        result.ml_effective_shipping_cost ?? 0,
        result.ml_effective_desi ?? 0,
        result.ml_confidence ?? null,
        result.ml_notes ?? null,
        result.ml_model_source ?? null,
        result.shipping_mode ?? null,
        result.manual_shipping_cost ?? null,
        result.payment_gateway_rule_id ?? null,
        result.warning_notes ?? null
      );
    }
  });

  clearNetCostMlSignalCache();

  return true;
}

export async function buildCostBootstrap(productId?: number) {
  const products = (await query<Product>(`
    SELECT
      p.product_id AS id,
      p.name,
      p.sku,
      p.image_url,
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
    ORDER BY p.product_id DESC
  `)).map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    image_url: row.image_url,
    category_id: row.category_id,
    category_name: row.category_name,
    category_path: row.category_path,
    profile_id: row.profile_id,
    cost: Number(row.cost ?? 0),
    packaging_cost: Number(row.packaging_cost ?? 0),
    desi: Number(row.desi ?? 0),
    sale_price: 0,
    active_channels: [],
    status: row.status,
    status_label: row.status === "passive" ? "Pasif" : row.status === "draft" ? "Taslak" : "Aktif",
  }));

  const marketplaces = (await query<Marketplace>("SELECT marketplace_id AS id, name, COALESCE(slug, '') AS slug FROM marketplaces"))
    .filter((marketplace) => ["trendyol", "hepsiburada", "own_website"].includes(normalizeMarketplaceSlug(marketplace.slug) ?? ""))
    .sort((left, right) => {
      const order = ["trendyol", "hepsiburada", "own_website"];
      return order.indexOf(normalizeMarketplaceSlug(left.slug) ?? "") - order.indexOf(normalizeMarketplaceSlug(right.slug) ?? "");
    });

  const selectedProduct = products.find((product) => product.id === (productId ?? products[0]?.id)) ?? products[0] ?? null;
  const unitFixedCost = selectedProduct ? (await getSellerFixedCostPerUnit(selectedProduct.id, selectedProduct.profile_id ?? 1)).unitFixedCost : 0;

  const defaultProductSettings = selectedProduct
    ? {
        trendyol: await resolveProductMarketplaceDefaults(selectedProduct.id, 1),
        hepsiburada: await resolveProductMarketplaceDefaults(selectedProduct.id, 2),
        my_website: await resolveProductMarketplaceDefaults(selectedProduct.id, 3),
      }
    : null;

  return {
    products,
    marketplaces,
    selectedProduct,
    unitFixedCost,
    defaultProductSettings,
  };
}

async function buildDatabaseDrivenInput(productId?: number): Promise<CalculationInput | null> {
  const products = await getProducts();
  if (products.length === 0) {
    return null;
  }

  const selectedProduct = products.find((product) => product.id === (productId ?? products[0].id)) ?? products[0];
  const trendyolPersistedSetting = await getProductMarketplaceSetting(selectedProduct.id, 1);
  const hepsiburadaPersistedSetting = await getProductMarketplaceSetting(selectedProduct.id, 2);
  const websitePersistedSetting = await getProductMarketplaceSetting(selectedProduct.id, 3);
  const trendyolSetting = await resolveProductMarketplaceDefaults(selectedProduct.id, 1);
  const hepsiburadaSetting = await resolveProductMarketplaceDefaults(selectedProduct.id, 2);
  const websiteSetting = await resolveProductMarketplaceDefaults(selectedProduct.id, 3);
  const websiteGateway = websiteSetting?.payment_gateway_rule_id
    ? await getPaymentGatewayRuleById(websiteSetting.payment_gateway_rule_id)
    : await getOwnWebsiteGatewayRule();
  const baseWebsiteCpa = Number(websiteSetting?.traffic_cpa ?? websiteGateway?.avg_ad_cost ?? 0);

  return {
    product: selectedProduct,
    channels: {
      trendyol: {
        active: selectedProduct.active_channels.includes("trendyol") || Boolean(trendyolPersistedSetting),
        salePrice: Number(trendyolSetting?.sale_price ?? selectedProduct.sale_price ?? 0),
        carrierName: await getShippingCompanyNameById(trendyolSetting?.shipping_company_id) ?? "",
        shipmentType: (trendyolSetting?.shipping_mode === "fast" ? "fast" : "normal"),
        adCost: 0,
        fixedCost: 0,
        expectedReturnCost: 0,
      },
      hepsiburada: {
        active: selectedProduct.active_channels.includes("hepsiburada") || Boolean(hepsiburadaPersistedSetting),
        salePrice: Number(hepsiburadaSetting?.sale_price ?? selectedProduct.sale_price ?? 0),
        carrierName: await getShippingCompanyNameById(hepsiburadaSetting?.shipping_company_id) ?? "",
        adCost: 0,
        fixedCost: 0,
        expectedReturnCost: 0,
      },
      my_website: {
        active: selectedProduct.active_channels.includes("my_website") || Boolean(websitePersistedSetting),
        salePrice: Number(websiteSetting?.sale_price ?? selectedProduct.sale_price ?? 0),
        shippingCost: Number(websiteSetting?.manual_shipping_cost ?? websiteGateway?.manual_shipping_cost ?? 0),
        gatewayName: String(websiteGateway?.gateway_name ?? "Ödeme Altyapısı"),
        gatewayRate: Number(websiteGateway?.fee_rate_percent ?? 0),
        gatewayFixedFee: Number(websiteGateway?.fixed_fee_per_order ?? 0),
        adCost: 0,
        fixedCost: 0,
        trafficSettings: {
          mode: "manual_cpa",
          manualCpa: baseWebsiteCpa,
          monthlyAdBudget: 0,
          monthlyAdOrders: 1,
          averageCpc: 0,
          conversionRate: 0,
        },
        expectedReturnCost: 0,
      },
    },
  };
}

export async function recalculateCostResultsForProductFromDatabase(productId?: number) {
  const input = await buildDatabaseDrivenInput(productId);
  if (!input) {
    return [];
  }

  const calculation = await calculateAllChannels(input);
  await persistCostResults(input.product.id, calculation.results);
  return calculation.results;
}

export async function recalculateAllCostResultsFromDatabase() {
  const products = await getProducts();
  let processed = 0;
  for (const product of products) {
    await recalculateCostResultsForProductFromDatabase(product.id);
    processed += 1;
  }
  return processed;
}

export async function recalculateCostResultsForProfileFromDatabase(profileId: number) {
  const products = (await getProducts()).filter((product) => product.profile_id === profileId);
  let processed = 0;
  for (const product of products) {
    await recalculateCostResultsForProductFromDatabase(product.id);
    processed += 1;
  }
  return processed;
}
