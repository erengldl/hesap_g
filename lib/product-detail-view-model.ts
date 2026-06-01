export type ProductDetailTrendPoint = {
  date: string;
  label: string;
  units: number;
  revenue: number;
  order_count: number;
};

export type ProductDetailSalesSummary = {
  totalUnits: number;
  totalRevenue: number;
  activeDays: number;
  avgDailyUnits: number;
  peakDay: { date: string; units: number } | null;
};

export type ProductDetailResponse = {
  success: boolean;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    categoryPath?: string | null;
    categoryName?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    cost: number;
    packagingCost: number;
    desi: number;
    status?: string | null;
    stock?: number | null;
  };
  channels?: Array<{
    channelName: string;
    slug: string;
    salePrice: number | null;
    buyboxPrice?: number | null;
    shipping?: number | null;
    commission?: number | null;
    totalCost: number;
    netProfit: number;
    margin: number;
    warningNotes?: string | null;
  }>;
  salesTrend30?: ProductDetailTrendPoint[];
  salesTrend90?: ProductDetailTrendPoint[];
  salesSummary30?: ProductDetailSalesSummary;
  salesSummary90?: ProductDetailSalesSummary;
};

export type ProductDetailTone = "profit" | "warning" | "loss" | "neutral";

export type ProductDetailActionId = "edit" | "optimize" | "forecast" | "seo";

type ProductDetailAction = {
  id: ProductDetailActionId;
  label: string;
  href: string;
  tone: ProductDetailTone;
  emphasis: "primary" | "secondary";
};

type ProductDetailChecklistItem = {
  id: string;
  label: string;
  ready: boolean;
  tone: ProductDetailTone;
  hint: string;
  actionLabel: string;
  href: string;
};

type ProductDetailSeoItem = {
  id: string;
  label: string;
  score: number;
  tone: ProductDetailTone;
  detail: string;
};

type ProductDetailChannelCard = {
  id: string;
  label: string;
  isActive: boolean;
  tone: ProductDetailTone;
  toneLabel: string;
  salePrice: number | null;
  buyboxPrice: number | null;
  shippingCost: number | null;
  commissionCost: number | null;
  netProfit: number | null;
  margin: number | null;
  totalCost: number | null;
  warningNotes: string | null;
  href: string;
  actionLabel: string;
};

type ProductDetailBreakdownItem = {
  id: string;
  label: string;
  value: number;
  shareOfPrice: number;
  tone: ProductDetailTone;
};

type ProductDetailTrendRow = ProductDetailTrendPoint & {
  estimatedProfit: number;
};

export type ProductDetailViewModel = {
  productId: number;
  title: string;
  sku: string;
  imageUrl: string | null;
  category: string;
  description: string;
  status: {
    label: string;
    tone: ProductDetailTone;
  };
  activeChannelLabels: string[];
  actions: ProductDetailAction[];
  nextActionId: ProductDetailActionId;
  nextAction: ProductDetailAction;
  recommendationTitle: string;
  recommendationSummary: string;
  recommendationReasons: string[];
  topSummary: Array<{
    id: string;
    label: string;
    value: number | string;
    caption: string;
    tone: ProductDetailTone;
    kind: "currency" | "percent" | "text";
  }>;
  financialBreakdown: ProductDetailBreakdownItem[];
  financialHighlights: Array<{
    id: string;
    label: string;
    value: number | string;
    caption: string;
    tone: ProductDetailTone;
    kind: "currency" | "percent" | "text";
  }>;
  channelCards: ProductDetailChannelCard[];
  trend30: ProductDetailTrendRow[];
  trend90: ProductDetailTrendRow[];
  trendSummaries: {
    30: ProductDetailSalesSummary | null;
    90: ProductDetailSalesSummary | null;
  };
  stockRisk: {
    tone: ProductDetailTone;
    label: string;
    coverageDays: number | null;
    coverageCaption: string;
    stockOnHand: number;
    avgDailyUnits: number;
    momentumPercent: number | null;
    momentumLabel: string;
    riskNote: string;
    actionLabel: string;
    href: string;
  };
  seoReadiness: {
    score: number;
    label: string;
    tone: ProductDetailTone;
    summary: string;
    items: ProductDetailSeoItem[];
    href: string;
  };
  completeness: {
    readyCount: number;
    totalCount: number;
    percent: number;
    tone: ProductDetailTone;
    summary: string;
    items: ProductDetailChecklistItem[];
  };
};

const CANONICAL_CHANNELS = [
  {
    id: "trendyol",
    label: "Trendyol",
    matchers: ["trendyol"],
  },
  {
    id: "hepsiburada",
    label: "Hepsiburada",
    matchers: ["hepsiburada"],
  },
  {
    id: "own-website",
    label: "Own Website",
    matchers: ["own_website", "my_website", "kendi websitem"],
  },
] as const;

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeChannelKey(value: string) {
  return value.trim().toLowerCase();
}

function statusMeta(status?: string | null) {
  switch (status) {
    case "active":
      return { label: "Active", tone: "profit" as const };
    case "draft":
      return { label: "Draft", tone: "warning" as const };
    case "passive":
      return { label: "Passive", tone: "neutral" as const };
    default:
      return { label: "Unknown", tone: "neutral" as const };
  }
}

function toneLabel(tone: ProductDetailTone, fallback = "Inactive") {
  switch (tone) {
    case "profit":
      return "Profitable";
    case "warning":
      return "Risky";
    case "loss":
      return "Loss";
    default:
      return fallback;
  }
}

function channelTone(isActive: boolean, netProfit: number | null, margin: number | null) {
  if (!isActive) {
    return "neutral" as const;
  }

  if (toNumber(netProfit) <= 0 || toNumber(margin) <= 0) {
    return "loss" as const;
  }

  if (toNumber(margin) < 15) {
    return "warning" as const;
  }

  return "profit" as const;
}

function buildCanonicalChannels(response: ProductDetailResponse, productId: number) {
  const incoming = response.channels ?? [];
  const normalized = new Map(
    incoming.map((channel) => [
      normalizeChannelKey(channel.slug || channel.channelName),
      channel,
    ])
  );

  return CANONICAL_CHANNELS.map((definition) => {
    const match = definition.matchers
      .map((matcher) => normalized.get(normalizeChannelKey(matcher)))
      .find(Boolean)
      ?? incoming.find((channel) => definition.matchers.some((matcher) => matcher === normalizeChannelKey(channel.channelName)));

    const isActive = Boolean(match);
    const tone = channelTone(isActive, match?.netProfit ?? null, match?.margin ?? null);

    return {
      id: definition.id,
      label: definition.label,
      isActive,
      tone,
      toneLabel: toneLabel(tone),
      salePrice: match?.salePrice ?? null,
      buyboxPrice: match?.buyboxPrice ?? null,
      shippingCost: match?.shipping ?? null,
      commissionCost: match?.commission ?? null,
      netProfit: match?.netProfit ?? null,
      margin: match?.margin ?? null,
      totalCost: match?.totalCost ?? null,
      warningNotes: match?.warningNotes ?? null,
      href: match ? `/profit-pricing?productId=${productId}` : "/veri-merkezi",
      actionLabel: match ? "Optimize Price" : "Edit Product",
    } satisfies ProductDetailChannelCard;
  });
}

function buildTrendSeries(points: ProductDetailTrendPoint[], marginPercent: number) {
  return points.map((point) => ({
    ...point,
    estimatedProfit: round2(toNumber(point.revenue) * (marginPercent / 100)),
  }));
}

function buildStockRisk(response: ProductDetailResponse) {
  const stockOnHand = Math.max(0, Math.round(toNumber(response.product?.stock)));
  const avgDailyUnits = round2(toNumber(response.salesSummary30?.avgDailyUnits));
  const trendPoints = response.salesTrend30 ?? [];
  const recentWindow = trendPoints.slice(-7);
  const previousWindow = trendPoints.slice(-14, -7);
  const recentAverage = recentWindow.length > 0 ? average(recentWindow.map((row) => row.units)) : 0;
  const baselineAverage = previousWindow.length > 0 ? average(previousWindow.map((row) => row.units)) : avgDailyUnits;
  const hasDemandSignal = avgDailyUnits > 0;
  const momentumPercent =
    hasDemandSignal && baselineAverage > 0 ? round2(((recentAverage - baselineAverage) / baselineAverage) * 100) : null;
  const coverageDays = hasDemandSignal ? round2(stockOnHand / avgDailyUnits) : null;
  const adjustedCoverage = coverageDays !== null && momentumPercent !== null && momentumPercent > 20
    ? coverageDays * 0.82
    : coverageDays;

  let tone: ProductDetailTone = "neutral";
  let label = "Need history";
  let riskNote = "Demand signal appears after sales history starts syncing.";

  if (stockOnHand <= 0) {
    tone = "loss";
    label = "Out of stock";
    riskNote = "No sellable stock is available across the latest inventory snapshot.";
  } else if (adjustedCoverage !== null && adjustedCoverage < 14) {
    tone = "loss";
    label = "Critical";
    riskNote = "Current run rate can deplete stock in under two weeks.";
  } else if (adjustedCoverage !== null && adjustedCoverage < 30) {
    tone = "warning";
    label = "Watch";
    riskNote = "Demand is healthy, but coverage is tight for a normal purchase cycle.";
  } else if (adjustedCoverage !== null) {
    tone = "profit";
    label = "Covered";
    riskNote = "Stock coverage is healthy for the last 30-day sales pace.";
  }

  const momentumLabel =
    momentumPercent === null
      ? "No demand trend"
      : momentumPercent >= 12
        ? "Demand rising"
        : momentumPercent <= -12
          ? "Demand cooling"
          : "Demand stable";

  return {
    tone,
    label,
    coverageDays,
    coverageCaption:
      coverageDays === null
        ? "Need sales history"
        : `${Math.max(1, Math.round(coverageDays))} days of cover at the current pace`,
    stockOnHand,
    avgDailyUnits,
    momentumPercent,
    momentumLabel,
    riskNote,
    actionLabel: "View Forecast",
    href: `/forecast?productId=${response.product?.id ?? 0}`,
  };
}

function buildSeoReadiness(
  response: ProductDetailResponse,
  activeChannelCount: number
): ProductDetailViewModel["seoReadiness"] {
  const product = response.product;
  const nameLength = product?.name.trim().length ?? 0;
  const descriptionLength = product?.description?.trim().length ?? 0;
  const hasImage = Boolean(product?.imageUrl);
  const hasCategory = Boolean(product?.categoryPath || product?.categoryName);
  const hasSku = Boolean(product?.sku);
  const hasBarcode = Boolean(product?.barcode);

  const items: ProductDetailSeoItem[] = [
    {
      id: "title",
      label: "Title clarity",
      score: nameLength >= 28 && nameLength <= 72 ? 20 : nameLength >= 18 ? 12 : 4,
      tone: nameLength >= 28 && nameLength <= 72 ? "profit" : nameLength >= 18 ? "warning" : "loss",
      detail: nameLength >= 28 && nameLength <= 72 ? "Title length is search-friendly." : nameLength >= 18 ? "Title is usable but could be sharper." : "Title is too short for strong search intent.",
    },
    {
      id: "description",
      label: "Description depth",
      score: descriptionLength >= 160 ? 30 : descriptionLength >= 90 ? 18 : 6,
      tone: descriptionLength >= 160 ? "profit" : descriptionLength >= 90 ? "warning" : "loss",
      detail: descriptionLength >= 160 ? "Description supports both SEO and conversion." : descriptionLength >= 90 ? "Description exists but lacks depth." : "Description is too thin for discovery and persuasion.",
    },
    {
      id: "image",
      label: "Primary image",
      score: hasImage ? 15 : 0,
      tone: hasImage ? "profit" : "loss",
      detail: hasImage ? "Primary visual is present." : "The product still needs a hero image.",
    },
    {
      id: "taxonomy",
      label: "Category mapping",
      score: hasCategory ? 20 : 0,
      tone: hasCategory ? "profit" : "loss",
      detail: hasCategory ? "Category and taxonomy data are available." : "Category metadata is missing.",
    },
    {
      id: "identifiers",
      label: "Product identifiers",
      score: hasSku && hasBarcode ? 15 : hasSku || hasBarcode ? 8 : 0,
      tone: hasSku && hasBarcode ? "profit" : hasSku || hasBarcode ? "warning" : "loss",
      detail: hasSku && hasBarcode ? "SKU and barcode are both available." : hasSku || hasBarcode ? "One of SKU or barcode is still missing." : "Identifiers are incomplete for listing quality.",
    },
  ];

  const baseScore = items.reduce((sum, item) => sum + item.score, 0);
  const channelCoverageBonus = activeChannelCount >= 3 ? 5 : activeChannelCount >= 2 ? 2 : 0;
  const score = clamp(baseScore + channelCoverageBonus, 0, 100);
  const tone: ProductDetailTone = score >= 80 ? "profit" : score >= 60 ? "warning" : "loss";
  const label = score >= 80 ? "Ready" : score >= 60 ? "Needs polish" : "Weak";
  const summary =
    tone === "profit"
      ? "Content quality is strong enough to publish or scale across channels."
      : tone === "warning"
        ? "The product can rank and convert better with sharper content coverage."
        : "Content gaps are limiting discoverability and listing confidence.";

  return {
    score,
    label,
    tone,
    summary,
    items,
    href: `/channel-seo?productId=${response.product?.id ?? 0}`,
  };
}

function buildCompleteness(
  response: ProductDetailResponse,
  channelCards: ProductDetailChannelCard[],
  seoReadiness: ProductDetailViewModel["seoReadiness"]
): ProductDetailViewModel["completeness"] {
  const productId = response.product?.id ?? 0;
  const stock = Math.max(0, Math.round(toNumber(response.product?.stock)));
  const costEntered = toNumber(response.product?.cost) > 0;
  const packagingEntered = toNumber(response.product?.packagingCost) > 0;
  const activeCards = channelCards.filter((card) => card.isActive);
  const channelPricesEntered = activeCards.length > 0 && activeCards.every((card) => toNumber(card.salePrice) > 0);
  const salesHistoryAvailable = toNumber(response.salesSummary30?.totalUnits) > 0;
  const seoReady = seoReadiness.score >= 80;

  const items: ProductDetailChecklistItem[] = [
    {
      id: "cost",
      label: "Cost entered",
      ready: costEntered,
      tone: costEntered ? "profit" : "loss",
      hint: costEntered ? "Product cost is available for margin math." : "Base cost is required before trusting profit outputs.",
      actionLabel: "Edit Product",
      href: "/veri-merkezi",
    },
    {
      id: "packaging",
      label: "Packaging cost entered",
      ready: packagingEntered,
      tone: packagingEntered ? "profit" : "warning",
      hint: packagingEntered ? "Packaging is contributing to total cost correctly." : "Packaging cost is still estimated as zero.",
      actionLabel: "Edit Product",
      href: "/veri-merkezi",
    },
    {
      id: "channel-prices",
      label: "Channel prices entered",
      ready: channelPricesEntered,
      tone: channelPricesEntered ? "profit" : "loss",
      hint: channelPricesEntered ? "Active channels all have price coverage." : "One or more active channels still miss a sale price.",
      actionLabel: "Edit Product",
      href: "/veri-merkezi",
    },
    {
      id: "stock",
      label: "Stock available",
      ready: stock > 0,
      tone: stock > 0 ? "profit" : "loss",
      hint: stock > 0 ? "Inventory is available for sale." : "No available stock is recorded.",
      actionLabel: "View Forecast",
      href: `/forecast?productId=${productId}`,
    },
    {
      id: "sales-history",
      label: "Sales history available",
      ready: salesHistoryAvailable,
      tone: salesHistoryAvailable ? "profit" : "warning",
      hint: salesHistoryAvailable ? "Demand and trend analysis can be trusted." : "Trend sections stay shallow until sales history syncs.",
      actionLabel: "Edit Product",
      href: "/veri-merkezi",
    },
    {
      id: "seo-content",
      label: "SEO content ready",
      ready: seoReady,
      tone: seoReady ? "profit" : "warning",
      hint: seoReady ? "Content is ready for search-facing channel work." : "SEO content still needs strengthening.",
      actionLabel: "Generate SEO",
      href: `/channel-seo?productId=${productId}`,
    },
  ];

  const readyCount = items.filter((item) => item.ready).length;
  const percent = Math.round((readyCount / items.length) * 100);
  const tone: ProductDetailTone = percent >= 84 ? "profit" : percent >= 50 ? "warning" : "loss";
  const summary =
    tone === "profit"
      ? "The product is operationally complete and ready for optimization."
      : tone === "warning"
        ? "A few missing inputs still weaken the quality of decisions."
        : "Critical gaps are blocking confident profitability analysis.";

  return {
    readyCount,
    totalCount: items.length,
    percent,
    tone,
    summary,
    items,
  };
}

function pickNextAction(
  response: ProductDetailResponse,
  channelCards: ProductDetailChannelCard[],
  stockRisk: ProductDetailViewModel["stockRisk"],
  seoReadiness: ProductDetailViewModel["seoReadiness"],
  completeness: ProductDetailViewModel["completeness"]
) {
  const hasCriticalCompletenessGap = completeness.items.some((item) => !item.ready && (item.tone === "loss" || item.id === "sales-history"));
  const hasMarginIssue = channelCards.some((card) => card.isActive && (toNumber(card.netProfit) <= 0 || toNumber(card.margin) < 15));

  if (hasCriticalCompletenessGap) {
    return "edit" as const;
  }

  if (hasMarginIssue) {
    return "optimize" as const;
  }

  if (stockRisk.tone === "warning" || stockRisk.tone === "loss") {
    return "forecast" as const;
  }

  if (seoReadiness.score < 80) {
    return "seo" as const;
  }

  return "optimize" as const;
}

function buildActions(productId: number, nextActionId: ProductDetailActionId): ProductDetailAction[] {
  const actions: ProductDetailAction[] = [
    {
      id: "edit",
      label: "Edit Product",
      href: "/veri-merkezi",
      tone: "neutral",
      emphasis: nextActionId === "edit" ? "primary" : "secondary",
    },
    {
      id: "optimize",
      label: "Optimize Price",
      href: `/profit-pricing?productId=${productId}`,
      tone: "profit",
      emphasis: nextActionId === "optimize" ? "primary" : "secondary",
    },
    {
      id: "forecast",
      label: "View Forecast",
      href: `/forecast?productId=${productId}`,
      tone: "warning",
      emphasis: nextActionId === "forecast" ? "primary" : "secondary",
    },
    {
      id: "seo",
      label: "Generate SEO",
      href: `/channel-seo?productId=${productId}`,
      tone: "neutral",
      emphasis: nextActionId === "seo" ? "primary" : "secondary",
    },
  ];

  return actions;
}

function buildRecommendation(
  nextActionId: ProductDetailActionId,
  channelCards: ProductDetailChannelCard[],
  stockRisk: ProductDetailViewModel["stockRisk"],
  seoReadiness: ProductDetailViewModel["seoReadiness"],
  completeness: ProductDetailViewModel["completeness"]
) {
  const weakestChannel = [...channelCards]
    .filter((card) => card.isActive)
    .sort((left, right) => toNumber(left.margin) - toNumber(right.margin))[0];
  const missingItems = completeness.items.filter((item) => !item.ready).slice(0, 3);

  if (nextActionId === "edit") {
    return {
      title: "Fix missing product inputs first",
      summary: "The financial picture is incomplete, so pricing and forecast outputs are still partially unreliable.",
      reasons: missingItems.map((item) => item.label),
    };
  }

  if (nextActionId === "forecast") {
    return {
      title: "Review stock coverage before the next replenishment cycle",
      summary: stockRisk.riskNote,
      reasons: [
        stockRisk.coverageCaption,
        stockRisk.momentumLabel,
      ],
    };
  }

  if (nextActionId === "seo") {
    return {
      title: "Commercials look stable, but discoverability is lagging",
      summary: seoReadiness.summary,
      reasons: seoReadiness.items.filter((item) => item.tone !== "profit").map((item) => item.label).slice(0, 3),
    };
  }

  return {
    title: "Margin optimization should happen before scale",
    summary:
      weakestChannel
        ? `${weakestChannel.label} is the weakest active channel and is compressing blended profitability.`
        : "Channel profitability is uneven and should be tightened before more spend is deployed.",
    reasons: [
      weakestChannel ? `${weakestChannel.label} margin is below target.` : "At least one active channel is below target margin.",
      "Price, buybox pressure, and variable costs are the main levers.",
    ],
  };
}

export function buildProductDetailViewModel(response: ProductDetailResponse): ProductDetailViewModel | null {
  if (!response.product) {
    return null;
  }

  const product = response.product;
  const productId = product.id;
  const status = statusMeta(product.status);
  const channelCards = buildCanonicalChannels(response, productId);
  const activeChannels = channelCards.filter((card) => card.isActive);
  const activeChannelLabels = activeChannels.map((card) => card.label);
  const salePrices = activeChannels.map((card) => toNumber(card.salePrice)).filter((value) => value > 0);
  const totalCosts = activeChannels.map((card) => toNumber(card.totalCost)).filter((value) => value > 0);
  const netProfits = activeChannels.map((card) => toNumber(card.netProfit));
  const margins = activeChannels.map((card) => toNumber(card.margin));
  const shippingCosts = activeChannels.map((card) => toNumber(card.shippingCost));
  const commissionCosts = activeChannels.map((card) => toNumber(card.commissionCost));
  const referencePrice = average(salePrices);
  const averageUnitCost = average(totalCosts);
  const blendedNetProfit = average(netProfits);
  const blendedMargin = average(margins);
  const averageShipping = average(shippingCosts);
  const averageCommission = average(commissionCosts);
  const variableOtherFees = Math.max(
    0,
    averageUnitCost - toNumber(product.cost) - toNumber(product.packagingCost) - averageShipping - averageCommission
  );
  const bestChannel = [...activeChannels].sort((left, right) => toNumber(right.margin) - toNumber(left.margin))[0] ?? null;
  const weakestChannel = [...activeChannels].sort((left, right) => toNumber(left.margin) - toNumber(right.margin))[0] ?? null;
  const marginSpread = bestChannel && weakestChannel ? round2(toNumber(bestChannel.margin) - toNumber(weakestChannel.margin)) : 0;
  const priceSpread = salePrices.length > 0 ? round2(Math.max(...salePrices) - Math.min(...salePrices)) : 0;
  const buyboxGaps = activeChannels
    .filter((card) => toNumber(card.buyboxPrice) > 0 && toNumber(card.salePrice) > 0)
    .map((card) => round2(toNumber(card.salePrice) - toNumber(card.buyboxPrice)));
  const averageBuyboxGap = average(buyboxGaps);

  const stockRisk = buildStockRisk(response);
  const seoReadiness = buildSeoReadiness(response, activeChannels.length);
  const completeness = buildCompleteness(response, channelCards, seoReadiness);
  const nextActionId = pickNextAction(response, channelCards, stockRisk, seoReadiness, completeness);
  const actions = buildActions(productId, nextActionId);
  const nextAction = actions.find((action) => action.id === nextActionId) ?? actions.at(0)!;
  const recommendation = buildRecommendation(nextActionId, channelCards, stockRisk, seoReadiness, completeness);

  return {
    productId,
    title: product.name,
    sku: product.sku?.trim() || "No SKU",
    imageUrl: product.imageUrl ?? null,
    category: product.categoryPath?.trim() || product.categoryName?.trim() || "Uncategorized",
    description: product.description?.trim() || "No product description is available yet.",
    status,
    activeChannelLabels,
    actions,
    nextActionId,
    nextAction,
    recommendationTitle: recommendation.title,
    recommendationSummary: recommendation.summary,
    recommendationReasons: recommendation.reasons,
    topSummary: [
      {
        id: "sale-price",
        label: "Sale Price",
        value: round2(referencePrice),
        caption: activeChannels.length > 0 ? `${activeChannels.length} active channels average` : "No active channel price",
        tone: "neutral",
        kind: "currency",
      },
      {
        id: "unit-cost",
        label: "Unit Cost",
        value: round2(averageUnitCost),
        caption: "Blended channel cost",
        tone: "neutral",
        kind: "currency",
      },
      {
        id: "net-profit",
        label: "Net Profit",
        value: round2(blendedNetProfit),
        caption: bestChannel ? `Best channel ${bestChannel.label}: ${toneLabel(bestChannel.tone)}` : "No active channel",
        tone: blendedNetProfit <= 0 ? "loss" : blendedMargin < 15 ? "warning" : "profit",
        kind: "currency",
      },
      {
        id: "margin",
        label: "Margin",
        value: round2(blendedMargin),
        caption: marginSpread > 0 ? `${marginSpread.toFixed(1)} pts spread between channels` : "Single channel view",
        tone: blendedMargin <= 0 ? "loss" : blendedMargin < 15 ? "warning" : "profit",
        kind: "percent",
      },
      {
        id: "stock-risk",
        label: "Stock Risk",
        value: stockRisk.label,
        caption: stockRisk.coverageCaption,
        tone: stockRisk.tone,
        kind: "text",
      },
    ],
    financialBreakdown: [
      {
        id: "product-cost",
        label: "Product cost",
        value: toNumber(product.cost),
        shareOfPrice: referencePrice > 0 ? (toNumber(product.cost) / referencePrice) * 100 : 0,
        tone: "neutral",
      },
      {
        id: "packaging",
        label: "Packaging",
        value: toNumber(product.packagingCost),
        shareOfPrice: referencePrice > 0 ? (toNumber(product.packagingCost) / referencePrice) * 100 : 0,
        tone: "neutral",
      },
      {
        id: "shipping",
        label: "Shipping",
        value: round2(averageShipping),
        shareOfPrice: referencePrice > 0 ? (averageShipping / referencePrice) * 100 : 0,
        tone: "warning",
      },
      {
        id: "commission",
        label: "Commission",
        value: round2(averageCommission),
        shareOfPrice: referencePrice > 0 ? (averageCommission / referencePrice) * 100 : 0,
        tone: "warning",
      },
      {
        id: "other-fees",
        label: "Other variable fees",
        value: round2(variableOtherFees),
        shareOfPrice: referencePrice > 0 ? (variableOtherFees / referencePrice) * 100 : 0,
        tone: "neutral",
      },
      {
        id: "profit",
        label: "Net profit",
        value: round2(blendedNetProfit),
        shareOfPrice: referencePrice > 0 ? (blendedNetProfit / referencePrice) * 100 : 0,
        tone: blendedNetProfit <= 0 ? "loss" : blendedMargin < 15 ? "warning" : "profit",
      },
    ],
    financialHighlights: [
      {
        id: "best-channel",
        label: "Best channel",
        value: bestChannel?.label ?? "No active channel",
        caption: bestChannel ? `${round2(toNumber(bestChannel.margin)).toFixed(1)}% margin` : "Activate a channel to compare",
        tone: bestChannel?.tone ?? "neutral",
        kind: "text",
      },
      {
        id: "weakest-channel",
        label: "Weakest channel",
        value: weakestChannel?.label ?? "No active channel",
        caption: weakestChannel ? `${round2(toNumber(weakestChannel.margin)).toFixed(1)}% margin` : "No active channel",
        tone: weakestChannel?.tone ?? "neutral",
        kind: "text",
      },
      {
        id: "buybox-gap",
        label: "Buybox pressure",
        value: round2(averageBuyboxGap),
        caption: averageBuyboxGap > 0 ? "Average gap over buybox" : "No buybox reference",
        tone: averageBuyboxGap > 0 ? "warning" : "neutral",
        kind: "currency",
      },
      {
        id: "price-spread",
        label: "Price spread",
        value: round2(priceSpread),
        caption: "Difference between active channel prices",
        tone: priceSpread > 0 ? "neutral" : "warning",
        kind: "currency",
      },
    ],
    channelCards,
    trend30: buildTrendSeries(response.salesTrend30 ?? [], blendedMargin),
    trend90: buildTrendSeries(response.salesTrend90 ?? [], blendedMargin),
    trendSummaries: {
      30: response.salesSummary30 ?? null,
      90: response.salesSummary90 ?? null,
    },
    stockRisk,
    seoReadiness,
    completeness,
  };
}
