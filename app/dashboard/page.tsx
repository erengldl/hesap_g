"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Database,
  DollarSign,
  Info,
  LineChart as LineChartIcon,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartCard,
  EmptyState,
  FinancialTooltip,
  GlassCard,
  KpiCard,
  ModuleFlowBar,
  PageHeader,
  SkeletonCard,
  StatusBadge,
} from "@/components/ui-custom/GlassComponents";
import {
  buildDashboardViewModel,
  type DashboardAction,
  type DashboardKpi,
  type DashboardPayload,
  type DashboardSignal,
  type DashboardTopProduct,
} from "@/lib/dashboard-view-model";
import { cn } from "@/lib/utils";

const KPI_ICONS: Record<DashboardKpi["id"], React.ElementType> = {
  "net-profit": Wallet,
  revenue: DollarSign,
  margin: TrendingUp,
  "critical-alerts": ShieldAlert,
};

function formatTrendDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(date);
}

function hasMeaningfulData(payload: DashboardPayload | null) {
  const aggregate = payload?.aggregate;
  if (!aggregate) return false;

  return aggregate.totalProducts > 0 || aggregate.totalOrders > 0 || aggregate.salesTrend.length > 0;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data?.success) {
          setPayload(data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Dashboard load error:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => controller.abort();
  }, []);

  const viewModel = useMemo(() => {
    if (!payload?.aggregate) return null;
    return buildDashboardViewModel(payload);
  }, [payload]);

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader title="Bugün ne yapmalısın?" description="Veriler hazırlanıyor..." />
        <div className="mb-4">
          <SkeletonCard className="h-[72px]" />
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => <SkeletonCard key={index} className="h-[148px]" />)}
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
          <SkeletonCard className="h-[360px]" />
          <SkeletonCard className="h-[360px]" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard className="h-[300px]" />
          <SkeletonCard className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!payload?.aggregate || !viewModel || !hasMeaningfulData(payload)) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Bugün ne yapmalısın?"
          description="Kontrol yüzeyi karar üretmek için veri bekliyor. İlk akış veri hazırlığıyla başlar."
        />
        <EmptyState
          icon={Database}
          title="Önce veri hazırlığını tamamlayın"
          description="Dashboard sonuçları göstermeli. Ürün, katalog veya sipariş akışı eklenmeden bu ekran karar özeti üretemez."
          action={(
            <Link href="/veri-merkezi" className="btn-primary px-5 py-3 text-sm">
              Veri Merkezi'ni Aç
            </Link>
          )}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title={viewModel.headline} description={viewModel.description} />

      <div className="mb-4 flex flex-wrap gap-2">
        {viewModel.actions.map((action) => (
          <StatusBadge key={action.id} tone={action.severity}>
            {action.title}
          </StatusBadge>
        ))}
      </div>

      <ModuleFlowBar steps={viewModel.flowSteps} className="mb-4" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {viewModel.kpis.map((kpi) => {
          const Icon = KPI_ICONS[kpi.id];

          return (
            <KpiCard
              key={kpi.id}
              title={kpi.label}
              value={kpi.value}
              subValue={kpi.detail}
              icon={Icon}
              tone={kpi.tone}
            />
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <ChartCard
          title="Kârlılık Trendi"
          description="Gelir akışından türetilen tahmini net kâr ve sipariş ritmi tek grafikte toplandı."
          aside={<StatusBadge tone="neutral">{viewModel.trendSummary}</StatusBadge>}
        >
          <div className="h-[300px] min-w-0">
            {viewModel.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={viewModel.trend} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--profit)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" strokeOpacity={0.22} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    strokeOpacity={0.45}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatTrendDate}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    strokeOpacity={0.45}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}K` : String(Math.round(value))}
                  />
                  <Tooltip
                    content={(
                      <FinancialTooltip
                        title="Kârlılık Trendi"
                        labelFormatter={formatTrendDate}
                        note="Gelir ve tahmini net kâr aynı veri akışından okunur."
                        series={[
                          { key: "estimatedProfit", label: "Tahmini net kâr" },
                          { key: "revenue", label: "Ciro" },
                          { key: "orders", label: "Sipariş", formatter: (value) => `${Math.round(value)} sipariş` },
                        ]}
                      />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="estimatedProfit"
                    stroke="var(--profit)"
                    strokeWidth={2.2}
                    fill="url(#profitArea)"
                    dot={false}
                    isAnimationActive
                    animationDuration={340}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive
                    animationDuration={340}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-container/65 text-sm text-muted">
                Yeterli trend verisi birikmedi.
              </div>
            )}
          </div>
        </ChartCard>

        <GlassCard className="h-full">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="panel-title">Acil Aksiyonlar</h3>
              <p className="mt-1 text-sm leading-6 text-muted">Karar sırası önce veri ve marj riskinden başlar.</p>
            </div>
            <StatusBadge tone="warning">Bugün</StatusBadge>
          </div>

          <div className="space-y-3">
            {viewModel.actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="panel-title">Lider Ürünler</h3>
              <p className="mt-1 text-sm text-muted">Karar üretmeye en yakın ilk 5 ürün.</p>
            </div>
            <StatusBadge tone="neutral">Top 5</StatusBadge>
          </div>

          <div className="space-y-2">
            {viewModel.topProducts.map((product) => (
              <TopProductRow key={product.id} product={product} />
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="panel-title">Risk ve Sinyaller</h3>
              <p className="mt-1 text-sm text-muted">Stok, reklam ve anlık kârlılık sinyalleri.</p>
            </div>
            <StatusBadge tone="neutral">Canlı</StatusBadge>
          </div>

          <div className="space-y-2">
            {viewModel.signals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/80 bg-surface-container/70 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Metodoloji</p>
          <p className="mt-1 text-sm leading-6 text-muted">{viewModel.methodology}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: DashboardAction }) {
  return (
    <GlassCard
      interactive
      className={cn(
        "p-4",
        action.severity === "loss"
          ? "border-loss/20 bg-loss/[0.03]"
          : action.severity === "warning"
            ? "border-warning/20 bg-warning/[0.03]"
            : action.severity === "profit"
              ? "border-profit/20 bg-profit/[0.03]"
              : "border-border/80 bg-surface-soft/75"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={action.severity}>{action.badge}</StatusBadge>
          </div>
          <p className="text-sm font-semibold text-foreground">{action.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
        </div>
      </div>
      <Link href={action.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
        {action.ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </GlassCard>
  );
}

function TopProductRow({ product }: { product: DashboardTopProduct }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-soft/75 px-4 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-surface-container"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{product.sku}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Ciro</p>
          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{product.revenue}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Sipariş</p>
          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{product.orders}</p>
        </div>
        <StatusBadge tone={product.tone}>{product.margin}</StatusBadge>
      </div>
    </Link>
  );
}

function SignalRow({ signal }: { signal: DashboardSignal }) {
  return (
    <Link
      href={signal.href}
      className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-soft/75 px-4 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-surface-container"
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <StatusBadge tone={signal.severity}>{signal.value}</StatusBadge>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{signal.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{signal.description}</p>
      </div>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        signal.severity === "loss"
          ? "bg-loss/12 text-loss"
          : signal.severity === "warning"
            ? "bg-warning/12 text-warning"
            : signal.severity === "profit"
              ? "bg-profit/12 text-profit"
              : "bg-surface-container text-stable"
      )}>
        {signal.severity === "loss" ? <AlertTriangle className="h-4 w-4" /> : signal.severity === "profit" ? <LineChartIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
      </div>
    </Link>
  );
}
