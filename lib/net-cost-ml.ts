import { getOwnWebsiteGatewayRule } from "./database-readers";
import { getOne, query } from "./db";
import type { Product } from "./types";

type ChannelType = "marketplace" | "own_website";

type ReturnStatsRow = {
  total_orders: number | null;
  returned_orders: number | null;
};

type TrafficCpaRow = {
  traffic_cpa: number | null;
  product_id: number | null;
  category_id: number | null;
  category_path: string | null;
  profile_id: number | null;
  sale_price: number | null;
  cost: number | null;
  packaging_cost: number | null;
  calculated_at: string | null;
};

type ShippingHistoryRow = {
  observed_shipping_cost: number | null;
  shipping_company_id: number | null;
  marketplace_id: number | null;
  category_id: number | null;
  category_path: string | null;
  desi: number | null;
  cost: number | null;
  packaging_cost: number | null;
  observed_at: string | null;
};

export interface NetCostMlInput {
  product: Pick<
    Product,
    "id" | "category_id" | "category_name" | "category_path" | "profile_id" | "cost" | "packaging_cost" | "desi"
  >;
  marketplaceId: number;
  salePrice: number;
  baseShippingCost?: number;
  shippingCompanyId?: number | null;
  channelType: ChannelType;
  currentTrafficCpa?: number | null;
  commissionCost?: number;
  platformFeeCost?: number;
  paymentGatewayCost?: number;
}

export interface NetCostMlSignals {
  ml_return_rate: number;
  ml_predicted_return_cost: number;
  ml_predicted_cpa: number;
  ml_shipping_multiplier: number;
  ml_effective_shipping_cost: number;
  ml_effective_desi: number;
  ml_confidence: "Low" | "Medium" | "High";
  ml_notes: string;
  ml_model_source: string;
}

type CachedSignals = {
  expiresAt: number;
  value: NetCostMlSignals;
};

const SIGNAL_CACHE = new Map<string, CachedSignals>();
const CACHE_TTL_MS = 120_000;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRootCategory(categoryPath?: string | null) {
  return String(categoryPath ?? "")
    .split(" > ")[0]
    .trim()
    .toLowerCase();
}

function getCategoryText(product: NetCostMlInput["product"]) {
  return `${product.category_path ?? ""} ${product.category_name ?? ""}`.toLowerCase();
}

function getReturnPrior(product: NetCostMlInput["product"]) {
  const categoryText = getCategoryText(product);

  if (/(giyim|ayakkabı|ayakkabi|çanta|cant|tekstil|moda|aksesuar|takı|taki|bileklik|kolye|elbise)/.test(categoryText)) {
    return 18.5;
  }

  if (/(kozmetik|parfüm|parfum|cilt|makyaj|güzellik|guzellik|saç|sac)/.test(categoryText)) {
    return 13.2;
  }

  if (/(elektronik|telefon|bilgisayar|kulaklık|kulaklik|mouse|klavye|akıllı saat|akilli saat|tablet)/.test(categoryText)) {
    return 7.4;
  }

  if (/(ev|yaşam|yasam|mutfak|dekor|aydınlatma|aydinlatma|mobilya|furniture|mutfak)/.test(categoryText)) {
    return 10.4;
  }

  const desi = Math.max(0, safeNumber(product.desi, 0));
  return clamp(9.5 + desi * 1.35, 6, 24);
}

function getShippingPrior(product: NetCostMlInput["product"]) {
  const categoryText = getCategoryText(product);
  const desi = Math.max(0, safeNumber(product.desi, 0));

  if (/(giyim|ayakkabı|ayakkabi|çanta|cant|tekstil|moda|aksesuar|takı|taki|elbise)/.test(categoryText)) {
    return clamp(1.06 + desi * 0.01, 1, 1.22);
  }

  if (/(elektronik|telefon|bilgisayar|kulaklık|kulaklik|mouse|klavye|tablet)/.test(categoryText)) {
    return clamp(1.01 + desi * 0.006, 1, 1.12);
  }

  if (/(ev|yaşam|yasam|mutfak|dekor|aydınlatma|aydinlatma|mobilya|furniture)/.test(categoryText)) {
    return clamp(1.03 + desi * 0.008, 1, 1.16);
  }

  return clamp(1 + Math.max(0, (desi - 1.5) * 0.012), 1, 1.15);
}

async function getReturnStats(whereClause: string, params: unknown[]) {
  const row = await getOne<ReturnStatsRow>(
    `
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned_orders
      FROM orders
      ${whereClause}
        AND COALESCE(status, 'completed') IN ('completed', 'returned')
    `,
    params
  );

  const total = Math.max(0, safeNumber(row?.total_orders, 0));
  const returned = Math.max(0, safeNumber(row?.returned_orders, 0));
  const rate = total > 0 ? round2((returned / total) * 100) : 0;

  return { total, returned, rate };
}

async function getMarketplaceStats(marketplaceId: number) {
  return await getReturnStats("WHERE marketplace_id = ?", [marketplaceId]);
}

async function getProductStats(productId: number, marketplaceId: number) {
  return await getReturnStats("WHERE product_id = ? AND marketplace_id = ?", [productId, marketplaceId]);
}

async function getCategoryStats(categoryId: number | null | undefined) {
  if (!categoryId) return { total: 0, returned: 0, rate: 0 };
  return await getReturnStats(
    `
      WHERE product_id IN (
        SELECT product_id
        FROM products
        WHERE category_id = ?
      )
    `,
    [categoryId]
  );
}

async function getCategoryMarketplaceStats(categoryId: number | null | undefined, marketplaceId: number) {
  if (!categoryId) return { total: 0, returned: 0, rate: 0 };
  return await getReturnStats(
    `
      WHERE product_id IN (
        SELECT product_id
        FROM products
        WHERE category_id = ?
      )
      AND marketplace_id = ?
    `,
    [categoryId, marketplaceId]
  );
}

async function getProfileStats(profileId: number | null | undefined) {
  if (!profileId) return { total: 0, returned: 0, rate: 0 };
  return await getReturnStats(
    `
      WHERE product_id IN (
        SELECT product_id
        FROM products
        WHERE profile_id = ?
      )
    `,
    [profileId]
  );
}

async function getGlobalStats() {
  return await getReturnStats("WHERE 1 = 1", []);
}

async function getTrafficCandidateRows(productId: number) {
  const persistedRows = await query<TrafficCpaRow>(
    `
      SELECT
        pms.traffic_cpa,
        pms.product_id,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.profile_id,
        pms.sale_price,
        p.cost,
        p.packaging_cost,
        cr.calculated_at
      FROM product_marketplace_settings pms
      JOIN products p ON p.product_id = pms.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      LEFT JOIN cost_results cr
        ON cr.product_id = pms.product_id
       AND cr.marketplace_id = pms.marketplace_id
      WHERE pms.marketplace_id = 3
        AND pms.traffic_cpa IS NOT NULL
        AND pms.traffic_cpa > 0
        AND pms.product_id <> ?
      ORDER BY COALESCE(cr.calculated_at, CURRENT_TIMESTAMP) DESC, pms.product_id DESC
      LIMIT 300
    `,
    [productId]
  );

  const adResultRows = await query<TrafficCpaRow>(
    `
      SELECT
        cr.unit_ad_cost AS traffic_cpa,
        cr.product_id,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.profile_id,
        cr.list_price AS sale_price,
        p.cost,
        p.packaging_cost,
        cr.calculated_at
      FROM cost_results cr
      JOIN products p ON p.product_id = cr.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE cr.marketplace_id = 3
        AND cr.unit_ad_cost IS NOT NULL
        AND cr.unit_ad_cost > 0
        AND cr.product_id <> ?
      ORDER BY COALESCE(cr.calculated_at, CURRENT_TIMESTAMP) DESC, cr.id DESC
      LIMIT 300
    `,
    [productId]
  );

  return [...persistedRows, ...adResultRows];
}

async function getShippingHistoryRows(productId: number, marketplaceId: number) {
  const orderRows = await query<ShippingHistoryRow>(
    `
      SELECT
        o.realized_shipping_cost AS observed_shipping_cost,
        o.marketplace_id,
        pms.shipping_company_id AS shipping_company_id,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.desi,
        p.cost,
        p.packaging_cost,
        COALESCE(o.last_synced_at, o.created_at, o.order_date) AS observed_at
      FROM orders o
      JOIN products p ON p.product_id = o.product_id
      LEFT JOIN product_marketplace_settings pms
        ON pms.product_id = o.product_id
       AND pms.marketplace_id = o.marketplace_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE o.marketplace_id = ?
        AND o.product_id <> ?
        AND o.realized_shipping_cost IS NOT NULL
        AND o.realized_shipping_cost > 0
      ORDER BY o.order_date DESC, o.order_id DESC
      LIMIT 300
    `,
    [marketplaceId, productId]
  );

  const costRows = await query<ShippingHistoryRow>(
    `
      SELECT
        cr.realized_shipping_cost AS observed_shipping_cost,
        cr.shipping_company_id,
        cr.marketplace_id,
        p.category_id,
        COALESCE(p.category_path, c.path) AS category_path,
        p.desi,
        p.cost,
        p.packaging_cost,
        cr.calculated_at AS observed_at
      FROM cost_results cr
      JOIN products p ON p.product_id = cr.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE cr.marketplace_id = ?
        AND cr.product_id <> ?
        AND cr.realized_shipping_cost IS NOT NULL
        AND cr.realized_shipping_cost > 0
      ORDER BY cr.calculated_at DESC, cr.id DESC
      LIMIT 300
    `,
    [marketplaceId, productId]
  );

  return [...orderRows, ...costRows];
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (totalWeight <= 0) return 0;
  return values.reduce((sum, item) => sum + item.value * Math.max(0, item.weight), 0) / totalWeight;
}

function scoreAgreement(values: number[]) {
  if (values.length <= 1) return 0.2;
  const spread = Math.max(...values) - Math.min(...values);
  return clamp(1 - spread / 40, 0, 1);
}

function resolveConfidenceScore(sampleSize: number, agreementScore: number, hasRealShippingData: boolean) {
  const sampleScore = clamp(Math.log1p(sampleSize) / 6, 0, 0.45);
  const realDataScore = hasRealShippingData ? 0.1 : 0;
  const numeric = clamp(0.28 + sampleScore + agreementScore * 0.35 + realDataScore, 0, 1);

  if (numeric >= 0.7) return "High" as const;
  if (numeric >= 0.45) return "Medium" as const;
  return "Low" as const;
}

async function resolveReturnRate(product: NetCostMlInput["product"], marketplaceId: number) {
  const productStats = await getProductStats(product.id, marketplaceId);
  const categoryStats = await getCategoryStats(product.category_id);
  const categoryMarketplaceStats = await getCategoryMarketplaceStats(product.category_id, marketplaceId);
  const profileStats = await getProfileStats(product.profile_id);
  const marketplaceStats = await getMarketplaceStats(marketplaceId);
  const globalStats = await getGlobalStats();

  const prior = getReturnPrior(product);
  const candidates = [
    { value: productStats.rate, weight: productStats.total > 0 ? 2.4 : 0 },
    { value: categoryMarketplaceStats.rate, weight: categoryMarketplaceStats.total > 0 ? 1.8 : 0 },
    { value: categoryStats.rate, weight: categoryStats.total > 0 ? 1.25 : 0 },
    { value: profileStats.rate, weight: profileStats.total > 0 ? 0.85 : 0 },
    { value: marketplaceStats.rate, weight: marketplaceStats.total > 0 ? 1.05 : 0 },
    { value: globalStats.rate, weight: globalStats.total > 0 ? 0.65 : 0 },
    { value: prior, weight: 0.9 },
  ];

  const nonZeroRates = candidates.filter((item) => item.weight > 0).map((item) => item.value);
  const blendedRate = weightedAverage(candidates);
  const adjustedRate = clamp(blendedRate, 2.5, 40);
  const confidence = resolveConfidenceScore(
    productStats.total + categoryMarketplaceStats.total + categoryStats.total + profileStats.total + marketplaceStats.total + globalStats.total,
    scoreAgreement(nonZeroRates),
    false
  );

  const sources: string[] = [];
  if (productStats.total > 0) sources.push(`ürün:${productStats.total}`);
  if (categoryMarketplaceStats.total > 0) sources.push(`kategori+pazar:${categoryMarketplaceStats.total}`);
  if (categoryStats.total > 0) sources.push(`kategori:${categoryStats.total}`);
  if (profileStats.total > 0) sources.push(`profil:${profileStats.total}`);
  if (marketplaceStats.total > 0) sources.push(`pazar:${marketplaceStats.total}`);
  if (globalStats.total > 0) sources.push(`genel:${globalStats.total}`);

  const note =
    productStats.total > 0
      ? "İade oranı ürün geçmişi + kategori + pazar ağırlığıyla tahmin edildi."
      : "İade oranı kategori ve pazar prioru ile tahmin edildi.";

  return {
    returnRate: adjustedRate,
    confidence,
    sampleSize: productStats.total + categoryMarketplaceStats.total + categoryStats.total + profileStats.total + marketplaceStats.total + globalStats.total,
    note,
    source: sources.join(" | "),
  };
}

async function resolveTrafficCpa(product: NetCostMlInput["product"], salePrice: number, currentTrafficCpa?: number | null) {
  const candidateRows = await getTrafficCandidateRows(product.id);
  const gateway = await getOwnWebsiteGatewayRule();
  const fallback = round2(safeNumber(gateway?.avg_ad_cost, 56.2));
  const basePrior = currentTrafficCpa && currentTrafficCpa > 0 ? round2(currentTrafficCpa) : fallback;
  const categoryRoot = toRootCategory(product.category_path ?? product.category_name);

  if (candidateRows.length === 0) {
    const adjusted = round2(Math.max(0, basePrior * (1 + Math.min(0.18, Math.log1p(Math.max(0, salePrice)) / 25))));
    return {
      cpa: adjusted,
      confidence: "Low" as const,
      sampleSize: 0,
      note: "CPA için yeterli benzer ürün verisi yok, ödeme altyapısı / ürün prioru kullanıldı.",
      source: "fallback",
    };
  }

  const weightedRows = candidateRows
    .map((row) => {
      const cpa = safeNumber(row.traffic_cpa, 0);
      if (cpa <= 0) return null;

      const rowCategoryRoot = toRootCategory(row.category_path);
      const sameCategory = row.category_id && product.category_id && row.category_id === product.category_id;
      const sameProfile = row.profile_id && product.profile_id && row.profile_id === product.profile_id;
      const categorySimilarity = sameCategory ? 1.9 : rowCategoryRoot === categoryRoot && categoryRoot ? 1.25 : 0.95;
      const profileSimilarity = sameProfile ? 1.25 : 1;
      const priceSimilarity = 1 / (1 + Math.abs(safeNumber(row.sale_price, salePrice) - salePrice) / Math.max(1, salePrice));
      const costSimilarity = 1 / (1 + Math.abs((safeNumber(row.cost, 0) + safeNumber(row.packaging_cost, 0)) - (safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0))) / Math.max(1, safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0)));
      const ageDays = row.calculated_at ? Math.max(0, (Date.now() - new Date(row.calculated_at).getTime()) / 86_400_000) : 365;
      const recency = 1 / (1 + ageDays / 45);
      const weight = categorySimilarity * profileSimilarity * priceSimilarity * costSimilarity * recency;
      return { value: cpa, weight };
    })
    .filter((item): item is { value: number; weight: number } => Boolean(item));

  const priorWeight = currentTrafficCpa && currentTrafficCpa > 0 ? 1.6 : 0;
  if (currentTrafficCpa && currentTrafficCpa > 0) {
    weightedRows.push({ value: round2(currentTrafficCpa), weight: priorWeight });
  }

  const weightedCpa = round2(weightedAverage(weightedRows.length > 0 ? weightedRows : [{ value: basePrior, weight: 1 }]));
  const values = weightedRows.length > 0 ? weightedRows.map((item) => item.value) : [basePrior];
  const agreement = scoreAgreement(values);
  const sampleSize = weightedRows.length;
  const confidence = resolveConfidenceScore(sampleSize, agreement, false);

  const note =
    candidateRows.length > 0
      ? "CPA benzer ürünlerin kategori, fiyat ve profil ağırlıklı geçmişinden tahmin edildi."
      : "CPA ödeme altyapısı prioru ile tahmin edildi.";

  return {
    cpa: round2(Math.max(0, weightedCpa)),
    confidence,
    sampleSize,
    note,
    source: candidateRows.length > 0 ? "history" : "fallback",
  };
}

async function resolveShippingMultiplier(
  product: NetCostMlInput["product"],
  marketplaceId: number,
  baseShippingCost: number,
  shippingCompanyId?: number | null
) {
  const historyRows = await getShippingHistoryRows(product.id, marketplaceId);
  const shippingRates = await query<{
    marketplace_id: number;
    shipping_company_id: number;
    desi_min: number;
    desi_max: number;
    price: number;
  }>("SELECT marketplace_id, shipping_company_id, desi_min, desi_max, price FROM shipping_rate_rules");

  const resolveExpectedTariff = (rowMarketplaceId: number | null, rowShippingCompanyId: number | null, desi: number | null) => {
    if (!rowMarketplaceId || !rowShippingCompanyId) return null;

    const roundedDesi = Math.max(0, Math.ceil(safeNumber(desi, 0)));
    const matched = shippingRates.find(
      (rate) =>
        rate.marketplace_id === rowMarketplaceId &&
        rate.shipping_company_id === rowShippingCompanyId &&
        roundedDesi >= rate.desi_min &&
        roundedDesi <= rate.desi_max
    );

    return matched ? round2(safeNumber(matched.price, 0)) : null;
  };

  const weightedRatios = historyRows
    .map((row) => {
      const observed = safeNumber(row.observed_shipping_cost, 0);
      const expected = resolveExpectedTariff(row.marketplace_id, row.shipping_company_id, row.desi);
      if (observed <= 0 || !expected || expected <= 0) return null;

      const rowCategoryRoot = toRootCategory(row.category_path);
      const productCategoryRoot = toRootCategory(product.category_path ?? product.category_name);
      const sameCategory = row.category_id && product.category_id && row.category_id === product.category_id;
      const sameRoot = rowCategoryRoot && productCategoryRoot && rowCategoryRoot === productCategoryRoot;
      const categorySimilarity = sameCategory ? 1.8 : sameRoot ? 1.2 : 0.9;
      const carrierSimilarity = shippingCompanyId && row.shipping_company_id === shippingCompanyId ? 1.5 : 1;
      const desiSimilarity = 1 / (1 + Math.abs(safeNumber(row.desi, 0) - safeNumber(product.desi, 0)));
      const costSimilarity = 1 / (1 + Math.abs((safeNumber(row.cost, 0) + safeNumber(row.packaging_cost, 0)) - (safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0))) / Math.max(1, safeNumber(product.cost, 0) + safeNumber(product.packaging_cost, 0)));
      const ageDays = row.observed_at ? Math.max(0, (Date.now() - new Date(row.observed_at).getTime()) / 86_400_000) : 365;
      const recency = 1 / (1 + ageDays / 60);
      const ratio = round2(observed / expected);
      const weight = categorySimilarity * carrierSimilarity * desiSimilarity * costSimilarity * recency;
      return { value: ratio, weight };
    })
    .filter((item): item is { value: number; weight: number } => Boolean(item));

  const prior = getShippingPrior(product);
  const hasRealData = weightedRatios.length > 0;
  const blended = hasRealData
    ? weightedAverage([...weightedRatios, { value: prior, weight: 0.6 }])
    : prior;

  const multiplier = round2(clamp(blended, 0.85, 1.35));
  const effectiveShippingCost = round2(Math.max(0, baseShippingCost) * multiplier);
  const effectiveDesi = round2(Math.max(0, safeNumber(product.desi, 0)) * multiplier);
  const confidence = resolveConfidenceScore(
    weightedRatios.length,
    scoreAgreement(weightedRatios.map((item) => item.value)),
    hasRealData
  );

  const note = hasRealData
    ? "Kargo çarpanı gerçek gerçekleşen kargo verisinden öğrenildi."
    : "Kargo çarpanı kategori ve desi prioru ile tahmin edildi.";

  return {
    shippingMultiplier: multiplier,
    effectiveShippingCost,
    effectiveDesi,
    confidence,
    sampleSize: weightedRatios.length,
    note,
    source: hasRealData ? "real_shipping_data" : "prior",
  };
}

function buildReturnCost(
  input: NetCostMlInput,
  returnRate: number,
  effectiveShippingCost: number
) {
  const categoryText = getCategoryText(input.product);
  const isOwnWebsite = input.channelType === "own_website";
  const productCost = Math.max(0, safeNumber(input.product.cost, 0));
  const packagingCost = Math.max(0, safeNumber(input.product.packaging_cost, 0));
  const baseHandlingFee = Math.max(4, input.salePrice * 0.015);

  const damageRate =
    /(giyim|ayakkabı|ayakkabi|çanta|cant|tekstil|moda|aksesuar|takı|taki|elbise)/.test(categoryText)
      ? 0.16
      : /(elektronik|telefon|bilgisayar|kulaklık|kulaklik|mouse|klavye|tablet)/.test(categoryText)
        ? 0.08
        : /(kozmetik|parfüm|parfum|cilt|makyaj|güzellik|guzellik|saç|sac)/.test(categoryText)
          ? 0.11
          : /(ev|yaşam|yasam|mutfak|dekor|aydınlatma|aydinlatma|mobilya|furniture)/.test(categoryText)
            ? 0.09
            : 0.1;

  const returnShippingLoss = effectiveShippingCost * (isOwnWebsite ? 1 : 0.9);
  const channelLoss = isOwnWebsite
    ? Math.max(0, safeNumber(input.paymentGatewayCost, 0)) * 0.22
    : Math.max(0, safeNumber(input.commissionCost, 0)) * 0.18 + Math.max(0, safeNumber(input.platformFeeCost, 0)) * 0.1;

  const lossPerReturn = round2(
    returnShippingLoss +
      packagingCost * 0.4 +
      productCost * damageRate +
      baseHandlingFee +
      channelLoss
  );

  return round2((returnRate / 100) * lossPerReturn);
}

export async function predictNetCostSignals(input: NetCostMlInput): Promise<NetCostMlSignals> {
  const cacheKey = [
    input.product.id,
    input.marketplaceId,
    input.channelType,
    input.shippingCompanyId ?? "none",
    Math.round(safeNumber(input.currentTrafficCpa, 0)),
    Math.round(safeNumber(input.baseShippingCost, 0)),
    Math.round(safeNumber(input.commissionCost, 0)),
    Math.round(safeNumber(input.platformFeeCost, 0)),
    Math.round(safeNumber(input.paymentGatewayCost, 0)),
    Math.round(safeNumber(input.salePrice, 0)),
  ].join(":");

  const cached = SIGNAL_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const returnSignals = await resolveReturnRate(input.product, input.marketplaceId);
  const cpaSignals = input.channelType === "own_website"
    ? await resolveTrafficCpa(input.product, input.salePrice, input.currentTrafficCpa)
    : {
        cpa: 0,
        confidence: "Low" as const,
        sampleSize: 0,
        note: "Pazaryeri kanalında CPA modeli kullanılmaz.",
        source: "n/a",
      };
  const shippingSignals = await resolveShippingMultiplier(
    input.product,
    input.marketplaceId,
    Math.max(0, safeNumber(input.baseShippingCost, 0)),
    input.shippingCompanyId ?? null
  );

  const effectiveShippingCost = shippingSignals.effectiveShippingCost;
  const predictedReturnCost = buildReturnCost(
    input,
    returnSignals.returnRate,
    effectiveShippingCost
  );

  const confidenceWeights = [
    returnSignals.confidence === "High" ? 1 : returnSignals.confidence === "Medium" ? 0.72 : 0.42,
    shippingSignals.confidence === "High" ? 1 : shippingSignals.confidence === "Medium" ? 0.72 : 0.42,
  ];
  if (input.channelType === "own_website") {
    confidenceWeights.push(cpaSignals.confidence === "High" ? 1 : cpaSignals.confidence === "Medium" ? 0.72 : 0.42);
  }
  const confidenceValue = round2(confidenceWeights.reduce((sum, value) => sum + value, 0) / confidenceWeights.length);
  const confidence =
    confidenceValue >= 0.78
      ? "High"
      : confidenceValue >= 0.52
        ? "Medium"
        : "Low";

  const notes = [
    returnSignals.note,
    input.channelType === "own_website" ? cpaSignals.note : null,
    shippingSignals.note,
  ].filter((note): note is string => Boolean(note));

  const sourceSummary = [
    `iade:${returnSignals.source}`,
    input.channelType === "own_website" ? `cpa:${cpaSignals.source}` : "cpa:marketplace",
    `kargo:${shippingSignals.source}`,
  ].join(" | ");

  const result: NetCostMlSignals = {
    ml_return_rate: round2(returnSignals.returnRate),
    ml_predicted_return_cost: round2(predictedReturnCost),
    ml_predicted_cpa: round2(Math.max(0, cpaSignals.cpa)),
    ml_shipping_multiplier: round2(shippingSignals.shippingMultiplier),
    ml_effective_shipping_cost: round2(effectiveShippingCost),
    ml_effective_desi: round2(shippingSignals.effectiveDesi),
    ml_confidence: confidence,
    ml_notes: notes.join(" "),
    ml_model_source: sourceSummary,
  };

  SIGNAL_CACHE.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: result,
  });

  return result;
}

export function clearNetCostMlSignalCache() {
  SIGNAL_CACHE.clear();
}
