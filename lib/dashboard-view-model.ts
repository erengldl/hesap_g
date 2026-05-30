import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { AggregateDashboard } from "@/lib/portfolio-analytics";
import type { ChannelCostResult, Product } from "@/lib/types";

export type DashboardAlertSeverity = "neutral" | "profit" | "loss" | "warning";
export type DashboardKpiTone = "neutral" | "profit" | "loss" | "warning";

export type ModuleFlowStep = {
  id: string;
  label: string;
  href: string;
  status: "active" | "upcoming" | "support";
};

export type DashboardAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  badge: string;
  severity: DashboardAlertSeverity;
};

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardKpiTone;
};

export type DashboardTrendPoint = {
  date: string;
  revenue: number;
  estimatedProfit: number;
  orders: number;
};

export type DashboardTopProduct = {
  id: number;
  name: string;
  sku: string;
  revenue: string;
  margin: string;
  orders: string;
  tone: DashboardAlertSeverity;
};

export type DashboardSignal = {
  id: string;
  title: string;
  description: string;
  value: string;
  severity: DashboardAlertSeverity;
  href: string;
};

export type DashboardPayload = {
  success: boolean;
  aggregate: AggregateDashboard;
  adAnalysis?: {
    totalSpend: number;
    totalNetProfit: number;
    averagePoas: number;
    lossMakingCount: number;
    watchCount: number;
    scaleCount: number;
    totalCampaigns: number;
    lastSyncedAt: string;
  } | null;
  product?: Product;
  results?: ChannelCostResult[];
  bestChannel?: ChannelCostResult;
  bestChannelName?: string;
  bestNetProfit?: number;
  bestMargin?: number;
  lowestTotalCost?: number;
  costBreakdown?: { label: string; value: number }[];
  methodology?: string;
};

export type DashboardViewModel = {
  headline: string;
  description: string;
  flowSteps: ModuleFlowStep[];
  kpis: DashboardKpi[];
  actions: DashboardAction[];
  trend: DashboardTrendPoint[];
  trendSummary: string;
  topProducts: DashboardTopProduct[];
  signals: DashboardSignal[];
  methodology: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getMarginTone(margin: number): DashboardAlertSeverity {
  if (margin >= 35) return "profit";
  if (margin < 18) return "loss";
  if (margin < 26) return "warning";
  return "neutral";
}

function getAlertTone(count: number, isCritical: boolean): DashboardKpiTone {
  if (count <= 0) return "profit";
  return isCritical ? "loss" : "warning";
}

function buildFlowSteps(): ModuleFlowStep[] {
  return [
    { id: "data-center", label: "Veri Merkezi", href: "/veri-merkezi", status: "active" },
    { id: "profit", label: "Kârlılık", href: "/profit-pricing", status: "upcoming" },
    { id: "forecast", label: "Tahmin", href: "/forecast", status: "upcoming" },
    { id: "ads", label: "Reklam", href: "/reklam-analizi", status: "support" },
    { id: "seo", label: "SEO", href: "/channel-seo", status: "support" },
  ];
}

function buildActions(payload: DashboardPayload, aggregate: AggregateDashboard): DashboardAction[] {
  const actions: DashboardAction[] = [];
  const stockCriticalCount = aggregate.stockAlerts.filter((item) => item.stock < 5).length;
  const lowestStock = aggregate.stockAlerts[0];
  const adSummary = payload.adAnalysis ?? null;
  const pricingOpportunityCount = aggregate.topProducts.filter((product) => product.margin < Math.max(aggregate.avgMargin - 2, 26)).length;

  if (aggregate.stockAlerts.length > 0) {
    actions.push({
      id: "stock",
      title: `${formatNumber(aggregate.stockAlerts.length)} ürün stok riski taşıyor`,
      description: stockCriticalCount > 0
        ? `${formatNumber(stockCriticalCount)} ürün kritik seviyede. En düşük stok ${lowestStock?.stock ?? 0} adet.`
        : `Stok takibi isteyen ürünler arttı. En düşük stok ${lowestStock?.stock ?? 0} adet.`,
      href: "/veri-merkezi",
      ctaLabel: "Stokları incele",
      badge: lowestStock ? `${lowestStock.channel} · ${lowestStock.stock} adet` : "Stok takibi",
      severity: stockCriticalCount > 0 ? "loss" : "warning",
    });
  }

  if ((adSummary?.lossMakingCount ?? 0) > 0) {
    actions.push({
      id: "ads",
      title: `${formatNumber(adSummary?.lossMakingCount ?? 0)} kampanya zarar ediyor`,
      description: `${formatNumber(adSummary?.watchCount ?? 0)} kampanya izleme listesinde. Ortalama POAS ${round2(adSummary?.averagePoas ?? 0)}x seviyesinde.`,
      href: "/reklam-analizi",
      ctaLabel: "Kampanyaları aç",
      badge: `${formatNumber(adSummary?.totalCampaigns ?? 0)} kampanya`,
      severity: "loss",
    });
  }

  if (pricingOpportunityCount > 0) {
    actions.push({
      id: "pricing",
      title: `${formatNumber(pricingOpportunityCount)} ürün fiyat optimizasyonu bekliyor`,
      description: "Lider ürünler arasında marjı ortalamanın altında kalanları tek akışla düzenleyin.",
      href: "/profit-pricing",
      ctaLabel: "Kârlılığı optimize et",
      badge: `Ort. marj ${formatPercent(aggregate.avgMargin)}`,
      severity: pricingOpportunityCount >= 3 ? "warning" : "neutral",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "stable",
      title: "Kritik aksiyon görünmüyor",
      description: "Veri akışı stabil. Yeni ürün ekleyebilir veya tahmin çalışması başlatabilirsiniz.",
      href: "/veri-merkezi",
      ctaLabel: "Veri Merkezi'ni aç",
      badge: "Sistem stabil",
      severity: "profit",
    });
  }

  return actions.slice(0, 3);
}

function buildSignals(payload: DashboardPayload, aggregate: AggregateDashboard): DashboardSignal[] {
  const signals: DashboardSignal[] = [];
  const adSummary = payload.adAnalysis ?? null;

  aggregate.stockAlerts.slice(0, 3).forEach((alert) => {
    signals.push({
      id: `stock-${alert.id}-${alert.channel}`,
      title: alert.name,
      description: `${alert.channel} kanalında stok seviyesi hızla daralıyor.`,
      value: `${formatNumber(alert.stock)} adet`,
      severity: alert.stock < 5 ? "loss" : "warning",
      href: "/veri-merkezi",
    });
  });

  if ((adSummary?.lossMakingCount ?? 0) > 0) {
    signals.push({
      id: "ads-loss",
      title: "Reklam verimi düşüyor",
      description: `${formatNumber(adSummary?.lossMakingCount ?? 0)} kampanya zarar bölgesinde.`,
      value: `${round2(adSummary?.averagePoas ?? 0)}x POAS`,
      severity: "loss",
      href: "/reklam-analizi",
    });
  }

  if (payload.bestChannelName && typeof payload.bestNetProfit === "number") {
    signals.push({
      id: "best-channel",
      title: `En güçlü kanal: ${payload.bestChannelName}`,
      description: "Anlık snapshot'ta en yüksek net kârı bu kanal üretiyor.",
      value: formatCurrency(payload.bestNetProfit),
      severity: payload.bestNetProfit > 0 ? "profit" : "warning",
      href: "/profit-pricing",
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "stable-state",
      title: "Risk sinyali bulunmuyor",
      description: "Yeni veri girildiğinde burada stok, reklam ve marj sinyalleri listelenecek.",
      value: "Stabil",
      severity: "profit",
      href: "/veri-merkezi",
    });
  }

  return signals.slice(0, 4);
}

export function buildDashboardViewModel(payload: DashboardPayload): DashboardViewModel {
  const aggregate = payload.aggregate;
  const actions = buildActions(payload, aggregate);
  const stockCriticalCount = aggregate.stockAlerts.filter((item) => item.stock < 5).length;
  const pricingOpportunityCount = aggregate.topProducts.filter((product) => product.margin < Math.max(aggregate.avgMargin - 2, 26)).length;
  const criticalAlertCount = aggregate.stockAlerts.length + (payload.adAnalysis?.lossMakingCount ?? 0) + pricingOpportunityCount;

  const trend = aggregate.salesTrend.map((point) => ({
    ...point,
    estimatedProfit: round2(point.revenue * (aggregate.avgMargin / 100)),
  }));

  const firstTrend = trend[0];
  const lastTrend = trend[trend.length - 1];
  const trendDelta = firstTrend && lastTrend && firstTrend.revenue > 0
    ? round2(((lastTrend.revenue - firstTrend.revenue) / firstTrend.revenue) * 100)
    : 0;

  const topProducts = aggregate.topProducts.slice(0, 5).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    revenue: formatCurrency(product.revenue),
    margin: formatPercent(product.margin),
    orders: `${formatNumber(product.orders)} siparis`,
    tone: getMarginTone(product.margin),
  }));

  return {
    headline: "Bugün ne yapmalısın?",
    description: "Karar özeti önce gelir. Veri hazırlığı, marj takibi ve reklam riski için bugünün en kritik sinyallerini önce burada görün.",
    flowSteps: buildFlowSteps(),
    kpis: [
      {
        id: "net-profit",
        label: "Net Kâr",
        value: formatCurrency(aggregate.totalProfit),
        detail: `${formatNumber(aggregate.totalProducts)} aktif ürün`,
        tone: aggregate.totalProfit > 0 ? "profit" : "loss",
      },
      {
        id: "revenue",
        label: "Ciro",
        value: formatCurrency(aggregate.totalRevenue),
        detail: `${formatNumber(aggregate.totalOrders)} siparis`,
        tone: "neutral",
      },
      {
        id: "margin",
        label: "Ortalama Marj",
        value: formatPercent(aggregate.avgMargin),
        detail: "Son 30 günlük canlı akıştan türetildi",
        tone: getMarginTone(aggregate.avgMargin),
      },
      {
        id: "critical-alerts",
        label: "Kritik Alarm",
        value: formatNumber(criticalAlertCount),
        detail: criticalAlertCount > 0 ? `${formatNumber(actions.length)} odak aksiyon bekliyor` : "Acil müdahale gerekmiyor",
        tone: getAlertTone(criticalAlertCount, stockCriticalCount > 0 || (payload.adAnalysis?.lossMakingCount ?? 0) > 0),
      },
    ],
    actions,
    trend,
    trendSummary: trend.length > 1
      ? `Son 30 günde gelir değişimi ${trendDelta >= 0 ? "+" : ""}%${round2(trendDelta)}`
      : "Son 30 gün için yeterli trend verisi birikmedi",
    topProducts,
    signals: buildSignals(payload, aggregate),
    methodology: payload.methodology || aggregate.methodology,
  };
}
