"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  ChartColumn,
  CircleAlert,
  CircleCheckBig,
  Package,
  PencilLine,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { EmptyState, GlassCard, PageHeader, SkeletonCard, StatusBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDate, formatDecimal, formatNumber } from "@/lib/formatters";
import {
  buildProductDetailViewModel,
  type ProductDetailResponse,
  type ProductDetailSalesSummary,
  type ProductDetailTone,
  type ProductDetailViewModel,
} from "@/lib/product-detail-view-model";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<ProductDetailViewModel["nextActionId"], LucideIcon> = {
  edit: PencilLine,
  optimize: Target,
  forecast: TrendingUp,
  seo: Sparkles,
};

const TONE_SURFACE_STYLES: Record<ProductDetailTone, string> = {
  profit: "border-profit/20 bg-profit/[0.05]",
  warning: "border-warning/20 bg-warning/[0.06]",
  loss: "border-loss/20 bg-loss/[0.06]",
  neutral: "border-border/80 bg-surface-soft/70",
};

const TONE_TEXT_STYLES: Record<ProductDetailTone, string> = {
  profit: "text-profit",
  warning: "text-warning",
  loss: "text-loss",
  neutral: "text-foreground",
};

function parseId(value: string | string[] | undefined) {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function renderMetricValue(value: number | string, kind: "currency" | "percent" | "text") {
  if (kind === "currency") {
    return formatCurrency(Number(value));
  }

  if (kind === "percent") {
    return `${formatDecimal(Number(value), 1, 1)}%`;
  }

  return typeof value === "number" ? formatNumber(value) : String(value);
}

function toneBadge(tone: ProductDetailTone) {
  switch (tone) {
    case "profit":
      return "profit" as const;
    case "warning":
      return "warning" as const;
    case "loss":
      return "loss" as const;
    default:
      return "neutral" as const;
  }
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { units: number; revenue: number; estimatedProfit: number; date: string } }>;
  label?: string | number;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="min-w-[220px] rounded-xl border border-border/80 bg-panel/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {point.date ? formatDate(point.date) : String(label ?? "")}
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">Units sold</span>
          <span className="font-semibold text-foreground tabular-nums">{formatNumber(point.units)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">Revenue</span>
          <span className="font-semibold text-foreground tabular-nums">{formatCurrency(point.revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">Estimated profit</span>
          <span className="font-semibold text-profit tabular-nums">{formatCurrency(point.estimatedProfit)}</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4 sm:mb-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function ActionButton({
  label,
  href,
  emphasis,
  icon: Icon,
}: {
  label: string;
  href: string;
  emphasis: "primary" | "secondary";
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
        emphasis === "primary"
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:brightness-110"
          : "border border-border/80 bg-surface-container text-foreground hover:border-primary/20 hover:text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function SummaryMetricCard({
  label,
  value,
  caption,
  tone,
  kind,
}: {
  label: string;
  value: number | string;
  caption: string;
  tone: ProductDetailTone;
  kind: "currency" | "percent" | "text";
}) {
  return (
    <GlassCard className={cn("h-full p-4 sm:p-5", TONE_SURFACE_STYLES[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-3 text-[1.55rem] font-semibold tracking-[-0.03em] tabular-nums", TONE_TEXT_STYLES[tone])}>
        {renderMetricValue(value, kind)}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">{caption}</p>
    </GlassCard>
  );
}

function BreakdownRow({
  label,
  value,
  shareOfPrice,
  tone,
}: {
  label: string;
  value: number;
  shareOfPrice: number;
  tone: ProductDetailTone;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-container/75 p-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
            {formatDecimal(Math.max(0, shareOfPrice), 1, 0)}% of sale price
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-semibold tabular-nums", TONE_TEXT_STYLES[tone])}>{formatCurrency(value)}</p>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "profit"
              ? "bg-profit"
              : tone === "warning"
                ? "bg-warning"
                : tone === "loss"
                  ? "bg-loss"
                  : "bg-primary/55"
          )}
          style={{ width: `${Math.max(4, Math.min(100, shareOfPrice))}%` }}
        />
      </div>
    </div>
  );
}

function HighlightCard({
  label,
  value,
  caption,
  tone,
  kind,
}: {
  label: string;
  value: number | string;
  caption: string;
  tone: ProductDetailTone;
  kind: "currency" | "percent" | "text";
}) {
  return (
    <div className={cn("rounded-xl border p-4", TONE_SURFACE_STYLES[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{renderMetricValue(value, kind)}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>
    </div>
  );
}

function ChannelCard({
  card,
}: {
  card: ProductDetailViewModel["channelCards"][number];
}) {
  return (
    <GlassCard className={cn("h-full p-4", TONE_SURFACE_STYLES[card.tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{card.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {card.isActive ? "Channel is live for this product." : "No active setup found for this channel."}
          </p>
        </div>
        <StatusBadge tone={toneBadge(card.tone)}>{card.toneLabel}</StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile label="Sale price" value={card.salePrice} tone="neutral" />
        <MetricTile
          label="Buybox price"
          value={card.buyboxPrice}
          tone={card.buyboxPrice && card.salePrice && card.salePrice > card.buyboxPrice ? "warning" : "neutral"}
          emptyLabel={card.id === "own-website" ? "Direct channel" : "Not available"}
        />
        <MetricTile label="Shipping cost" value={card.shippingCost} tone="warning" />
        <MetricTile label="Commission" value={card.commissionCost} tone="warning" />
        <MetricTile label="Net profit" value={card.netProfit} tone={card.tone} />
        <MetricTile
          label="Margin"
          value={card.margin}
          tone={card.tone}
          isPercent
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <p className="min-h-6 text-sm leading-6 text-muted">
          {card.warningNotes ?? (card.isActive ? "No immediate warning on this channel." : "Activate pricing to compare this channel.")}
        </p>
        <Link href={card.href} className="shrink-0 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
          {card.actionLabel}
        </Link>
      </div>
    </GlassCard>
  );
}

function MetricTile({
  label,
  value,
  tone,
  emptyLabel = "Missing",
  isPercent = false,
}: {
  label: string;
  value: number | null;
  tone: ProductDetailTone;
  emptyLabel?: string;
  isPercent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("mt-2 text-sm font-semibold tabular-nums", TONE_TEXT_STYLES[tone])}>
        {typeof value === "number" && Number.isFinite(value)
          ? isPercent
            ? `${formatDecimal(value, 1, 1)}%`
            : formatCurrency(value)
          : emptyLabel}
      </p>
    </div>
  );
}

function RiskStat({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: ProductDetailTone;
}) {
  return (
    <div className={cn("rounded-xl border p-4", TONE_SURFACE_STYLES[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-2 text-base font-semibold tabular-nums", TONE_TEXT_STYLES[tone])}>{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>
    </div>
  );
}

function ScoreRing({
  score,
  tone,
}: {
  score: number;
  tone: ProductDetailTone;
}) {
  const color =
    tone === "profit"
      ? "var(--profit)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "loss"
          ? "var(--loss)"
          : "var(--primary)";

  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, color-mix(in srgb, var(--surface-strong) 80%, transparent) 0deg)`,
      }}
    >
      <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border border-border/70 bg-surface text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">{score}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Score</p>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({
  label,
  ready,
  tone,
  hint,
  actionLabel,
  href,
}: {
  label: string;
  ready: boolean;
  tone: ProductDetailTone;
  hint: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface-container/70 px-3.5 py-3">
      <div className="flex min-w-0 gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_SURFACE_STYLES[tone])}>
          {ready ? <CircleCheckBig className="h-4 w-4 text-profit" /> : <CircleAlert className={cn("h-4 w-4", TONE_TEXT_STYLES[tone])} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
        </div>
      </div>
      {!ready ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
          {actionLabel}
        </Link>
      ) : (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-profit">Ready</span>
      )}
    </div>
  );
}

function SalesSummaryTiles({
  summary,
  momentumLabel,
  momentumPercent,
}: {
  summary: ProductDetailSalesSummary | null;
  momentumLabel: string;
  momentumPercent: number | null;
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <HighlightCard
        label="Units sold"
        value={summary?.totalUnits ?? 0}
        caption="Selected range total"
        tone="neutral"
        kind="text"
      />
      <HighlightCard
        label="Revenue"
        value={summary?.totalRevenue ?? 0}
        caption="Gross sales in this window"
        tone="neutral"
        kind="currency"
      />
      <HighlightCard
        label="Daily demand"
        value={summary?.avgDailyUnits ?? 0}
        caption="Average units per day"
        tone="neutral"
        kind="text"
      />
      <HighlightCard
        label="Momentum"
        value={momentumPercent === null ? momentumLabel : `${momentumPercent >= 0 ? "+" : ""}${formatDecimal(momentumPercent, 1, 1)}%`}
        caption={momentumLabel}
        tone={momentumPercent === null ? "neutral" : momentumPercent >= 12 ? "profit" : momentumPercent <= -12 ? "warning" : "neutral"}
        kind="text"
      />
    </div>
  );
}

export default function ProductDetailClient() {
  const params = useParams();
  const productId = parseId(params?.id);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<30 | 90>(30);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setError("Invalid product.");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const loadProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json()) as ProductDetailResponse;

        if (!response.ok || !json.success) {
          throw new Error("Product detail could not be loaded.");
        }

        if (!controller.signal.aborted) {
          setData(json);
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : "Product detail could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadProduct();

    return () => controller.abort();
  }, [productId]);

  const viewModel = useMemo(() => (data ? buildProductDetailViewModel(data) : null), [data]);
  const trendData = selectedRange === 90 ? viewModel?.trend90 ?? [] : viewModel?.trend30 ?? [];
  const trendSummary = selectedRange === 90 ? viewModel?.trendSummaries[90] ?? null : viewModel?.trendSummaries[30] ?? null;
  const primaryActionIcon = viewModel ? ACTION_ICONS[viewModel.nextActionId] : Target;

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader title="Product detail" description="Financial and product context is loading..." />
        <div className="space-y-4">
          <SkeletonCard className="h-[250px]" />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonCard key={index} className="h-[140px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="space-y-6">
              <SkeletonCard className="h-[420px]" />
              <SkeletonCard className="h-[360px]" />
              <SkeletonCard className="h-[420px]" />
            </div>
            <div className="space-y-6">
              <SkeletonCard className="h-[300px]" />
              <SkeletonCard className="h-[330px]" />
              <SkeletonCard className="h-[360px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !viewModel) {
    return (
      <div className="page-shell">
        <PageHeader title="Product detail" description={error ?? "Product detail is not available."}>
          <Link href="/veri-merkezi" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Product list
          </Link>
        </PageHeader>
        <EmptyState
          icon={Package}
          title="Product detail could not be opened"
          description={error ?? "This product is unavailable right now."}
          action={(
            <Link href="/veri-merkezi" className="btn-primary">
              Back to Data Center
            </Link>
          )}
        />
      </div>
    );
  }

  const PrimaryActionIcon = primaryActionIcon;

  return (
    <div className="page-shell pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/veri-merkezi" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors duration-200 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-container shadow-[var(--shadow-soft)] sm:h-32 sm:w-32">
                {viewModel.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewModel.imageUrl}
                    alt={viewModel.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-10 w-10 text-primary/60" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={toneBadge(viewModel.status.tone)}>{viewModel.status.label}</StatusBadge>
                  {viewModel.activeChannelLabels.map((channel) => (
                    <div
                      key={channel}
                      className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {channel}
                    </div>
                  ))}
                </div>

                <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.35rem]">
                  {viewModel.title}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                  <span className="font-semibold text-foreground">SKU {viewModel.sku}</span>
                  <span>{viewModel.category}</span>
                  <span>{viewModel.activeChannelLabels.length || 0} active channels</span>
                </div>

                <p className="mt-4 max-w-4xl text-sm leading-6 text-muted">{viewModel.description}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 bg-surface-soft/45 p-5 sm:p-6 xl:border-l xl:border-t-0">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {viewModel.actions.map((action) => {
                const Icon = ACTION_ICONS[action.id];
                return (
                  <ActionButton
                    key={action.id}
                    label={action.label}
                    href={action.href}
                    emphasis={action.emphasis}
                    icon={Icon}
                  />
                );
              })}
            </div>

            <div className={cn("mt-4 rounded-2xl border p-4", TONE_SURFACE_STYLES[viewModel.nextAction.tone])}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Next best action</p>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">{viewModel.recommendationTitle}</h2>
                </div>
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_SURFACE_STYLES[viewModel.nextAction.tone])}>
                  <PrimaryActionIcon className={cn("h-4 w-4", TONE_TEXT_STYLES[viewModel.nextAction.tone])} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{viewModel.recommendationSummary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {viewModel.recommendationReasons.map((reason) => (
                  <div
                    key={reason}
                    className="inline-flex items-center rounded-md border border-border/70 bg-surface/70 px-2.5 py-1 text-[11px] font-medium text-muted"
                  >
                    {reason}
                  </div>
                ))}
              </div>
              <Link href={viewModel.nextAction.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
                {viewModel.nextAction.label}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {viewModel.topSummary.map((metric) => (
          <SummaryMetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            caption={metric.caption}
            tone={metric.tone}
            kind={metric.kind}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-6">
          <GlassCard>
            <SectionHeader
              title="Product financial snapshot"
              description="Reference lens uses the average of active channel economics, so you can see where the unit price goes before deciding on pricing."
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
              <div className="space-y-3">
                {viewModel.financialBreakdown.map((item) => (
                  <BreakdownRow
                    key={item.id}
                    label={item.label}
                    value={item.value}
                    shareOfPrice={item.shareOfPrice}
                    tone={item.tone}
                  />
                ))}
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {viewModel.financialHighlights.map((item) => (
                    <HighlightCard
                      key={item.id}
                      label={item.label}
                      value={item.value}
                      caption={item.caption}
                      tone={item.tone}
                      kind={item.kind}
                    />
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Channel performance"
              description="Each channel card exposes the exact commercial pressure points: price, buybox, shipping, commission, profit, and margin."
            />

            <div className="grid gap-4 xl:grid-cols-3">
              {viewModel.channelCards.map((card) => (
                <ChannelCard key={card.id} card={card} />
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader
                title="Sales history trend"
                description="The chart stays compact on purpose: one sales area and one estimated profit line, with glass tooltip detail."
              />

              <div className="inline-flex rounded-xl border border-border/80 bg-surface-container p-1">
                {[30, 90].map((windowDays) => (
                  <button
                    key={windowDays}
                    type="button"
                    onClick={() => setSelectedRange(windowDays as 30 | 90)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200",
                      selectedRange === windowDays
                        ? "bg-primary text-primary-foreground"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {windowDays}D
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[340px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={trendData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="units"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(Number(value))}
                  />
                  <YAxis yAxisId="profit" hide />
                  <Tooltip content={<TrendTooltip />} />
                  <Area
                    yAxisId="units"
                    type="monotone"
                    dataKey="units"
                    stroke="var(--primary)"
                    strokeWidth={2.1}
                    fill="url(#salesTrendFill)"
                    activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--panel-bg)", strokeWidth: 2 }}
                    dot={false}
                    name="Units"
                  />
                  <Line
                    yAxisId="profit"
                    type="monotone"
                    dataKey="estimatedProfit"
                    stroke="var(--profit)"
                    strokeWidth={2.2}
                    dot={false}
                    name="Estimated profit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <SalesSummaryTiles
              summary={trendSummary}
              momentumLabel={viewModel.stockRisk.momentumLabel}
              momentumPercent={viewModel.stockRisk.momentumPercent}
            />
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <SectionHeader
              title="Stock and demand risk"
              description="This section translates inventory and recent demand into a concrete coverage signal."
            />

            <div className={cn("rounded-2xl border p-4", TONE_SURFACE_STYLES[viewModel.stockRisk.tone])}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Coverage status</p>
                  <p className={cn("mt-2 text-[1.8rem] font-semibold tracking-[-0.03em]", TONE_TEXT_STYLES[viewModel.stockRisk.tone])}>
                    {viewModel.stockRisk.coverageDays === null
                      ? viewModel.stockRisk.label
                      : `${Math.max(1, Math.round(viewModel.stockRisk.coverageDays))} days`}
                  </p>
                </div>
                <StatusBadge tone={toneBadge(viewModel.stockRisk.tone)}>{viewModel.stockRisk.label}</StatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{viewModel.stockRisk.riskNote}</p>
            </div>

            <div className="mt-4 grid gap-3">
              <RiskStat
                label="Stock on hand"
                value={formatNumber(viewModel.stockRisk.stockOnHand)}
                caption="Latest available inventory snapshot"
                tone={viewModel.stockRisk.stockOnHand > 0 ? "neutral" : "loss"}
              />
              <RiskStat
                label="Daily demand"
                value={formatDecimal(viewModel.stockRisk.avgDailyUnits, 1, 0)}
                caption="Average units sold per day"
                tone="neutral"
              />
              <RiskStat
                label="Demand signal"
                value={
                  viewModel.stockRisk.momentumPercent === null
                    ? viewModel.stockRisk.momentumLabel
                    : `${viewModel.stockRisk.momentumPercent >= 0 ? "+" : ""}${formatDecimal(viewModel.stockRisk.momentumPercent, 1, 1)}%`
                }
                caption={viewModel.stockRisk.momentumLabel}
                tone={
                  viewModel.stockRisk.momentumPercent === null
                    ? "neutral"
                    : viewModel.stockRisk.momentumPercent >= 12
                      ? "profit"
                      : viewModel.stockRisk.momentumPercent <= -12
                        ? "warning"
                        : "neutral"
                }
              />
            </div>

            <Link href={viewModel.stockRisk.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
              {viewModel.stockRisk.actionLabel}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="SEO and content readiness"
              description="Commercial performance is only part of the picture. This score checks whether the listing content is ready to support discovery."
            />

            <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-surface-container/75 p-4">
              <ScoreRing score={viewModel.seoReadiness.score} tone={viewModel.seoReadiness.tone} />
              <div>
                <StatusBadge tone={toneBadge(viewModel.seoReadiness.tone)}>{viewModel.seoReadiness.label}</StatusBadge>
                <p className="mt-3 text-sm leading-6 text-muted">{viewModel.seoReadiness.summary}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {viewModel.seoReadiness.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 bg-surface-container/70 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums", TONE_TEXT_STYLES[item.tone])}>{item.score}</span>
                  </div>
                </div>
              ))}
            </div>

            <Link href={viewModel.seoReadiness.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
              Generate SEO
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Product data completeness"
              description="This checklist makes missing inputs obvious, so the team knows exactly what blocks a reliable profitability decision."
            />

            <div className={cn("rounded-2xl border p-4", TONE_SURFACE_STYLES[viewModel.completeness.tone])}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Readiness</p>
                  <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-foreground">
                    {viewModel.completeness.readyCount}/{viewModel.completeness.totalCount}
                  </p>
                </div>
                <StatusBadge tone={toneBadge(viewModel.completeness.tone)}>
                  {viewModel.completeness.percent}% complete
                </StatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{viewModel.completeness.summary}</p>
            </div>

            <div className="mt-4 space-y-3">
              {viewModel.completeness.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  label={item.label}
                  ready={item.ready}
                  tone={item.tone}
                  hint={item.hint}
                  actionLabel={item.actionLabel}
                  href={item.href}
                />
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
