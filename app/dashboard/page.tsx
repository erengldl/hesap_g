"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { PageHeader, KpiCard, GlassCard, MobileCardList, WarningBadge, SkeletonCard, EmptyState, EyebrowBadge } from "@/components/ui-custom/GlassComponents";
import { SeedDemoButton } from "@/components/demo/SeedDemoButton";
import {
  TrendingUp, Wallet, BarChart3, ShoppingCart, Target, Zap, Info,
  Package, AlertTriangle, DollarSign, Activity, ChevronRight, Megaphone, Database, Sparkles,
  CircleCheckBig, FlaskConical, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult, Product } from "@/lib/types";
import type { AggregateDashboard } from "@/lib/portfolio-analytics";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area, BarChart as RechartsBarChart, Bar,
} from "recharts";

type DashboardDataMode = "demo" | "live" | "partial";

type DashboardDataQuality = {
  score: number;
  warnings: string[];
  lastSyncAt: string | null;
};

type DashboardPayload = {
  success: boolean;
  aggregate: AggregateDashboard;
  dataMode: DashboardDataMode;
  dataQuality: DashboardDataQuality;
  partial?: boolean;
  fallbackUsed?: boolean;
  staleAt?: string | null;
  adAnalysis?: {
    totalSpend: number;
    totalNetProfit: number;
    averagePoas: number;
    lossMakingCount: number;
    watchCount: number;
    scaleCount: number;
    totalCampaigns: number;
    lastSyncedAt: string;
    analysisMode?: "imported" | "simulated";
    dataSource?: "imported" | "derived";
    coverageRatio?: number;
    fallbackUsed?: boolean;
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

const ProductComparisonSection = dynamic(
  () => import("@/components/dashboard/ProductComparison"),
  {
    loading: () => (
      <GlassCard className="p-5">
        <div className="space-y-2">
          <h3 className="font-heading text-base font-bold text-foreground">Benchmark Analizi</h3>
          <p className="text-sm text-muted/70">Ürün karşılaştırma paneli hazırlanıyor...</p>
        </div>
      </GlassCard>
    ),
  }
);

function getDataModeMeta(mode: DashboardDataMode) {
  if (mode === "demo") {
    return {
      label: "DEMO MOD",
      icon: FlaskConical,
      className: "gap-1.5 border-primary/30 bg-primary/10 text-primary",
      description: "Örnek ürün ve sipariş akışı gösteriliyor.",
    };
  }

  if (mode === "live") {
    return {
      label: "CANLI VERI",
      icon: ShieldCheck,
      className: "gap-1.5 border-success/30 bg-success/10 text-success",
      description: "Canlı ürün ve sipariş verisi kullanılıyor.",
    };
  }

  return {
    label: "KISMI VERI",
    icon: AlertTriangle,
    className: "gap-1.5 border-warning/30 bg-warning/10 text-warning",
    description: "Bazı alanlar canlı, bazı alanlar örnek veriyle gösteriliyor.",
  };
}

function getDataQualityMeta(score: number) {
  if (score >= 80) {
    return {
      label: "Ideal",
      barColor: "var(--success)",
      accentClassName: "border-success/20 bg-success/10 text-success",
      icon: CircleCheckBig,
    };
  }

  if (score >= 50) {
    return {
      label: "Orta",
      barColor: "var(--warning)",
      accentClassName: "border-warning/20 bg-warning/10 text-warning",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Riskli",
    barColor: "var(--danger)",
    accentClassName: "border-danger/20 bg-danger/10 text-danger",
    icon: AlertTriangle,
  };
}

function formatSyncLabel(value: string | null) {
  if (!value) {
    return "Henüz senkronize edilmedi";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Henüz senkronize edilmedi";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getMarginConfidenceMeta(confidence: "exact" | "estimated") {
  if (confidence === "exact") {
    return {
      label: "NET",
      className: "border-success/20 bg-success/10 text-success",
    };
  }

  return {
    label: "TAHMINI",
    className: "border-warning/20 bg-warning/10 text-warning",
  };
}

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [seedDemoError, setSeedDemoError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    void (async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data?.success) setPayload(data);
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const agg = payload?.aggregate;

  const results = payload?.results ?? [];
  const bestChannel = payload?.bestChannel;
  const bestChannelName = bestChannel?.channel_name ?? "Kanal";
  const baseMethodology = payload?.methodology ?? agg?.methodology ?? "";
  const hasEstimatedTopProductMargin = agg?.topProducts.some((product) => product.marginConfidence === "estimated") ?? false;
  const methodologyFootnote = [
    baseMethodology || "Analiz, güncel pazar verileri, komisyon oranları ve lojistik maliyetleri kullanılarak hazırlanır.",
    hasEstimatedTopProductMargin
      ? "Tahmini etiketi görünen ürün marjları, sipariş geliri ile ürün ve paketleme maliyetlerinden hesaplanır; ayrıntılı kanal maliyeti eksik olabilir."
      : "Ürün marjları, sipariş gelirleri ile kanal bazlı maliyet kayıtları birleştirilerek hesaplanır.",
    "Toplam kâr ve ortalama marj göstergeleri, hızlı karar desteği için hazırlanmış yönetim özetidir.",
  ].join(" ");
  const methodology = methodologyFootnote;
  const adSummary = payload?.adAnalysis ?? null;
  const showCharts = Boolean(agg) && isClient;
  const dataMode = payload?.dataMode ?? "partial";
  const dataQuality = payload?.dataQuality ?? { score: 0, warnings: [], lastSyncAt: null };
  const dataModeMeta = getDataModeMeta(dataMode);
  const dataQualityMeta = getDataQualityMeta(dataQuality.score);
  const dataQualityLabel = `Veri Kalitesi: %${dataQuality.score} - ${dataQualityMeta.label}`;
  const dataQualityBarData = [{ label: "Skor", score: Math.max(0, Math.min(100, dataQuality.score)) }];
  const rankedResults = [...results].sort((a, b) => b.net_profit - a.net_profit);
  const maxChannelProfit = Math.max(...rankedResults.map((result) => result.net_profit), 1);
  const chartPalette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
  const costPalette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--success)",
    "var(--warning)",
    "var(--info)",
  ];
  const chartTooltipStyle: CSSProperties = {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius)",
    color: "var(--text-main)",
  };

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="Genel Bakış" title="Özet" description="Veriler hazırlanıyor..." />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} className="h-24" />)}
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-[300px] lg:col-span-2" />
          <SkeletonCard className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!agg) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="Genel Bakış" title="Özet" description="Satış kanalları ve kârlılık kısa bakışta görünür." />
        <EmptyState
          icon={BarChart3}
          title="Henüz özet oluşturulmadı"
          description="Özeti görmek için önce ürün ve sipariş verisi ekleyin."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <SeedDemoButton
                className="py-3 px-6"
                onStart={() => setSeedDemoError(null)}
                onError={setSeedDemoError}
              />
              <Link
                href="/veri-merkezi"
                className="btn-primary py-3 px-6 text-sm"
              >
                Veri Merkezini Aç
              </Link>
              {seedDemoError ? (
                <p className="basis-full text-center text-sm font-medium text-danger">{seedDemoError}</p>
              ) : null}
            </div>
          )}
        />
      </div>
    );
  }

  const trendMax = Math.max(...agg.salesTrend.map((d) => d.revenue), 1);

  return (
    <div className="page-shell">
      <PageHeader eyebrow="Genel Bakış" title="Özet" description="Tüm ürünler, kanallar ve siparişler üzerinden kısa finansal özet.">
        <EyebrowBadge className={cn("gap-1.5", dataModeMeta.className)}>
          <dataModeMeta.icon className="h-3.5 w-3.5" />
          {dataModeMeta.label}
        </EyebrowBadge>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2 py-0.5 text-xs font-medium text-muted">
          <Zap className="h-3 w-3 text-primary" />
          Canlı analiz
        </div>
      </PageHeader>

      {payload?.fallbackUsed || adSummary?.analysisMode === "simulated" ? (
        <GlassCard className="mb-4 border-warning/25 bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-warning">Karar desteği kısmi veriyle gösteriliyor.</p>
              <p className="text-sm leading-6 text-soft">
                {adSummary?.analysisMode === "simulated"
                  ? "Reklam özeti türetilmiş kampanya sinyallerinden hesaplanıyor; gerçek platform entegrasyonu yerine simülasyon kullanılıyor."
                  : "Bazı dashboard kartları yedek görünüm veya kısmi veri ile oluşturuldu."}
              </p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Toplam Ciro" value={formatCurrency(agg.totalRevenue)} icon={DollarSign}
          subValue={`${formatNumber(agg.totalOrders)} sipariş`} />
        <KpiCard title="Ortalama Kâr Marjı" value={formatPercent(agg.avgMargin)} icon={TrendingUp}
          trend={{ value: "%25-%45 aralığı", isPositive: true }} />
        <KpiCard title="Tahmini Net Kâr" value={formatCurrency(agg.totalProfit)} icon={Wallet}
          subValue={`${agg.totalProducts} aktif ürün`} />
        <KpiCard title="Tamamlanan Sipariş" value={formatNumber(agg.totalOrders)} icon={ShoppingCart}
          subValue="Son 90 gün" />
      </div>

      {adSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Reklam Harcaması"
            value={formatCurrency(adSummary.totalSpend)}
            subValue={`${formatNumber(adSummary.totalCampaigns)} kampanya${adSummary.coverageRatio !== undefined ? ` · kapsama %${Math.round(adSummary.coverageRatio * 100)}` : ""}`}
            icon={Megaphone}
          />
          <KpiCard
            title="Reklam Net Kârı"
            value={formatCurrency(adSummary.totalNetProfit)}
            subValue={`Senkron: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(new Date(adSummary.lastSyncedAt))}`}
            icon={Wallet}
            className="border-border/80 bg-surface-container"
          />
          <KpiCard
            title="Kârlılık Oranı"
            value={`${adSummary.averagePoas.toFixed(2)}x`}
            subValue={adSummary.analysisMode === "simulated" ? "Simüle karar metriği" : "Kâr / harcama"}
            icon={TrendingUp}
          />
          <KpiCard
            title="Kritik Kampanyalar"
            value={formatNumber(adSummary.lossMakingCount)}
            subValue={`${adSummary.watchCount} takip | ${adSummary.scaleCount} ölçek`}
            icon={AlertTriangle}
            className="border-danger/20 bg-danger/5"
          />
        </div>
      )}

      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="panel-title">Hızlı Geçiş</h3>
          <WarningBadge>Tek akış</WarningBadge>
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
          {[
            { label: "Tahmin", href: "/forecast", icon: TrendingUp },
            { label: "Kârlılık", href: "/profit-pricing", icon: Target },
            { label: "Ürünler", href: "/veri-merkezi", icon: Database },
            { label: "Reklam", href: "/reklam-analizi", icon: Megaphone },
            { label: "SEO", href: "/channel-seo", icon: Sparkles },
          ].map((action) => (
            <Link key={action.href} href={action.href} className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-container px-3 py-2 transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-container text-muted/60 transition-colors duration-200 group-hover:text-primary">
                  <action.icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-medium text-foreground">{action.label}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/60 transition-colors duration-200 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </GlassCard>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="overflow-hidden lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="panel-title">Performans Trendi</h3>
            <div className="flex items-center gap-2">
              <WarningBadge>30 günlük veri</WarningBadge>
              <span className="text-xs font-medium text-muted">Zirve: {formatCurrency(trendMax)}</span>
            </div>
          </div>
          <div className="h-[260px] min-w-0 w-full">
            {showCharts && agg.salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
                <AreaChart data={agg.salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" strokeOpacity={0.25} vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" strokeOpacity={0.45} fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis stroke="var(--text-muted)" strokeOpacity={0.45} fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "var(--chart-1)" }}
                    formatter={(value) => [formatCurrency(Number(value)), "Ciro"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} isAnimationActive={true} animationDuration={400}
                    fill="url(#trendGradient)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-container text-xs text-soft">
                Yeterli trend verisi birikmedi
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="panel-title mb-3">Kanal Hacmi</h3>
          <div className="h-[200px] min-w-0">
            {showCharts && agg.channelBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
                <PieChart>
                  <Pie data={agg.channelBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={78} isAnimationActive={true} animationDuration={400}
                    paddingAngle={4} dataKey="revenue" nameKey="name">
                    {agg.channelBreakdown.map((_, i) => (
                      <Cell key={`ch-${i}`} fill={chartPalette[i % chartPalette.length]} stroke="var(--bg-elevated)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle}
                    formatter={(value) => [formatCurrency(Number(value)), "Ciro"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-container text-xs text-soft">
                Kanal verisi yok
              </div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {agg.channelBreakdown.map((ch, i) => (
              <div key={ch.slug} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette[i % chartPalette.length] }} />
                  <span className="text-muted">{ch.name}</span>
                </div>
                <div className="text-foreground">
                  {formatCurrency(ch.revenue)} <span className="text-muted/60 font-medium ml-1">%{ch.pct}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="panel-title">Lider Ürünler</h3>
            <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-xs font-medium text-muted">Brüt Ciro</span>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-[0.1em] text-muted/60">
                  <th className="pb-2">Ürün Detayı</th>
                  <th className="pb-2 text-right">Sipariş</th>
                  <th className="pb-2 text-right">Ciro</th>
                  <th className="pb-2 text-right">Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {agg.topProducts.map((p) => (
                  <tr key={p.id} className="group transition-colors duration-200 hover:bg-surface-subtle">
                    <td className="py-2.5">
                      <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted/60">{p.sku}</p>
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">{formatNumber(p.orders)}</td>
                    <td className="py-2.5 text-right text-sm font-bold text-primary">{formatCurrency(p.revenue)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
                          p.marginConfidence === "exact"
                            ? "border-border bg-primary-soft text-primary"
                            : "border-warning/20 bg-warning/10 text-warning"
                        )}>
                          %{p.margin}
                        </span>
                        <span className={cn(
                          "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]",
                          getMarginConfidenceMeta(p.marginConfidence).className
                        )}>
                          {getMarginConfidenceMeta(p.marginConfidence).label}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MobileCardList
            className="space-y-2 md:hidden"
            data={agg.topProducts}
            renderItem={(p, index) => (
              <GlassCard key={p.id} className="p-3 sm:p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted/60">{p.sku}</p>
                  </div>
                  <span className="inline-flex shrink-0 rounded-md border border-border bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted">
                    #{index + 1}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border bg-surface-soft p-2">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted/60">Sipariş</p>
                    <p className="text-sm font-bold text-foreground">{formatNumber(p.orders)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted/60">Ciro</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(p.revenue)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2 text-right">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted/60">Marj</p>
                    <div className="flex items-center justify-end gap-1.5">
                      <p className={cn(
                        "text-sm font-bold",
                        p.marginConfidence === "exact" ? "text-primary" : "text-warning"
                      )}>
                        %{p.margin}
                      </p>
                      <span className={cn(
                        "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]",
                        getMarginConfidenceMeta(p.marginConfidence).className
                      )}>
                        {getMarginConfidenceMeta(p.marginConfidence).label}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}
          />
        </GlassCard>

        <GlassCard>
          <h3 className="panel-title mb-3">Stok Envanter Durumu</h3>
          {agg.stockAlerts.length > 0 ? (
            <div className="space-y-2">
              {agg.stockAlerts.slice(0, 6).map((alert, i) => (
                <GlassCard key={`${alert.id}-${i}`} className={cn(
                  "flex items-center justify-between gap-3 p-2.5 transition-colors duration-200",
                  alert.stock < 5 ? "border-danger/30 bg-danger/5" :
                  alert.stock < 10 ? "border-warning/30 bg-warning/[0.03]" :
                  "border-border bg-surface-container"
                )}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("rounded-md p-1.5", 
                      alert.stock < 5 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{alert.name}</p>
                      <p className="mt-0.5 text-xs text-muted/60">{alert.channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("block text-sm font-semibold",
                      alert.stock < 5 ? "text-danger" : "text-warning")}>
                      {alert.stock} ADET
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted/60">Kritik Seviye</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard className="border-dashed border-border bg-surface-container p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                <Package className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground">Stoklar güvenli</p>
              <p className="mt-1 text-xs text-soft">Şu an müdahale gerektiren ürün bulunmuyor.</p>
            </GlassCard>
          )}

          {bestChannel && (
            <GlassCard className="mt-3 flex items-center gap-3 p-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-primary/80">En iyi kanal</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {bestChannelName} üzerinden <span className="text-primary">{formatCurrency(bestChannel.net_profit)}</span> net kâr elde ediliyor.
                </p>
              </div>
            </GlassCard>
          )}
        </GlassCard>
      </div>

      {bestChannel && payload?.costBreakdown && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard>
            <h3 className="panel-title mb-3">Maliyet Kırılımı ({bestChannelName})</h3>
            <div className="h-[220px] min-w-0">
              {showCharts ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
                  <PieChart>
                    <Pie data={payload.costBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={82} isAnimationActive={true} animationDuration={400}
                      paddingAngle={3} dataKey="value">
                      {(payload.costBreakdown).map((_, i) => (
                        <Cell key={`cs-${i}`} fill={costPalette[i % costPalette.length]} stroke="var(--bg-elevated)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle}
                      formatter={(value) => [formatCurrency(Number(value)), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border bg-surface-container" />
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="panel-title mb-3">Başabaş Analizi</h3>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted/60">Birim Maliyet</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{formatCurrency(bestChannel.total_unit_cost)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted/60">Önerilen satış</p>
                  <p className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{formatCurrency(bestChannel.sale_price)}</p>
                </div>
              </div>
              
              <div className="relative">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border/70 bg-surface-container">
                  <div className="h-full bg-border/40 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.min(100, (bestChannel.total_unit_cost / Math.max(1, bestChannel.sale_price)) * 100)}%` }} />
                  <div className="h-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(0, 100 - (bestChannel.total_unit_cost / Math.max(1, bestChannel.sale_price)) * 100)}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium uppercase tracking-wide">
                  <span className="text-muted">Maliyet %{Math.round((bestChannel.total_unit_cost / Math.max(1, bestChannel.sale_price)) * 100)}</span>
                  <span className="text-primary">Net kâr %{Math.round(bestChannel.profit_margin_percent)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GlassCard className="p-3 sm:p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted/60">ROI</p>
                  <p className="text-xl font-bold tracking-tight text-foreground">
                    {formatPercent((bestChannel.net_profit / Math.max(1, bestChannel.total_unit_cost)) * 100)}
                  </p>
                </GlassCard>
                <GlassCard className="border-primary/20 bg-primary-soft p-3 sm:p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary/60">Net Marj</p>
                  <p className="text-xl font-bold tracking-tight text-primary">
                    {formatPercent(bestChannel.profit_margin_percent)}
                  </p>
                </GlassCard>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {rankedResults.length > 0 && (
        <GlassCard className="mb-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h3 className="panel-title">Kanal Kârlılık Matrisi</h3>
              <p className="text-xs font-medium text-soft">Ürün bazında platformlar arası finansal performans farkı.</p>
            </div>
            <WarningBadge>Sistem Tahmini</WarningBadge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {rankedResults.map((result) => {
              const isBest = result.channel_name === bestChannelName;
              const profitShare = result.net_profit > 0 ? Math.max(8, (result.net_profit / maxChannelProfit) * 100) : 8;

              return (
                <GlassCard
                  key={result.channel_name}
                  className={cn(
                    "group p-3",
                    isBest ? "border-border bg-primary-soft/40" : "border-border bg-surface-container"
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{result.channel_name}</p>
                      <p className="mt-0.5 text-xs font-medium text-muted/60">
                        {formatCurrency(result.sale_price)} <span className="opacity-40">/</span> {formatCurrency(result.total_unit_cost)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.08em]",
                        isBest ? "bg-primary-soft text-primary border-border" : "bg-surface-soft text-muted border-border"
                      )}
                    >
                      {isBest ? "En iyi" : "Diğer"}
                    </span>
                  </div>

                  <div className="mb-4 flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted/60">Net Kâr</p>
                      <p className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(result.net_profit)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted/60">Marj</p>
                      <p className={cn("text-lg font-semibold tracking-tight", isBest ? "text-primary" : "text-foreground/80")}>
                        {formatPercent(result.profit_margin_percent)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-container">
                    <div
                className={cn("h-full rounded-full transition-[width] duration-300", isBest ? "bg-primary" : "bg-border")}
                      style={{ width: `${profitShare}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-muted/60">
                    <span>Vergi & Kargo Dahil</span>
                    <span>%{Math.round(result.profit_margin_percent)} Verim</span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </GlassCard>
      )}

      <ProductComparisonSection />

      <GlassCard className="mt-4">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="panel-title">Veri Kalitesi</h3>
            </div>
            <p className="text-xs font-medium text-soft">
              Veri modunu, güven skorunu ve kritik eksikleri tek yerde özetler.
            </p>
          </div>
          <EyebrowBadge className={cn("gap-1.5", dataQualityMeta.accentClassName)}>
            <dataQualityMeta.icon className="h-3.5 w-3.5" />
            {dataQualityLabel}
          </EyebrowBadge>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg border border-border/70 bg-surface-container p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/60">Veri kalitesi</span>
              <span className="text-sm font-semibold text-foreground">{dataQualityLabel}</span>
            </div>
            <div className="h-16">
              {showCharts ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={dataQualityBarData} layout="vertical" margin={{ top: 8, right: 4, left: 4, bottom: 8 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="label" hide />
                    <Bar
                      dataKey="score"
                      radius={[999, 999, 999, 999]}
                      fill={dataQualityMeta.barColor}
                      background={{ fill: "var(--surface-soft)" }}
                      isAnimationActive={true}
                      animationDuration={450}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${dataQuality.score}%`, backgroundColor: dataQualityMeta.barColor }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs font-medium uppercase tracking-wide text-muted/60">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface-container p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/60">Veri modu</span>
            <div className="mt-2 flex items-center gap-2">
              <dataModeMeta.icon className={cn("h-4 w-4", dataMode === "live" ? "text-success" : dataMode === "demo" ? "text-primary" : "text-warning")} />
              <p className="text-sm font-semibold text-foreground">{dataModeMeta.label}</p>
            </div>
            <p className="mt-2 text-xs leading-6 text-soft">{dataModeMeta.description}</p>

            <div className="mt-4 border-t border-border/60 pt-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/60">Son senkronizasyon</span>
              <p className="mt-2 text-sm font-semibold text-foreground">{formatSyncLabel(dataQuality.lastSyncAt)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-surface-container p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/60">Uyarılar</span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/60">
              {dataQuality.warnings.length} kayıt
            </span>
          </div>

          {dataQuality.warnings.length > 0 ? (
            <div className="space-y-2">
              {dataQuality.warnings.map((warning) => (
                <div key={warning} className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="leading-6">{warning}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2.5 text-sm text-success">
              <CircleCheckBig className="h-4 w-4 shrink-0" />
              <span>Veri kalitesi ideal seviyede.</span>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="mt-4 flex items-start gap-3 p-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <p className="text-xs leading-snug text-soft">
          {methodology || "Analiz, güncel pazar verileri, komisyon oranları ve lojistik maliyetleri kullanılarak hazırlanır. Gösterilen değerler karar desteği içindir; kesin muhasebe sonucu yerine hızlı bir yönetim özeti sunar."}
        </p>
      </GlassCard>
    </div>
  );
}
