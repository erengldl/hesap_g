"use client";

import React, { useCallback, useEffect, useState } from "react";
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

function getDataModeMeta(mode: DashboardDataMode) {
  if (mode === "demo") {
    return {
      label: "DEMO MOD",
      icon: FlaskConical,
      className: "gap-1.5 border-primary/30 bg-primary/10 text-primary",
      description: "Sentetik urun ve siparis akisi gosteriliyor.",
    };
  }

  if (mode === "live") {
    return {
      label: "CANLI VERI",
      icon: ShieldCheck,
      className: "gap-1.5 border-success/30 bg-success/10 text-success",
      description: "Canli urun ve siparis verisi kullaniliyor.",
    };
  }

  return {
    label: "KISMI VERI",
    icon: AlertTriangle,
    className: "gap-1.5 border-warning/30 bg-warning/10 text-warning",
    description: "Demo ve canli veri birlikte gorunuyor.",
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
    return "Henuz senkronize edilmedi";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Henuz senkronize edilmedi";
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
  const [chartsReady, setChartsReady] = useState(false);
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

  useEffect(() => {
    if (!agg) {
      setChartsReady(false);
      return;
    }

    setChartsReady(false);
    const timeoutId = window.setTimeout(() => {
      setChartsReady(true);
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [agg]);

  const results = payload?.results ?? [];
  const bestChannel = payload?.bestChannel;
  const bestChannelName = bestChannel?.channel_name ?? "Kanal";
  const baseMethodology = payload?.methodology ?? agg?.methodology ?? "";
  const hasEstimatedTopProductMargin = agg?.topProducts.some((product) => product.marginConfidence === "estimated") ?? false;
  const methodologyFootnote = [
    baseMethodology || "Analiz, gercek zamanli pazar verileri, komisyon oranlari ve lojistik maliyetleri kullanilarak yapilmistir.",
    hasEstimatedTopProductMargin
      ? "TAHMINI etiketi tasiyan lider urun marjlari, cost_results kaydi olmadigi icin yalnizca gercek siparis cirosu ile urun ve paketleme maliyeti uzerinden hesaplanir."
      : "Lider urun marjlari, gercek siparis cirosu ile eslesen cost_results kayitlari uzerinden hesaplanir.",
    "Genel ortalama marj ve toplam kar KPI'lari mevcut urun ayarlarindan turetilen tahmini degerlerdir.",
  ].join(" ");
  const methodology = methodologyFootnote;
  const adSummary = payload?.adAnalysis ?? null;
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
  const chartTooltipStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius)",
    color: "var(--text-main)",
  };

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="Genel BakÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸" title="ÃƒÆ’Ã¢â‚¬â€œzet" description="Veriler hazÃƒâ€Ã‚Â±rlanÃƒâ€Ã‚Â±yor..." />
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
        <PageHeader eyebrow="Genel BakÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸" title="ÃƒÆ’Ã¢â‚¬â€œzet" description="SatÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ kanallarÃƒâ€Ã‚Â± ve kÃƒÆ’Ã‚Â¢rlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± kÃƒâ€Ã‚Â±sa bakÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼n." />
        <EmptyState
          icon={BarChart3}
          title="HenÃƒÆ’Ã‚Â¼z ÃƒÆ’Ã‚Â¶zet oluÃƒâ€¦Ã…Â¸turulmadÃƒâ€Ã‚Â±"
          description="ÃƒÆ’Ã¢â‚¬â€œzetin gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nmesi iÃƒÆ’Ã‚Â§in ÃƒÆ’Ã‚Â¶nce ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼n ve sipariÃƒâ€¦Ã…Â¸ verisi ekleyin."
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
                ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n Merkezini AÃƒÆ’Ã‚Â§
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
      <PageHeader eyebrow="Genel BakÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸" title="ÃƒÆ’Ã¢â‚¬â€œzet" description="TÃƒÆ’Ã‚Â¼m ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼nler, kanallar ve sipariÃƒâ€¦Ã…Â¸ler ÃƒÆ’Ã‚Â¼zerinden kÃƒâ€Ã‚Â±sa finansal ÃƒÆ’Ã‚Â¶zet.">
        <EyebrowBadge className={cn("gap-1.5", dataModeMeta.className)}>
          <dataModeMeta.icon className="h-3.5 w-3.5" />
          {dataModeMeta.label}
        </EyebrowBadge>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-medium text-muted">
          <Zap className="h-3 w-3 text-primary" />
          CanlÃƒâ€Ã‚Â± Analiz
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Toplam Ciro" value={formatCurrency(agg.totalRevenue)} icon={DollarSign}
          subValue={`${formatNumber(agg.totalOrders)} sipariÃƒâ€¦Ã…Â¸`} />
        <KpiCard title="Ortalama KÃƒÆ’Ã‚Â¢r MarjÃƒâ€Ã‚Â±" value={formatPercent(agg.avgMargin)} icon={TrendingUp}
          trend={{ value: "%25-%45 aralÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±", isPositive: true }} />
        <KpiCard title="Tahmini Net KÃƒÆ’Ã‚Â¢r" value={formatCurrency(agg.totalProfit)} icon={Wallet}
          subValue={`${agg.totalProducts} aktif ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼n`} />
        <KpiCard title="Tamamlanan SipariÃƒâ€¦Ã…Â¸" value={formatNumber(agg.totalOrders)} icon={ShoppingCart}
          subValue="Son 90 gÃƒÆ’Ã‚Â¼n" />
      </div>

      {adSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Reklam HarcamasÃƒâ€Ã‚Â±"
            value={formatCurrency(adSummary.totalSpend)}
            subValue={`${formatNumber(adSummary.totalCampaigns)} kampanya`}
            icon={Megaphone}
          />
          <KpiCard
            title="Reklam Net KÃƒÆ’Ã‚Â¢rÃƒâ€Ã‚Â±"
            value={formatCurrency(adSummary.totalNetProfit)}
            subValue={`Senkron: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(new Date(adSummary.lastSyncedAt))}`}
            icon={Wallet}
            className="border-border/80 bg-surface-container"
          />
          <KpiCard
            title="KÃƒÆ’Ã‚Â¢r oranÃƒâ€Ã‚Â±"
            value={`${adSummary.averagePoas.toFixed(2)}x`}
            subValue="KÃƒÆ’Ã‚Â¢r / harcama"
            icon={TrendingUp}
          />
          <KpiCard
            title="Kritik Kampanyalar"
            value={formatNumber(adSummary.lossMakingCount)}
            subValue={`${adSummary.watchCount} takip Ãƒâ€šÃ‚Â· ${adSummary.scaleCount} ÃƒÆ’Ã‚Â¶lÃƒÆ’Ã‚Â§ek`}
            icon={AlertTriangle}
            className="border-danger/20 bg-danger/5"
          />
        </div>
      )}

      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="panel-title">HÃƒâ€Ã‚Â±zlÃƒâ€Ã‚Â± GeÃƒÆ’Ã‚Â§iÃƒâ€¦Ã…Â¸</h3>
          <WarningBadge>Tek akÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸</WarningBadge>
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
          {[
            { label: "Tahmin", href: "/forecast", icon: TrendingUp },
            { label: "KÃƒÆ’Ã‚Â¢rlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±k", href: "/profit-pricing", icon: Target },
            { label: "ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼nler", href: "/veri-merkezi", icon: Database },
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
              <WarningBadge>30 GÃƒÆ’Ã‚Â¼nlÃƒÆ’Ã‚Â¼k Veri</WarningBadge>
              <span className="text-[10px] font-medium text-muted">Zirve: {formatCurrency(trendMax)}</span>
            </div>
          </div>
          <div className="h-[260px] min-w-0 w-full">
            {chartsReady && isClient && agg.salesTrend.length > 0 ? (
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
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-container text-xs text-muted/60">
                Yeterli trend verisi birikmedi
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="panel-title mb-3">Kanal Hacmi</h3>
          <div className="h-[200px] min-w-0">
            {chartsReady && isClient && agg.channelBreakdown.length > 0 ? (
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
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-container text-xs text-muted/60">
                Kanal verisi yok
              </div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {agg.channelBreakdown.map((ch, i) => (
              <div key={ch.slug} className="flex items-center justify-between text-[11px]">
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
            <h3 className="panel-title">Lider ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼nler</h3>
            <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-medium text-muted">BrÃƒÆ’Ã‚Â¼t Ciro</span>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/60">
                  <th className="pb-2">ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n DetayÃƒâ€Ã‚Â±</th>
                  <th className="pb-2 text-right">SipariÃƒâ€¦Ã…Â¸</th>
                  <th className="pb-2 text-right">Ciro</th>
                  <th className="pb-2 text-right">Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {agg.topProducts.map((p) => (
                  <tr key={p.id} className="group transition-colors duration-200 hover:bg-surface-subtle">
                    <td className="py-2.5">
                      <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted/60">{p.sku}</p>
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">{formatNumber(p.orders)}</td>
                    <td className="py-2.5 text-right text-sm font-bold text-primary">{formatCurrency(p.revenue)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          p.marginConfidence === "exact"
                            ? "border-border bg-primary-soft text-primary"
                            : "border-warning/20 bg-warning/10 text-warning"
                        )}>
                          %{p.margin}
                        </span>
                        <span className={cn(
                          "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
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
                    <p className="mt-0.5 text-[10px] text-muted/60">{p.sku}</p>
                  </div>
                  <span className="inline-flex shrink-0 rounded-md border border-border bg-surface-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                    #{index + 1}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border bg-surface-soft p-2">
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">SipariÃƒâ€¦Ã…Â¸</p>
                    <p className="text-sm font-bold text-foreground">{formatNumber(p.orders)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2">
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">Ciro</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(p.revenue)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2 text-right">
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">Marj</p>
                    <div className="flex items-center justify-end gap-1.5">
                      <p className={cn(
                        "text-sm font-bold",
                        p.marginConfidence === "exact" ? "text-primary" : "text-warning"
                      )}>
                        %{p.margin}
                      </p>
                      <span className={cn(
                        "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
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
                      <p className="mt-0.5 text-[10px] text-muted/60">{alert.channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("block text-sm font-semibold",
                      alert.stock < 5 ? "text-danger" : "text-warning")}>
                      {alert.stock} ADET
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted/60">Kritik Seviye</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard className="border-dashed border-border bg-surface-container p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                <Package className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground">Stoklar gÃƒÆ’Ã‚Â¼vende</p>
              <p className="mt-1 text-xs text-muted">Ãƒâ€¦Ã‚Âu an mÃƒÆ’Ã‚Â¼dahale gerektiren ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼n bulunmuyor.</p>
            </GlassCard>
          )}

          {bestChannel && (
            <GlassCard className="mt-3 flex items-center gap-3 p-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-primary/80">En iyi kanal</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {bestChannelName} ÃƒÆ’Ã‚Â¼zerinden <span className="text-primary">{formatCurrency(bestChannel.net_profit)}</span> net kÃƒÆ’Ã‚Â¢r elde ediliyor.
                </p>
              </div>
            </GlassCard>
          )}
        </GlassCard>
      </div>

      {bestChannel && payload?.costBreakdown && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard>
            <h3 className="panel-title mb-3">Maliyet KÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±mÃƒâ€Ã‚Â± ({bestChannelName})</h3>
            <div className="h-[220px] min-w-0">
              {chartsReady && isClient ? (
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
            <h3 className="panel-title mb-3">BaÃƒâ€¦Ã…Â¸abaÃƒâ€¦Ã…Â¸ Analizi</h3>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted/60">Birim Maliyet</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{formatCurrency(bestChannel.total_unit_cost)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted/60">ÃƒÆ’Ã¢â‚¬â€œnerilen SatÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸</p>
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
                <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide">
                  <span className="text-muted">Maliyet %{Math.round((bestChannel.total_unit_cost / Math.max(1, bestChannel.sale_price)) * 100)}</span>
                  <span className="text-primary">Net kÃƒÆ’Ã‚Â¢r %{Math.round(bestChannel.profit_margin_percent)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GlassCard className="p-3 sm:p-3">
                  <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted/60">ROI</p>
                  <p className="text-xl font-bold tracking-tight text-foreground">
                    {formatPercent((bestChannel.net_profit / Math.max(1, bestChannel.total_unit_cost)) * 100)}
                  </p>
                </GlassCard>
                <GlassCard className="border-primary/20 bg-primary-soft p-3 sm:p-3">
                  <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-primary/60">Net Marj</p>
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
              <h3 className="panel-title">Kanal KÃƒÆ’Ã‚Â¢rlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±k Matrisi</h3>
              <p className="text-xs font-medium text-muted/60">ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n bazÃƒâ€Ã‚Â±nda platformlar arasÃƒâ€Ã‚Â± finansal performans farkÃƒâ€Ã‚Â±.</p>
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
                      <p className="mt-0.5 text-[10px] font-medium text-muted/60">
                        {formatCurrency(result.sale_price)} <span className="opacity-40">ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢</span> {formatCurrency(result.total_unit_cost)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]",
                        isBest ? "bg-primary-soft text-primary border-border" : "bg-surface-soft text-muted border-border"
                      )}
                    >
                      {isBest ? "En iyi" : "DiÃƒâ€Ã…Â¸er"}
                    </span>
                  </div>

                  <div className="mb-4 flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted/60">Net KÃƒÆ’Ã‚Â¢r</p>
                      <p className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(result.net_profit)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted/60">Marj</p>
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

                  <div className="flex justify-between text-[9px] font-medium uppercase tracking-wide text-muted/60">
                    <span>Vergi & Kargo Dahil</span>
                    <span>%{Math.round(result.profit_margin_percent)} Verim</span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </GlassCard>
      )}

      <ProductComparison />

      <GlassCard className="mt-4">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="panel-title">Veri Kalitesi</h3>
            </div>
            <p className="text-xs font-medium text-muted/60">
              Juri icin veri modunu, guven skorunu ve kritik eksikleri tek yerde ozetler.
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
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Veri kalitesi</span>
              <span className="text-sm font-semibold text-foreground">{dataQualityLabel}</span>
            </div>
            <div className="h-16">
              {chartsReady && isClient ? (
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
            <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted/60">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface-container p-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Veri modu</span>
            <div className="mt-2 flex items-center gap-2">
              <dataModeMeta.icon className={cn("h-4 w-4", dataMode === "live" ? "text-success" : dataMode === "demo" ? "text-primary" : "text-warning")} />
              <p className="text-sm font-semibold text-foreground">{dataModeMeta.label}</p>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted/60">{dataModeMeta.description}</p>

            <div className="mt-4 border-t border-border/60 pt-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Son senkronizasyon</span>
              <p className="mt-2 text-sm font-semibold text-foreground">{formatSyncLabel(dataQuality.lastSyncAt)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-surface-container p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Uyarilar</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/60">
              {dataQuality.warnings.length} kayit
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
        <p className="text-xs leading-snug text-muted/60">
          {methodology || "Analiz, gercek zamanli pazar verileri, komisyon oranlari ve lojistik maliyetleri kullanilarak yapilmistir. Tum veriler tahmini olup kesin finansal sonuc garanti etmez."}
        </p>
      </GlassCard>
    </div>
  );
}

type CompareProduct = {
  id: number;
  name: string;
  sku: string;
  imageUrl: string;
  cost: number;
  packagingCost: number;
  channels: Array<{ channelName: string; salePrice: number; totalCost: number; netProfit: number; margin: number }>;
};

function ProductComparison() {
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [results, setResults] = useState<CompareProduct[] | null>(null);

  const loadProducts = useCallback(async () => {
    if (productsLoaded || productsLoading) return;

    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await fetch("/api/products?limit=50", { cache: "no-store" });
      const data = await res.json();
      if (data?.products) {
        setProducts(data.products);
        setProductsLoaded(true);
        setProductsError(null);
      } else {
        setProductsError("ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n listesi boÃƒâ€¦Ã…Â¸ geldi.");
      }
    } catch {
      setProductsError("ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n listesi yÃƒÆ’Ã‚Â¼klenemedi.");
    } finally {
      setProductsLoading(false);
    }
  }, [productsLoaded, productsLoading]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [loadProducts]);

  const addProduct = (id: number) => {
    if (selected.length < 3 && !selected.includes(id)) {
      setSelected([...selected, id]);
    }
  };

  const removeProduct = (id: number) => {
    setSelected(selected.filter((s) => s !== id));
    setResults(null);
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    setComparing(true);
    setCompareError(null);
    try {
      const params = selected.map((id) => `id=${id}`).join("&");
      const res = await fetch(`/api/products/compare?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.success) {
        setResults(data.products);
      } else {
        setResults(null);
        setCompareError(data?.error || "KarÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±laÃƒâ€¦Ã…Â¸tÃƒâ€Ã‚Â±rma sonuÃƒÆ’Ã‚Â§larÃƒâ€Ã‚Â± alÃƒâ€Ã‚Â±namadÃƒâ€Ã‚Â±.");
      }
    } catch {
      setResults(null);
      setCompareError("KarÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±laÃƒâ€¦Ã…Â¸tÃƒâ€Ã‚Â±rma sonuÃƒÆ’Ã‚Â§larÃƒâ€Ã‚Â± alÃƒâ€Ã‚Â±namadÃƒâ€Ã‚Â±.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-bold text-foreground">Benchmark Analizi</h3>
          <p className="text-xs font-medium text-muted/60">SeÃƒÆ’Ã‚Â§ili ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼nlerin platformlar arasÃƒâ€Ã‚Â± kÃƒÆ’Ã‚Â¢rlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <select
            value=""
            onFocus={() => { void loadProducts(); }}
            onChange={(e) => { if (e.target.value) addProduct(Number(e.target.value)); }}
              className="w-full rounded-md border border-border bg-surface-container px-3 py-2 text-sm font-medium text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 sm:w-[260px]"
          >
            <option value="" disabled className="text-muted">
              {productsLoading && !productsLoaded ? "ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼nler yÃƒÆ’Ã‚Â¼kleniyor..." : "ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n seÃƒÆ’Ã‚Â§in..."}
            </option>
            {products.filter((p) => !selected.includes(p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={runCompare}
            disabled={selected.length < 2 || comparing}
            className="w-full rounded-md bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-colors duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            {comparing ? "ANALÃƒâ€Ã‚Â°Z EDÃƒâ€Ã‚Â°LÃƒâ€Ã‚Â°YOR..." : "KIYASLA"}
          </button>
        </div>
        {productsError && (
          <p className="text-[10px] font-medium text-danger/80">
            {productsError}
          </p>
        )}
        {compareError && (
          <p className="text-[10px] font-medium text-danger/80">
            {compareError}
          </p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selected.map((id) => {
            const name = products.find((p) => p.id === id)?.name ?? String(id);
            return (
              <span key={id} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors duration-200 hover:bg-surface-soft">
                {name}
                <button onClick={() => removeProduct(id)} className="text-base font-semibold leading-none text-muted/60 transition-colors duration-200 hover:text-danger">&times;</button>
              </span>
            );
          })}
        </div>
      )}

      {results && results.length >= 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted/60">
                  <th className="pb-2">ÃƒÆ’Ã…â€œrÃƒÆ’Ã‚Â¼n Spesifikasyonu</th>
                  <th className="pb-2 text-right">Baz Maliyet</th>
                  {results[0]?.channels.map((ch) => (
                    <th key={ch.channelName} className="pb-2 text-right">{ch.channelName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {results.map((p) => (
                  <tr key={p.id} className="group transition-colors duration-200 hover:bg-surface-subtle">
                    <td className="py-3">
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted/60">{p.sku}</p>
                    </td>
                    <td className="py-3 text-right text-xs font-semibold text-muted">
                      {formatCurrency(p.cost + p.packagingCost)}
                    </td>
                    {p.channels.map((ch) => (
                      <td key={ch.channelName} className="py-3 text-right">
                        <div className="space-y-1">
                          <p className={cn("text-sm font-semibold tracking-tight", ch.margin > 30 ? "text-primary" : ch.margin > 15 ? "text-warning" : "text-danger")}>
                            {formatCurrency(ch.netProfit)}
                          </p>
                          <div className="flex flex-col gap-0.5 items-end">
                            <span className="text-[9px] font-medium uppercase tracking-tight text-muted/60">%{Math.round(ch.margin)} Marj</span>
                            <span className="text-[8px] font-medium uppercase tracking-tight text-muted/60">{formatCurrency(ch.totalCost)} Gider</span>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MobileCardList
            className="space-y-3 md:hidden"
            data={results}
            renderItem={(p) => {
              const totalCost = p.cost + p.packagingCost;
              const peakProfit = Math.max(...p.channels.map((ch) => ch.netProfit), 1);
              const bestChannel = p.channels.length > 0
                ? p.channels.reduce((best, ch) => (ch.netProfit > best.netProfit ? ch : best), p.channels[0])
                : null;

              return (
                <GlassCard key={p.id} className="p-3 sm:p-3">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted/60">{p.sku}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted/60">Baz Maliyet</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(totalCost)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {p.channels.map((ch) => {
                      const isBest = bestChannel?.channelName === ch.channelName;
                      const barWidth = Math.max(8, (Math.max(ch.netProfit, 0) / peakProfit) * 100);

                      return (
                        <div
                          key={ch.channelName}
                          className={cn(
                            "rounded-lg border p-3 transition-all duration-200",
                            isBest ? "border-border bg-primary-soft/40" : "border-border bg-surface-soft"
                          )}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{ch.channelName}</p>
                              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted/60">Fiyat {formatCurrency(ch.salePrice)}</p>
                            </div>
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[8px] font-medium uppercase tracking-wide",
                                isBest ? "bg-primary-soft text-primary border-border" : "bg-surface-soft text-muted border-border"
                              )}
                            >
                              {isBest ? "En iyi" : "Alt"}
                            </span>
                          </div>

                          <div className="mb-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted/60">Net KÃƒÆ’Ã‚Â¢r</p>
                              <p className={cn("text-lg font-semibold tracking-tight", ch.margin > 30 ? "text-primary" : ch.margin > 15 ? "text-warning" : "text-danger")}>
                                {formatCurrency(ch.netProfit)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted/60">Marj</p>
                              <p className={cn("text-lg font-semibold tracking-tight", isBest ? "text-primary" : "text-foreground/80")}>
                                %{Math.round(ch.margin)}
                              </p>
                            </div>
                          </div>

                          <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className={cn("h-full rounded-full transition-[width] duration-300", isBest ? "bg-primary" : "bg-border")}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[8px] font-medium uppercase tracking-wide text-muted/60">
                            <span>Masraflar dahil</span>
                            <span>{formatCurrency(ch.totalCost)} maliyet</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              );
            }}
          />
        </div>
      )}
    </GlassCard>
  );
}
