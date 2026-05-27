import { calculateChannelCost } from "./cost-engine";
import { getOwnWebsiteGatewayRule, getProductMarketplaceSetting, getProducts } from "./database-readers";
import { getDb, query } from "./db";
import { requireCurrentAuthUserId } from "./tenant";
import type { Product } from "./types";

export type CampaignPlatformId = "meta" | "google_ads" | "tiktok";
export type CampaignHealthStatus = "stop" | "watch" | "scale";
export type CampaignMatchMethod = "utm_campaign" | "utm_source" | "campaign_id" | "derived";

type CampaignPlatformConfig = {
  id: CampaignPlatformId;
  label: string;
  roasTarget: number;
  ctr: number;
  conversionRate: number;
  repeatMultiplier: number;
  newCustomerShare: number;
  accent: string;
  hint: string;
};

type CampaignOrderRow = {
  order_id: number;
  order_date: string;
  quantity: number;
  line_total: number;
  product_id: number | null;
  product_name: string;
  sku: string | null;
  category_name: string | null;
  category_path: string | null;
  marketplace_id: number;
  marketplace_name: string;
  marketplace_slug: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  platform_reported_revenue: number | null;
  platform_reported_roas: number | null;
};

type CostResultRow = {
  product_id: number;
  marketplace_id: number;
  net_profit: number;
  total_unit_cost: number;
  unit_ad_cost: number;
  shipping_cost: number;
  commission_cost: number;
  platform_fee_cost: number;
  payment_gateway_cost: number;
};

type ProductSettingRow = {
  product_id: number;
  marketplace_id: number;
  sale_price: number | null;
  traffic_cpa: number | null;
  manual_shipping_cost: number | null;
  payment_gateway_rule_id: number | null;
  shipping_mode: string | null;
};

type CampaignAccumulator = {
  campaignId: string;
  campaignName: string;
  platform: CampaignPlatformId;
  platformLabel: string;
  utmSource: string;
  utmCampaign: string;
  matchMethod: CampaignMatchMethod;
  productId: number;
  productName: string;
  sku: string | null;
  orderIds: Set<number>;
  revenue: number;
  units: number;
  grossProfitBeforeSpend: number;
  baselineSpend: number;
  platformReportedRevenue: number;
  platformReportedRoas: number;
  cpaSamples: number[];
};

export type CampaignProfitMetric = {
  campaign_id: string;
  campaign_name: string;
  platform_slug: CampaignPlatformId;
  platform_label: string;
  utm_source: string;
  utm_campaign: string;
  window_start: string;
  window_end: string;
  spend: number;
  impressions: number;
  clicks: number;
  platform_reported_revenue: number;
  platform_reported_roas: number;
  attributed_orders: number;
  attributed_revenue: number;
  gross_profit: number;
  net_profit: number;
  roas: number;
  poas: number;
  new_customers: number;
  cac: number;
  predicted_ltv: number;
  ltv_cac_ratio: number;
  health_status: CampaignHealthStatus;
  action_label: string;
  match_method: CampaignMatchMethod;
  confidence_score: number;
  efficiency_gap: number;
  data_source: "derived" | "imported";
  last_calculated_at: string;
};

export type CampaignPipelineStage = {
  stage: string;
  description: string;
  detail: string;
  tone: "primary" | "warning" | "danger" | "muted";
};

export type AdAnalysisResponse = {
  success: true;
  analysisMode: "imported" | "simulated";
  dataSource: "imported" | "derived";
  coverageRatio: number;
  fallbackUsed: boolean;
  metricWindow: {
    start: string;
    end: string;
    days: number;
  };
  lastSyncedAt: string;
  methodology: string;
  summaryNote: string;
  totalCampaigns: number;
  visibleCampaigns: number;
  totalSpend: number;
  totalRevenue: number;
  totalNetProfit: number;
  totalGrossProfit: number;
  averagePoas: number;
  averageLtvCac: number;
  totalOrders: number;
  totalUnits: number;
  totalImpressions: number;
  totalClicks: number;
  lossMakingCount: number;
  watchCount: number;
  scaleCount: number;
  topRiskCampaigns: CampaignProfitMetric[];
  topScaleCampaigns: CampaignProfitMetric[];
  mostMisleadingCampaign: CampaignProfitMetric | null;
  featuredCampaigns: CampaignProfitMetric[];
  scatterCampaigns: CampaignProfitMetric[];
  pipeline: CampaignPipelineStage[];
  campaignMetrics: CampaignProfitMetric[];
};

export type AdAnalysisSummary = Pick<
  AdAnalysisResponse,
  "lastSyncedAt" | "totalCampaigns" | "totalSpend" | "totalNetProfit" | "averagePoas" | "lossMakingCount" | "watchCount" | "scaleCount" | "analysisMode" | "dataSource" | "coverageRatio" | "fallbackUsed"
>;

const PLATFORM_CONFIG: Record<CampaignPlatformId, CampaignPlatformConfig> = {
  meta: {
    id: "meta",
    label: "Sosyal Reklam",
    roasTarget: 7.3,
    ctr: 0.021,
    conversionRate: 0.026,
    repeatMultiplier: 2.8,
    newCustomerShare: 0.74,
    accent: "#38BDF8",
    hint: "Sosyal keşif ve yeniden hedefleme",
  },
  google_ads: {
    id: "google_ads",
    label: "Google Ads",
    roasTarget: 8.1,
    ctr: 0.031,
    conversionRate: 0.034,
    repeatMultiplier: 2.35,
    newCustomerShare: 0.64,
    accent: "#00D16F",
    hint: "Niyet odaklı arama trafiği",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok Ads",
    roasTarget: 5.6,
    ctr: 0.017,
    conversionRate: 0.021,
    repeatMultiplier: 1.75,
    newCustomerShare: 0.83,
    accent: "var(--warning)",
    hint: "Impuls ve kreatif odaklı hacim",
  },
};

const SOCIAL_KEYWORDS = /(saat|kolye|takı|aksesuar|bileklik|deri|vintage|stil|moda|giyim|şık)/i;
const GOOGLE_KEYWORDS = /(kulaklık|telefon|akıllı|elektronik|bluetooth|şarj|powerbank|kamera|termos|matara|teknoloji|ofis|home)/i;
const TIKTOK_KEYWORDS = /(trend|trendy|mini|max|fit|hediye|viral|sport|spor|lifestyle|genç|eğlence)/i;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function roundWhole(value: number) {
  return Math.max(0, Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildCampaignText(product: Pick<Product, "name" | "category_name" | "category_path">) {
  return `${product.name} ${product.category_name ?? ""} ${product.category_path ?? ""}`.trim();
}

function resolveCampaignBias(text: string, platform: CampaignPlatformId) {
  const hash = hashText(`${platform}:${text}`);
  const rawBias = 0.84 + (hash % 33) / 100;
  return clamp(rawBias, 0.82, 1.16);
}

function resolveCategoryLtvBias(text: string) {
  if (SOCIAL_KEYWORDS.test(text)) return 1.08;
  if (GOOGLE_KEYWORDS.test(text)) return 1.16;
  if (TIKTOK_KEYWORDS.test(text)) return 0.94;
  return 1;
}

export function resolveCampaignPlatformFromProduct(
  product: Pick<Product, "id" | "name" | "category_name" | "category_path">
): CampaignPlatformId {
  const text = buildCampaignText(product);
  const scores: Record<CampaignPlatformId, number> = {
    meta: 0,
    google_ads: 0,
    tiktok: 0,
  };

  if (SOCIAL_KEYWORDS.test(text)) scores.meta += 2;
  if (GOOGLE_KEYWORDS.test(text)) scores.google_ads += 2;
  if (TIKTOK_KEYWORDS.test(text)) scores.tiktok += 2;

  const tokens = text.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 4) continue;
    const normalized = token.toLowerCase();
    if (normalized.includes("saat") || normalized.includes("tak")) scores.meta += 0.5;
    if (normalized.includes("kulak") || normalized.includes("akilli") || normalized.includes("tech")) scores.google_ads += 0.5;
    if (normalized.includes("trend") || normalized.includes("mini") || normalized.includes("fit")) scores.tiktok += 0.5;
  }

  if (scores.meta === 0 && scores.google_ads === 0 && scores.tiktok === 0) {
    return (["meta", "google_ads", "tiktok"] as const)[product.id % 3];
  }

  return (Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "meta") as CampaignPlatformId;
}

function resolveCampaignName(platform: CampaignPlatformId, productName: string) {
  return `${PLATFORM_CONFIG[platform].label} · ${productName}`;
}

function resolveCampaignId(platform: CampaignPlatformId, product: Pick<Product, "id" | "name">) {
  return `${platform}:product-${product.id}`;
}

export function getCampaignPlatformConfig(platform: CampaignPlatformId) {
  return PLATFORM_CONFIG[platform];
}

async function getBaselineTrafficCpa(
  productId: number,
  settingMap?: Map<number, ProductSettingRow>,
  websiteGateway?: Awaited<ReturnType<typeof getOwnWebsiteGatewayRule>>
) {
  const productSetting = settingMap?.get(productId) ?? (await getProductMarketplaceSetting(productId, 3) as ProductSettingRow | null);
  if (productSetting?.traffic_cpa != null) {
    return round2(Number(productSetting.traffic_cpa));
  }

  const gateway = websiteGateway ?? await getOwnWebsiteGatewayRule();
  return round2(Number(gateway?.avg_ad_cost ?? 56.2));
}

async function getOwnWebsiteCostResult(product: Product) {
  const authUserId = requireCurrentAuthUserId();
  const row = (await query<CostResultRow>(
    `
      SELECT
        product_id,
        marketplace_id,
        net_profit,
        total_unit_cost,
        unit_ad_cost,
        shipping_cost,
        commission_cost,
        platform_fee_cost,
        payment_gateway_cost
      FROM cost_results
      WHERE product_id = ? AND marketplace_id = 3 AND user_id = ?
      LIMIT 1
    `,
    [product.id, authUserId]
  ))[0];

  if (row) {
    return row;
  }

  const productSetting = await getProductMarketplaceSetting(product.id, 3) as ProductSettingRow | null;
  const gateway = await getOwnWebsiteGatewayRule();
  const baselineCpa = await getBaselineTrafficCpa(product.id);

  const calculation = await calculateChannelCost("Kendi Websitem", {
    product,
    salePrice: Number(productSetting?.sale_price ?? product.sale_price ?? 0),
    manualShippingCost: Number(productSetting?.manual_shipping_cost ?? gateway?.manual_shipping_cost ?? 95),
    paymentGatewayRate: Number(gateway?.fee_rate_percent ?? 0),
    paymentGatewayFixedFee: Number(gateway?.fixed_fee_per_order ?? 0),
    adCost: 0,
    fixedCost: 0,
    trafficSettings: {
      mode: "manual_cpa",
      manualCpa: baselineCpa,
      monthlyAdBudget: 0,
      monthlyAdOrders: 1,
      averageCpc: 0,
      conversionRate: 0,
    },
    productSetting: productSetting as never,
  });

  return {
    product_id: product.id,
    marketplace_id: 3,
    net_profit: Number(calculation.net_profit ?? 0),
    total_unit_cost: Number(calculation.total_unit_cost ?? 0),
    unit_ad_cost: Number(calculation.unit_ad_cost ?? 0),
    shipping_cost: Number(calculation.shipping_cost ?? 0),
    commission_cost: Number(calculation.commission_cost ?? 0),
    platform_fee_cost: Number(calculation.platform_fee_cost ?? 0),
    payment_gateway_cost: Number(calculation.payment_gateway_cost ?? 0),
  };
}

async function getProductSettingMap() {
  const authUserId = requireCurrentAuthUserId();
  const rows = await query<ProductSettingRow>(
    `
      SELECT
        product_id,
        marketplace_id,
        sale_price,
        traffic_cpa,
        manual_shipping_cost,
        payment_gateway_rule_id,
        shipping_mode
      FROM product_marketplace_settings
      WHERE marketplace_id = 3 AND user_id = ?
    `
    ,
    [authUserId]
  );

  return new Map(rows.map((row) => [row.product_id, row]));
}

async function getProductMap() {
  return new Map((await getProducts()).map((product) => [product.id, product]));
}

function buildMetricWindow(windowDays: number) {
  const endDate = new Date();
  const startDate = addDays(endDate, -(Math.max(1, windowDays) - 1));
  return {
    start: toDateKey(startDate),
    end: toDateKey(endDate),
  };
}

function buildPipeline(): CampaignPipelineStage[] {
  return [
    {
      stage: "CSV yükleme",
      description: "Harcama verisi içeri alınır.",
      detail: "Sosyal reklam, Google Ads ve TikTok verileri ilk adımdır.",
      tone: "primary",
    },
    {
      stage: "Otomatik çekim",
      description: "Veri her gün güncellenir.",
      detail: "Platformlardan harcama, gösterim, tıklama ve gelir bilgisi toplanır.",
      tone: "muted",
    },
    {
      stage: "Sipariş eşleştirme",
      description: "Siparişler kampanyalara bağlanır.",
      detail: "Kampanya ve sipariş kodlarıyla gerçek satışlar atanır.",
      tone: "warning",
    },
    {
      stage: "Kâr hesabı",
      description: "Net kâr hesaplanır.",
      detail: "Ürün, kargo, komisyon, ödeme ve sabit giderler birlikte hesaplanır.",
      tone: "primary",
    },
    {
      stage: "Kâr tablosu",
      description: "Karar verisi yazılır.",
      detail: "Kâr oranı, müşteri değeri ve karar etiketleri bu tabloya yazılır; grafikler buradan beslenir.",
      tone: "warning",
    },
    {
      stage: "Bütçe uyarısı",
      description: "Gerekirse durdurulur.",
      detail: "Düşük performanslı kampanyalar için durdur ve bütçeyi kıs sinyali üretilebilir.",
      tone: "danger",
    },
  ];
}

function actionLabelForStatus(status: CampaignHealthStatus) {
  if (status === "stop") return "Durdur";
  if (status === "scale") return "Bütçe Artır";
  return "İzle";
}

function deriveStatus(poas: number, ltvCacRatio: number): CampaignHealthStatus {
  if (poas < 1 || ltvCacRatio < 1) return "stop";
  if (ltvCacRatio < 3) return "watch";
  return "scale";
}

function buildCampaignMetric(accumulator: CampaignAccumulator, windowStart: string, windowEnd: string): CampaignProfitMetric {
  const platform = PLATFORM_CONFIG[accumulator.platform];
  const orderCount = accumulator.orderIds.size;
  const revenue = round2(accumulator.revenue);
  const grossProfit = round2(accumulator.grossProfitBeforeSpend);

  const bias = resolveCampaignBias(`${accumulator.productId}:${accumulator.campaignId}`, accumulator.platform);
  const platformReportedRoas = round2(platform.roasTarget * bias);
  const spend = round2(revenue / Math.max(platformReportedRoas, 0.01));
  const netProfit = round2(grossProfit - spend);
  const roas = spend > 0 ? round2(revenue / spend) : 0;
  const poas = spend > 0 ? round2(netProfit / spend) : 0;

  const ltvBias = resolveCategoryLtvBias(`${accumulator.productName} ${accumulator.utmCampaign}`);
  const predictedLtv = round2((orderCount > 0 ? revenue / orderCount : revenue) * platform.repeatMultiplier * ltvBias);
  const newCustomers = Math.max(1, Math.round(orderCount * platform.newCustomerShare * clamp(bias, 0.84, 1.12)));
  const cac = round2(spend / Math.max(1, newCustomers));
  const ltvCacRatio = cac > 0 ? round2(predictedLtv / cac) : 0;
  const status = deriveStatus(poas, ltvCacRatio);
  const actionLabel = actionLabelForStatus(status);
  const matchMethod = accumulator.matchMethod;
  const clicks = Math.max(
    1,
    Math.round(newCustomers / Math.max(0.01, platform.conversionRate * clamp(bias, 0.85, 1.12)))
  );
  const impressions = Math.max(clicks, Math.round(clicks / Math.max(0.001, platform.ctr * clamp(bias, 0.85, 1.14))));
  const confidenceScore = round2(
    clamp(
      0.42 +
        Math.min(0.28, orderCount / 120) +
        Math.min(0.16, accumulator.units / 250) +
        (matchMethod === "derived" ? 0.05 : 0.12),
      0,
      0.98
    )
  );
  const efficiencyGap = round2(roas - poas);

  return {
    campaign_id: accumulator.campaignId,
    campaign_name: accumulator.campaignName,
    platform_slug: accumulator.platform,
    platform_label: platform.label,
    utm_source: accumulator.utmSource,
    utm_campaign: accumulator.utmCampaign,
    window_start: windowStart,
    window_end: windowEnd,
    spend,
    impressions,
    clicks,
    platform_reported_revenue: revenue,
    platform_reported_roas: platformReportedRoas,
    attributed_orders: orderCount,
    attributed_revenue: revenue,
    gross_profit: grossProfit,
    net_profit: netProfit,
    roas,
    poas,
    new_customers: newCustomers,
    cac,
    predicted_ltv: predictedLtv,
    ltv_cac_ratio: ltvCacRatio,
    health_status: status,
    action_label: actionLabel,
    match_method: matchMethod,
    confidence_score: confidenceScore,
    efficiency_gap: efficiencyGap,
    data_source: "derived",
    last_calculated_at: new Date().toISOString(),
  };
}

async function persistCampaignMetrics(rows: CampaignProfitMetric[]) {
  const db = getDb();
  if (!db) return false;
  const authUserId = requireCurrentAuthUserId();

  const insert = db.prepare(`
    INSERT INTO campaign_profit_metrics (
      user_id,
      campaign_id,
      campaign_name,
      platform_slug,
      platform_label,
      utm_source,
      utm_campaign,
      window_start,
      window_end,
      spend,
      impressions,
      clicks,
      platform_reported_revenue,
      platform_reported_roas,
      attributed_orders,
      attributed_revenue,
      gross_profit,
      net_profit,
      roas,
      poas,
      new_customers,
      cac,
      predicted_ltv,
      ltv_cac_ratio,
      health_status,
      action_label,
      match_method,
      confidence_score,
      efficiency_gap,
      data_source,
      last_calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await db.transaction(async () => {
    await db.prepare("DELETE FROM campaign_profit_metrics WHERE user_id = ?").run(authUserId);
    for (const row of rows) {
      await insert.run(
        authUserId,
        row.campaign_id,
        row.campaign_name,
        row.platform_slug,
        row.platform_label,
        row.utm_source,
        row.utm_campaign,
        row.window_start,
        row.window_end,
        row.spend,
        row.impressions,
        row.clicks,
        row.platform_reported_revenue,
        row.platform_reported_roas,
        row.attributed_orders,
        row.attributed_revenue,
        row.gross_profit,
        row.net_profit,
        row.roas,
        row.poas,
        row.new_customers,
        row.cac,
        row.predicted_ltv,
        row.ltv_cac_ratio,
        row.health_status,
        row.action_label,
        row.match_method,
        row.confidence_score,
        row.efficiency_gap,
        row.data_source,
        row.last_calculated_at
      );
    }
  });
  return true;
}

async function buildFallbackCostResult(product: Product) {
  return await getOwnWebsiteCostResult(product);
}

async function collectCampaignRows(windowStart: string, windowEnd: string) {
  const authUserId = requireCurrentAuthUserId();
  const productMap = await getProductMap();
  const settingMap = await getProductSettingMap();
  const websiteGateway = await getOwnWebsiteGatewayRule();
  const costMap = new Map<number, CostResultRow>();
  const baselineTrafficCpaMap = new Map<number, number>();
  const fallbackCostMap = new Map<number, CostResultRow>();
  const uniqueOrderIds = new Set<number>();

  const costRows = await query<CostResultRow>(
    `
      SELECT
        product_id,
        marketplace_id,
        net_profit,
        total_unit_cost,
        unit_ad_cost,
        shipping_cost,
        commission_cost,
        platform_fee_cost,
        payment_gateway_cost
      FROM cost_results
      WHERE marketplace_id = 3 AND user_id = ?
    `
    ,
    [authUserId]
  );

  for (const row of costRows) {
    costMap.set(row.product_id, row);
  }

  const orderRows = await query<CampaignOrderRow>(
    `
      SELECT
        o.order_id,
        o.order_date,
        COALESCE(oi.quantity, o.quantity, 1) AS quantity,
        COALESCE(oi.line_total, o.unit_price * COALESCE(oi.quantity, o.quantity, 1), 0) AS line_total,
        p.product_id,
        p.name AS product_name,
        p.sku,
        c.name AS category_name,
        COALESCE(p.category_path, c.path) AS category_path,
        o.marketplace_id,
        m.name AS marketplace_name,
        m.slug AS marketplace_slug,
        o.campaign_id,
        o.campaign_name,
        o.utm_source,
        o.utm_medium,
        o.utm_campaign,
        o.platform_reported_revenue,
        o.platform_reported_roas
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id AND oi.user_id = o.user_id
      JOIN products p ON p.product_id = COALESCE(oi.product_id, o.product_id) AND p.user_id = o.user_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      JOIN marketplaces m ON m.marketplace_id = o.marketplace_id
      WHERE o.user_id = ?
        AND o.status = 'completed'
        AND m.slug = 'own_website'
        AND o.order_date >= ?
        AND o.order_date <= ?
      ORDER BY o.order_date ASC, o.order_id ASC
    `,
    [authUserId, windowStart, windowEnd]
  );

  const accumulators = new Map<string, CampaignAccumulator>();
  let totalOrders = 0;
  let totalUnits = 0;

  for (const row of orderRows) {
    if (!row.product_id) continue;
    const product = productMap.get(row.product_id);
    if (!product) continue;

    const platform = resolveCampaignPlatformFromProduct(product);
    const platformConfig = getCampaignPlatformConfig(platform);
    const campaignId = row.campaign_id?.trim() || resolveCampaignId(platform, product);
    const campaignName = (row.campaign_name?.trim() || row.utm_campaign?.trim() || resolveCampaignName(platform, product.name));
    const utmSource = row.utm_source?.trim() || platform;
    const utmCampaign = row.utm_campaign?.trim() || `${slugify(product.name) || `product-${product.id}`}-${platform}`;
    const matchMethod: CampaignMatchMethod =
      row.campaign_id ? "campaign_id" : row.utm_campaign ? "utm_campaign" : row.utm_source ? "utm_source" : "derived";

    const existing = accumulators.get(campaignId) ?? {
      campaignId,
      campaignName,
      platform,
      platformLabel: platformConfig.label,
      utmSource,
      utmCampaign,
      matchMethod,
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? null,
      orderIds: new Set<number>(),
      revenue: 0,
      units: 0,
      grossProfitBeforeSpend: 0,
      baselineSpend: 0,
      platformReportedRevenue: 0,
      platformReportedRoas: 0,
      cpaSamples: [],
    };

    let baselineTrafficCpa = baselineTrafficCpaMap.get(product.id);
    if (baselineTrafficCpa == null) {
      baselineTrafficCpa = await getBaselineTrafficCpa(product.id, settingMap, websiteGateway ?? undefined);
      baselineTrafficCpaMap.set(product.id, baselineTrafficCpa);
    }

    let costResult = costMap.get(product.id);
    if (!costResult) {
      costResult = fallbackCostMap.get(product.id);
      if (!costResult) {
        costResult = await buildFallbackCostResult(product);
        fallbackCostMap.set(product.id, costResult);
      }
    }
    const baseNetProfitPerUnit = round2(Number(costResult.net_profit ?? 0));
    const quantity = Math.max(1, roundWhole(Number(row.quantity ?? 1)));
    const lineTotal = round2(Number(row.line_total ?? 0));
    const grossProfitBeforeSpend = round2((baseNetProfitPerUnit + baselineTrafficCpa) * quantity);

    existing.orderIds.add(row.order_id);
    uniqueOrderIds.add(row.order_id);
    existing.revenue = round2(existing.revenue + lineTotal);
    existing.units += quantity;
    existing.grossProfitBeforeSpend = round2(existing.grossProfitBeforeSpend + grossProfitBeforeSpend);
    existing.baselineSpend = round2(existing.baselineSpend + baselineTrafficCpa * quantity);
    existing.platformReportedRevenue = round2(existing.platformReportedRevenue + lineTotal);
    existing.cpaSamples.push(baselineTrafficCpa);
    accumulators.set(campaignId, existing);

    totalUnits += quantity;
  }

  const windowStartDate = windowStart;
  const windowEndDate = windowEnd;
  const campaignRows = Array.from(accumulators.values()).map((accumulator) => buildCampaignMetric(accumulator, windowStartDate, windowEndDate));
  totalOrders = uniqueOrderIds.size;

  const persisted = await persistCampaignMetrics(campaignRows);
  const lastSyncedAt = campaignRows.length > 0 ? campaignRows[0].last_calculated_at : new Date().toISOString();

  return {
    campaignRows,
    lastSyncedAt,
    windowStart,
    windowEnd,
    windowDays: Math.max(1, Math.round((new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86_400_000) + 1),
    totalOrders,
    totalUnits: roundWhole(totalUnits),
    persisted,
  };
}

export async function buildAdAnalysis(windowDays = 30): Promise<AdAnalysisResponse | null> {
  const db = getDb();
  if (!db) return null;
  const authUserId = requireCurrentAuthUserId();

  const productCountRow = await db.prepare("SELECT COUNT(*) AS count FROM products WHERE user_id = ?").get(authUserId) as { count: number };
  if ((productCountRow?.count ?? 0) === 0) {
    return null;
  }

  const metricWindow = buildMetricWindow(windowDays);
  const { campaignRows, lastSyncedAt, windowStart, windowEnd, windowDays: resolvedWindowDays, totalOrders, totalUnits } = await collectCampaignRows(metricWindow.start, metricWindow.end);
  if (campaignRows.length === 0) {
    return null;
  }

  const sortedCampaigns = [...campaignRows].sort((left, right) => {
    const severityOrder: Record<CampaignHealthStatus, number> = { stop: 0, watch: 1, scale: 2 };
    const severityDelta = severityOrder[left.health_status] - severityOrder[right.health_status];
    if (severityDelta !== 0) return severityDelta;
    return right.spend - left.spend;
  });

  const totalSpend = round2(campaignRows.reduce((sum, row) => sum + row.spend, 0));
  const totalRevenue = round2(campaignRows.reduce((sum, row) => sum + row.platform_reported_revenue, 0));
  const totalNetProfit = round2(campaignRows.reduce((sum, row) => sum + row.net_profit, 0));
  const totalGrossProfit = round2(campaignRows.reduce((sum, row) => sum + row.gross_profit, 0));
  const totalImpressions = Math.round(campaignRows.reduce((sum, row) => sum + row.impressions, 0));
  const totalClicks = Math.round(campaignRows.reduce((sum, row) => sum + row.clicks, 0));
  const averagePoas = totalSpend > 0 ? round2(totalNetProfit / totalSpend) : 0;
  const averageLtvCac = totalSpend > 0
    ? round2(campaignRows.reduce((sum, row) => sum + row.predicted_ltv, 0) / Math.max(1, campaignRows.reduce((sum, row) => sum + row.cac, 0)))
    : 0;

  const lossMakingCount = campaignRows.filter((row) => row.health_status === "stop").length;
  const watchCount = campaignRows.filter((row) => row.health_status === "watch").length;
  const scaleCount = campaignRows.filter((row) => row.health_status === "scale").length;

  const topRiskCampaigns = [...campaignRows]
    .filter((row) => row.health_status === "stop")
    .sort((left, right) => right.spend - left.spend)
    .slice(0, 3);

  const topScaleCampaigns = [...campaignRows]
    .filter((row) => row.health_status === "scale")
    .sort((left, right) => right.ltv_cac_ratio - left.ltv_cac_ratio)
    .slice(0, 3);

  const mostMisleadingCampaign = [...campaignRows].reduce<CampaignProfitMetric | null>((best, current) => {
    if (!best) return current;
    const bestGap = best.efficiency_gap;
    const currentGap = current.efficiency_gap;
    return currentGap > bestGap ? current : best;
  }, null);

  const featuredCampaigns = [...sortedCampaigns].slice(0, 12);
  const scatterCampaigns = [...sortedCampaigns].slice(0, 10);

  return {
    success: true,
    analysisMode: "simulated",
    dataSource: "derived",
    coverageRatio: 0,
    fallbackUsed: false,
    metricWindow: {
      start: windowStart,
      end: windowEnd,
      days: resolvedWindowDays,
    },
    lastSyncedAt,
    methodology:
      "Harcama, sipariş ve maliyet birlikte okunur. Kârlı ve riskli kampanyalar bu veriye göre ayrılır.",
    summaryNote:
      "Görünen performans ile gerçek kâr farklı olabilir. Karar etiketi kâr oranı ve müşteri değeri eşiklerine göre oluşur.",
    totalCampaigns: campaignRows.length,
    visibleCampaigns: featuredCampaigns.length,
    totalSpend,
    totalRevenue,
    totalNetProfit,
    totalGrossProfit,
    averagePoas,
    averageLtvCac,
    totalOrders,
    totalUnits,
    totalImpressions,
    totalClicks,
    lossMakingCount,
    watchCount,
    scaleCount,
    topRiskCampaigns,
    topScaleCampaigns,
    mostMisleadingCampaign,
    featuredCampaigns,
    scatterCampaigns,
    pipeline: buildPipeline(),
    campaignMetrics: campaignRows,
  };
}

export async function buildAdAnalysisSummary(): Promise<AdAnalysisSummary | null> {
  const db = getDb();
  if (!db) return null;
  const authUserId = requireCurrentAuthUserId();

  const summary = await db.prepare(`
    SELECT
      COUNT(*)::int AS total_campaigns,
      COUNT(*) FILTER (WHERE data_source = 'imported')::int AS imported_campaigns,
      COALESCE(SUM(spend), 0) AS total_spend,
      COALESCE(SUM(net_profit), 0) AS total_net_profit,
      COALESCE(AVG(poas), 0) AS average_poas,
      COUNT(*) FILTER (WHERE health_status = 'stop')::int AS loss_making_count,
      COUNT(*) FILTER (WHERE health_status = 'watch')::int AS watch_count,
      COUNT(*) FILTER (WHERE health_status = 'scale')::int AS scale_count,
      MAX(last_calculated_at) AS last_synced_at
    FROM campaign_profit_metrics
    WHERE user_id = ?
  `).get(authUserId) as {
    total_campaigns: number | null;
    imported_campaigns: number | null;
    total_spend: number | null;
    total_net_profit: number | null;
    average_poas: number | null;
    loss_making_count: number | null;
    watch_count: number | null;
    scale_count: number | null;
    last_synced_at: string | null;
  } | undefined;

  if (!summary || Number(summary.total_campaigns ?? 0) === 0) {
    return null;
  }

  return {
    totalCampaigns: Number(summary.total_campaigns ?? 0),
    totalSpend: round2(Number(summary.total_spend ?? 0)),
    totalNetProfit: round2(Number(summary.total_net_profit ?? 0)),
    averagePoas: round2(Number(summary.average_poas ?? 0)),
    lossMakingCount: Number(summary.loss_making_count ?? 0),
    watchCount: Number(summary.watch_count ?? 0),
    scaleCount: Number(summary.scale_count ?? 0),
    lastSyncedAt: summary.last_synced_at ?? new Date().toISOString(),
    analysisMode: Number(summary.imported_campaigns ?? 0) > 0 ? "imported" : "simulated",
    dataSource: Number(summary.imported_campaigns ?? 0) > 0 ? "imported" : "derived",
    coverageRatio: Number(summary.total_campaigns ?? 0) > 0
      ? round2(Number(summary.imported_campaigns ?? 0) / Number(summary.total_campaigns ?? 0))
      : 0,
    fallbackUsed: false,
  };
}

export async function refreshCampaignProfitMetrics(windowDays = 30) {
  return await buildAdAnalysis(windowDays);
}
