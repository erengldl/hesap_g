"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PageHeader, KpiCard, GlassCard, WarningBadge, SkeletonCard, EmptyState } from "@/components/ui-custom/GlassComponents";
import {
  TrendingUp, Wallet, BarChart3, ShoppingCart, Target, Zap, Info,
  Package, AlertTriangle, DollarSign, Activity, ChevronRight, Megaphone, Database, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult, Product } from "@/lib/types";
import type { AggregateDashboard } from "@/lib/portfolio-analytics";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area,
} from "recharts";

type DashboardPayload = {
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

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

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
  const methodology = payload?.methodology ?? agg?.methodology ?? "";
  const adSummary = payload?.adAnalysis ?? null;
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
        <PageHeader eyebrow="Genel Bakış" title="Özet" description="Satış kanalları ve kârlılığı kısa bakışta görün." />
        <EmptyState
          icon={BarChart3}
          title="Henüz özet oluşturulmadı"
          description="Özetin görünmesi için önce ürün ve sipariş verisi ekleyin."
          action={(
            <Link
              href="/veri-merkezi"
              className="btn-primary py-3 px-6 text-sm"
            >
              Ürün Merkezini Aç
            </Link>
          )}
        />
      </div>
    );
  }

  const trendMax = Math.max(...agg.salesTrend.map((d) => d.revenue), 1);

  return (
    <div className="page-shell">
      <PageHeader eyebrow="Genel Bakış" title="Özet" description="Tüm ürünler, kanallar ve siparişler üzerinden kısa finansal özet.">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-medium text-muted">
          <Zap className="h-3 w-3 text-primary" />
          Canlı Analiz
        </div>
      </PageHeader>

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
            subValue={`${formatNumber(adSummary.totalCampaigns)} kampanya`}
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
            title="Kâr oranı"
            value={`${adSummary.averagePoas.toFixed(2)}x`}
            subValue="Kâr / harcama"
            icon={TrendingUp}
          />
          <KpiCard
            title="Kritik Kampanyalar"
            value={formatNumber(adSummary.lossMakingCount)}
            subValue={`${adSummary.watchCount} takip · ${adSummary.scaleCount} ölçek`}
            icon={AlertTriangle}
            className="border-danger/20 bg-danger/[0.03]"
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
              <WarningBadge>30 Günlük Veri</WarningBadge>
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
            <h3 className="panel-title">Lider Ürünler</h3>
            <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-medium text-muted">Brüt Ciro</span>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/60">
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
                      <p className="mt-0.5 text-[10px] text-muted/60">{p.sku}</p>
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">{formatNumber(p.orders)}</td>
                    <td className="py-2.5 text-right text-sm font-bold text-primary">{formatCurrency(p.revenue)}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex rounded-md border border-border bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                        %{p.margin}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {agg.topProducts.map((p, index) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface-container p-3">
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
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">Sipariş</p>
                    <p className="text-sm font-bold text-foreground">{formatNumber(p.orders)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2">
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">Ciro</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(p.revenue)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-soft p-2 text-right">
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-muted/60">Marj</p>
                    <p className="text-sm font-bold text-primary">%{p.margin}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="panel-title mb-3">Stok Envanter Durumu</h3>
          {agg.stockAlerts.length > 0 ? (
            <div className="space-y-2">
              {agg.stockAlerts.slice(0, 6).map((alert, i) => (
                <div key={`${alert.id}-${i}`} className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-2.5",
                  alert.stock < 5 ? "border-danger/30 bg-danger/[0.03]" :
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
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-container p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                <Package className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground">Stoklar güvende</p>
              <p className="mt-1 text-xs text-muted">Şu an müdahale gerektiren ürün bulunmuyor.</p>
            </div>
          )}

          {bestChannel && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface-container p-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-primary/80">En iyi kanal</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {bestChannelName} üzerinden <span className="text-primary">{formatCurrency(bestChannel.net_profit)}</span> net kâr elde ediliyor.
                </p>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {bestChannel && payload?.costBreakdown && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard>
            <h3 className="panel-title mb-3">Maliyet Kırılımı ({bestChannelName})</h3>
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
            <h3 className="panel-title mb-3">Başabaş Analizi</h3>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted/60">Birim Maliyet</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{formatCurrency(bestChannel.total_unit_cost)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted/60">Önerilen Satış</p>
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
                  <span className="text-primary">Net kâr %{Math.round(bestChannel.profit_margin_percent)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-surface-container p-3">
                  <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted/60">ROI</p>
                  <p className="text-xl font-bold tracking-tight text-foreground">
                    {formatPercent((bestChannel.net_profit / Math.max(1, bestChannel.total_unit_cost)) * 100)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-primary-soft p-3">
                  <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-primary/60">Net Marj</p>
                  <p className="text-xl font-bold tracking-tight text-primary">
                    {formatPercent(bestChannel.profit_margin_percent)}
                  </p>
                </div>
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
              <p className="text-xs font-medium text-muted/60">Ürün bazında platformlar arası finansal performans farkı.</p>
            </div>
            <WarningBadge>Sistem Tahmini</WarningBadge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {rankedResults.map((result) => {
              const isBest = result.channel_name === bestChannelName;
              const profitShare = result.net_profit > 0 ? Math.max(8, (result.net_profit / maxChannelProfit) * 100) : 8;

              return (
                <div
                  key={result.channel_name}
                  className={cn(
                    "group rounded-lg border p-3",
                    isBest ? "border-border bg-primary-soft/40" : "border-border bg-surface-container"
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{result.channel_name}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted/60">
                        {formatCurrency(result.sale_price)} <span className="opacity-40">→</span> {formatCurrency(result.total_unit_cost)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]",
                        isBest ? "bg-primary-soft text-primary border-border" : "bg-surface-soft text-muted border-border"
                      )}
                    >
                      {isBest ? "En iyi" : "Diğer"}
                    </span>
                  </div>

                  <div className="mb-4 flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted/60">Net Kâr</p>
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
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <ProductComparison />

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-surface-container p-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <p className="text-xs leading-snug text-muted/60">
          {methodology || "Analiz, gerçek zamanlı pazar verileri, komisyon oranları ve lojistik maliyetleri kullanılarak yapılmıştır. Tüm veriler tahmini olup kesin finansal sonuç garanti etmez."}
        </p>
      </div>
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
        setProductsError("Ürün listesi boş geldi.");
      }
    } catch {
      setProductsError("Ürün listesi yüklenemedi.");
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
        setCompareError(data?.error || "Karşılaştırma sonuçları alınamadı.");
      }
    } catch {
      setResults(null);
      setCompareError("Karşılaştırma sonuçları alınamadı.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-bold text-foreground">Benchmark Analizi</h3>
          <p className="text-xs font-medium text-muted/60">Seçili ürünlerin platformlar arası kârlılığı.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <select
            value=""
            onFocus={() => { void loadProducts(); }}
            onChange={(e) => { if (e.target.value) addProduct(Number(e.target.value)); }}
              className="w-full rounded-md border border-border bg-surface-container px-3 py-2 text-sm font-medium text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 sm:w-[260px]"
          >
            <option value="" disabled className="text-muted">
              {productsLoading && !productsLoaded ? "Ürünler yükleniyor..." : "Ürün seçin..."}
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
            {comparing ? "ANALİZ EDİLİYOR..." : "KIYASLA"}
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
                  <th className="pb-2">Ürün Spesifikasyonu</th>
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

          <div className="space-y-3 md:hidden">
            {results.map((p) => {
              const totalCost = p.cost + p.packagingCost;
              const peakProfit = Math.max(...p.channels.map((ch) => ch.netProfit), 1);
              const bestChannel = p.channels.length > 0
                ? p.channels.reduce((best, ch) => (ch.netProfit > best.netProfit ? ch : best), p.channels[0])
                : null;

              return (
                <div key={p.id} className="rounded-lg border border-border bg-surface-container p-3">
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
                              <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted/60">Net Kâr</p>
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
