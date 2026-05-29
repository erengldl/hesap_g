"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheckBig,
  Database,
  DollarSign,
  FlaskConical,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SeedDemoButton } from "@/components/demo/SeedDemoButton";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { AggregateDashboard } from "@/lib/portfolio-analytics";
import type { ChannelCostResult, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  fallbackUsed?: boolean;
  results?: ChannelCostResult[];
  bestChannel?: ChannelCostResult;
  product?: Product;
};

const ProductComparisonSection = dynamic(
  () => import("@/components/dashboard/ProductComparison"),
  {
    loading: () => (
      <section className="app-surface rounded-[28px] p-6">
        <div className="h-5 w-48 animate-pulse rounded-full bg-surface-muted" />
        <div className="mt-3 h-20 animate-pulse rounded-[22px] bg-surface-muted" />
      </section>
    ),
  }
);

function getModeMeta(mode: DashboardDataMode) {
  if (mode === "live") {
    return {
      label: "Canlı veri",
      icon: ShieldCheck,
      className: "border-success/20 bg-success/10 text-success",
      text: "Kararlar gerçek ürün ve sipariş verisi üzerinden çalışıyor.",
    };
  }

  if (mode === "demo") {
    return {
      label: "Demo veri",
      icon: FlaskConical,
      className: "border-primary/20 bg-primary/10 text-primary",
      text: "Kurulum akışını örnek veriyle test ediyorsun.",
    };
  }

  return {
    label: "Kısmi veri",
    icon: AlertTriangle,
    className: "border-warning/20 bg-warning/10 text-warning",
    text: "Bazı kartlar canlı, bazıları örnek veriyle destekleniyor.",
  };
}

function getQualityMeta(score: number) {
  if (score >= 80) {
    return {
      label: "Sağlam",
      color: "var(--success)",
      badgeClassName: "border-success/20 bg-success/10 text-success",
      icon: CircleCheckBig,
    };
  }

  if (score >= 50) {
    return {
      label: "İzlenmeli",
      color: "var(--warning)",
      badgeClassName: "border-warning/20 bg-warning/10 text-warning",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Riskli",
    color: "var(--danger)",
    badgeClassName: "border-danger/20 bg-danger/10 text-danger",
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
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [seedDemoError, setSeedDemoError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data?.success) {
          setPayload(data);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aggregate = payload?.aggregate;
  const results = payload?.results ?? [];
  const bestChannel = payload?.bestChannel ?? [...results].sort((a, b) => b.net_profit - a.net_profit)[0] ?? null;
  const modeMeta = getModeMeta(payload?.dataMode ?? "partial");
  const qualityMeta = getQualityMeta(payload?.dataQuality.score ?? 0);
  const qualityScore = Math.max(0, Math.min(100, payload?.dataQuality.score ?? 0));
  const trendData = aggregate?.salesTrend.map((row) => ({
    ...row,
    profit: row.revenue * ((aggregate?.avgMargin ?? 0) / 100),
  })) ?? [];
  const rankedResults = [...results].sort((a, b) => b.net_profit - a.net_profit);
  const maxNetProfit = Math.max(...rankedResults.map((result) => result.net_profit), 1);
  const chartTooltipStyle: CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(30,41,59,0.08)",
    borderRadius: "18px",
    color: "var(--foreground)",
    boxShadow: "var(--shadow-card)",
  };
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)"];

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="app-surface-strong rounded-[32px] p-7">
          <div className="h-4 w-28 animate-pulse rounded-full bg-surface-muted" />
          <div className="mt-4 h-12 w-72 animate-pulse rounded-full bg-surface-muted" />
          <div className="mt-4 h-5 w-full animate-pulse rounded-full bg-surface-muted" />
        </section>
        <div className="grid gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="app-metric-tile h-32 animate-pulse bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!aggregate) {
    return (
      <div className="space-y-6">
        <section className="app-surface-strong rounded-[32px] p-8">
          <span className="app-chip">Kurulum gerekiyor</span>
          <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-foreground">
            Kontrol merkezi veri bekliyor.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-soft">
            İlk görünümü oluşturmak için ürün, sipariş veya demo veri akışını başlatman gerekiyor.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <SeedDemoButton
              className="btn-primary px-6 py-3 text-sm"
              onStart={() => setSeedDemoError(null)}
              onError={setSeedDemoError}
            />
            <Link href="/veri-merkezi" className="btn-secondary px-6 py-3 text-sm">
              Veri merkezine git
            </Link>
          </div>
          {seedDemoError ? (
            <p className="mt-4 text-sm font-medium text-danger">{seedDemoError}</p>
          ) : null}
        </section>
      </div>
    );
  }

  const QualityIcon = qualityMeta.icon;
  const ModeIcon = modeMeta.icon;

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="app-surface-strong relative overflow-hidden rounded-[32px] p-7">
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(15,139,141,0.18),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("app-chip", modeMeta.className)}>
                <ModeIcon className="h-3.5 w-3.5" />
                {modeMeta.label}
              </span>
              <span className="app-chip">Son senkron: {formatSyncLabel(payload?.dataQuality.lastSyncAt ?? null)}</span>
            </div>

            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-[3.4rem]">
              Günün karar alanı: hangi kanal bugün gerçekten daha kârlı?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-soft">
              Veri kalitesi, sipariş akışı ve kanal marjı tek ekranda birleşiyor. Önce açıkları kapat, sonra en iyi kanala odaklan.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-slate-900/8 bg-white/80 p-4">
                <p className="app-section-title">Öne çıkan kanal</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {bestChannel?.channel_name ?? "Belirlenemedi"}
                </p>
                <p className="mt-1 text-sm text-soft">
                  Net kâr: {bestChannel ? formatCurrency(bestChannel.net_profit) : "—"}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-900/8 bg-slate-950 p-4 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Ortalama marj</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {formatPercent(aggregate.avgMargin)}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {formatNumber(aggregate.totalOrders)} siparişten türetildi
                </p>
              </div>
              <div className="rounded-[24px] border border-amber-300/40 bg-amber-50 p-4">
                <p className="app-section-title text-amber-700">Veri kalitesi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
                  %{qualityScore}
                </p>
                <p className="mt-1 text-sm text-amber-900/70">{qualityMeta.label}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/net-maliyet-motoru" className="btn-primary px-6 py-3 text-sm">
                Net maliyeti aç
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/profit-pricing" className="btn-secondary px-6 py-3 text-sm">
                Fiyat senaryolarını incele
              </Link>
              <Link href="/veri-merkezi" className="btn-secondary px-6 py-3 text-sm">
                Veri açıklarını kapat
              </Link>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="app-surface rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-section-title">Sistem modu</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{modeMeta.label}</p>
              </div>
              <span className={cn("rounded-2xl border px-3 py-2", modeMeta.className)}>
                <ModeIcon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-soft">{modeMeta.text}</p>
          </section>

          <section className="app-surface rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-section-title">Kalite skoru</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">%{qualityScore}</p>
              </div>
              <span className={cn("rounded-2xl border px-3 py-2", qualityMeta.badgeClassName)}>
                <QualityIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full" style={{ width: `${qualityScore}%`, backgroundColor: qualityMeta.color }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-soft">
              {payload?.dataQuality.warnings[0] ?? "Veri kalitesi ideal seviyede görünüyor."}
            </p>
          </section>

          <section className="app-surface rounded-[28px] p-5">
            <p className="app-section-title">Hızlı aksiyonlar</p>
            <div className="mt-4 space-y-2.5">
              <Link href="/reklam-analizi" className="flex items-center justify-between rounded-[20px] border border-slate-900/8 bg-white/80 px-4 py-3 text-sm font-semibold text-foreground">
                Reklam etkisini kontrol et
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href="/channel-seo" className="flex items-center justify-between rounded-[20px] border border-slate-900/8 bg-white/80 px-4 py-3 text-sm font-semibold text-foreground">
                SEO akışını güncelle
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </section>
        </aside>
      </section>

      {payload?.fallbackUsed ? (
        <section className="rounded-[24px] border border-warning/20 bg-warning/10 px-5 py-4 text-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              Bazı kartlar yedek veriyle üretildi. Kritik karar öncesinde veri merkezindeki eksik alanları tamamla.
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          title="Toplam ciro"
          value={formatCurrency(aggregate.totalRevenue)}
          detail={`${formatNumber(aggregate.totalOrders)} sipariş`}
          icon={DollarSign}
        />
        <MetricTile
          title="Tahmini net kâr"
          value={formatCurrency(aggregate.totalProfit)}
          detail={bestChannel?.channel_name ? `${bestChannel.channel_name} önde` : "Kanal analizi sürüyor"}
          icon={TrendingUp}
        />
        <MetricTile
          title="Aktif ürün"
          value={String(aggregate.totalProducts)}
          detail="Veri omurgasında kayıtlı"
          icon={Package}
        />
        <MetricTile
          title="Stok riski"
          value={String(aggregate.stockAlerts.length)}
          detail="Kritik seviyedeki ürün"
          icon={ShoppingCart}
          accent="warning"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="app-surface rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="app-section-title">Gelir ritmi</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Son 30 gün ciro ve kâr ivmesi
              </h3>
            </div>
            <span className="app-chip">Trend görünümü</span>
          </div>
          <div className="mt-6 h-[310px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashboardProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(30,41,59,0.08)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickFormatter={(value: string) => value.slice(5)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}K` : `${value}`)}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "revenue" ? "Ciro" : "Net kâr",
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--chart-4)" strokeWidth={2} fill="url(#dashboardRevenue)" />
                  <Area type="monotone" dataKey="profit" stroke="var(--chart-1)" strokeWidth={2.4} fill="url(#dashboardProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel text="Trend oluşturmak için daha fazla satış verisi gerekiyor." />
            )}
          </div>
        </article>

        <article className="app-surface rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-section-title">Kanal karışımı</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Gelir dağılımı
              </h3>
            </div>
            <span className="app-chip">{aggregate.channelBreakdown.length} kanal</span>
          </div>
          <div className="mt-4 h-[230px]">
            {aggregate.channelBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggregate.channelBreakdown}
                    dataKey="revenue"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {aggregate.channelBreakdown.map((_, index) => (
                      <Cell key={index} fill={palette[index % palette.length]} stroke="white" strokeWidth={3} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [formatCurrency(Number(value)), "Ciro"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel text="Gelir dağılımı göstermek için kanal verisi bulunamadı." />
            )}
          </div>
          <div className="mt-4 space-y-2">
            {aggregate.channelBreakdown.map((channel, index) => (
              <div key={channel.slug} className="flex items-center justify-between rounded-[18px] border border-slate-900/6 bg-white/75 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                  <span className="text-sm font-semibold text-foreground">{channel.name}</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {formatCurrency(channel.revenue)} <span className="text-xs">%{channel.pct}</span>
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="app-surface rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="app-section-title">Kanal kıyası</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Hangi kanal net kârda önde?
              </h3>
            </div>
            <Link href="/net-maliyet-motoru" className="app-chip">
              Ayrıntılı tabloyu aç
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {rankedResults.length > 0 ? rankedResults.map((result, index) => {
              const width = result.net_profit > 0 ? Math.max(10, (result.net_profit / maxNetProfit) * 100) : 10;
              const isBest = index === 0;

              return (
                <div key={result.channel_name} className="rounded-[24px] border border-slate-900/8 bg-white/82 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-foreground">{result.channel_name}</p>
                      <p className="mt-1 text-sm text-soft">
                        Toplam maliyet {formatCurrency(result.total_unit_cost)} · satış {formatCurrency(result.sale_price)}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]", isBest ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>
                      {isBest ? "En iyi kanal" : "Alternatif"}
                    </span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className={cn("h-full rounded-full", isBest ? "bg-primary" : "bg-slate-900/20")} style={{ width: `${width}%` }} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="app-section-title">Net kâr</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(result.net_profit)}</p>
                    </div>
                    <div>
                      <p className="app-section-title">Marj</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatPercent(result.profit_margin_percent)}</p>
                    </div>
                    <div>
                      <p className="app-section-title">Sıra</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">#{index + 1}</p>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <EmptyPanel text="Kanal karşılaştırması için sonuç üretilemedi." />
            )}
          </div>
        </article>

        <div className="space-y-5">
          <article className="app-surface rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-section-title">Stok durumu</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Müdahale gerektiren ürünler
                </h3>
              </div>
              <span className="app-chip">{aggregate.stockAlerts.length} kayıt</span>
            </div>
            <div className="mt-5 space-y-3">
              {aggregate.stockAlerts.length > 0 ? aggregate.stockAlerts.slice(0, 5).map((alert) => (
                <div key={`${alert.id}-${alert.channel}`} className="rounded-[22px] border border-slate-900/8 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{alert.name}</p>
                      <p className="mt-1 text-sm text-soft">{alert.channel}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]", alert.stock < 5 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")}>
                      {alert.stock} adet
                    </span>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-success/20 bg-success/10 px-4 py-4 text-sm font-medium text-success">
                  Kritik stok alarmı yok.
                </div>
              )}
            </div>
          </article>

          <article className="app-surface rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-section-title">Veri sağlığı</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Eksik alanlar ve güven sinyali
                </h3>
              </div>
              <span className={cn("app-chip", qualityMeta.badgeClassName)}>
                <QualityIcon className="h-3.5 w-3.5" />
                {qualityMeta.label}
              </span>
            </div>
            <div className="mt-5 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={[{ name: "score", value: qualityScore }]} layout="vertical" margin={{ top: 8, right: 0, left: 0, bottom: 8 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Bar dataKey="value" radius={[999, 999, 999, 999]} fill={qualityMeta.color} background={{ fill: "var(--surface-muted)" }} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-2">
              {payload?.dataQuality.warnings.length ? payload.dataQuality.warnings.slice(0, 3).map((warning) => (
                <div key={warning} className="rounded-[18px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  {warning}
                </div>
              )) : (
                <div className="rounded-[18px] border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                  Kritik veri uyarısı yok.
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      <ProductComparisonSection />
    </div>
  );
}

function MetricTile({
  title,
  value,
  detail,
  icon: Icon,
  accent = "default",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
  accent?: "default" | "warning";
}) {
  return (
    <article className="app-metric-tile">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-section-title">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">{value}</p>
          <p className="mt-2 text-sm text-soft">{detail}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", accent === "warning" ? "bg-amber-100 text-amber-700" : "bg-slate-950 text-white")}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-[24px] border border-dashed border-slate-900/10 bg-surface-soft px-6 text-center text-sm text-soft">
      {text}
    </div>
  );
}
