import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { DashboardAlertSeverity, DashboardKpiTone, ModuleFlowStep } from "@/lib/dashboard-view-model";

export interface GlassCardProps extends React.ComponentPropsWithoutRef<"div"> {
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
}

export function GlassCard({
  children,
  className,
  elevated = false,
  interactive = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      {...props}
      className={cn(
        elevated ? "glass-panel" : "glass-card",
        interactive && "animate-card-hover hover:border-border-strong",
        "rounded-xl p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
  tone?: DashboardKpiTone;
}

const KPI_TONE_STYLES: Record<DashboardKpiTone, { border: string; accent: string; icon: string; } > = {
  neutral: {
    border: "border-border/70",
    accent: "from-transparent via-stable/40 to-transparent",
    icon: "bg-surface-soft text-stable",
  },
  profit: {
    border: "border-profit/20 bg-profit/[0.03]",
    accent: "from-transparent via-profit/40 to-transparent",
    icon: "bg-profit/12 text-profit",
  },
  loss: {
    border: "border-loss/20 bg-loss/[0.03]",
    accent: "from-transparent via-loss/40 to-transparent",
    icon: "bg-loss/12 text-loss",
  },
  warning: {
    border: "border-warning/20 bg-warning/[0.03]",
    accent: "from-transparent via-warning/40 to-transparent",
    icon: "bg-warning/12 text-warning",
  },
};

export function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  className,
  tone = "neutral",
}: KpiCardProps) {
  const toneStyles = KPI_TONE_STYLES[tone];

  return (
    <GlassCard className={cn("group relative h-full overflow-hidden", toneStyles.border, className)}>
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r", toneStyles.accent)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
          <h3 className="font-heading mt-3 max-w-full truncate text-[1.55rem] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums sm:text-[1.7rem]">
            {value}
          </h3>
          {subValue && <p className="mt-2 text-[12px] font-medium text-muted">{subValue}</p>}
          {(trend || subValue) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  trend?.isPositive
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-danger/20 bg-danger/10 text-danger"
                )}
              >
                {trend?.value ?? "Durum"}
              </span>
              {subValue && <span className="text-[11px] text-muted">Güncel akış</span>}
            </div>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 shadow-[var(--shadow-soft)]", toneStyles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </GlassCard>
  );
}

export function MetricBadge({
  label,
  value,
  type = "default",
}: {
  label: string;
  value: string;
  type?: "default" | "success" | "warning" | "error" | "info";
}) {
  const colors = {
    default: "bg-surface-container text-muted border-border",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    error: "bg-danger/10 text-danger border-danger/20",
    info: "bg-info/10 text-info border-info/20",
  };

  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]", colors[type])}>
      <span className="opacity-60">{label}</span>
      <span className="text-[8px] opacity-50">•</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

const STATUS_TONE_STYLES: Record<DashboardAlertSeverity, string> = {
  neutral: "border-border/80 bg-surface-soft/70 text-stable",
  profit: "border-profit/20 bg-profit/10 text-profit",
  loss: "border-loss/20 bg-loss/10 text-loss",
  warning: "border-warning/20 bg-warning/10 text-warning",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: DashboardAlertSeverity;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        STATUS_TONE_STYLES[tone],
        className
      )}
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        tone === "profit" ? "bg-profit" : tone === "loss" ? "bg-loss" : tone === "warning" ? "bg-warning" : "bg-stable"
      )} />
      {children}
    </div>
  );
}

export function WarningBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <StatusBadge tone="warning" className={className}>
      {children}
    </StatusBadge>
  );
}

export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:mb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-2">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-surface-container/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </div>
        )}
        <div className="space-y-2">
          <h1 className="font-heading text-[1.95rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.3rem] lg:text-[2.55rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">{children}</div>
    </div>
  );
}

export function ModuleFlowBar({
  steps,
  className,
}: {
  steps: ModuleFlowStep[];
  className?: string;
}) {
  return (
    <GlassCard className={cn("overflow-x-auto px-3 py-3 sm:px-4", className)}>
      <div className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200",
                step.status === "active"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : step.status === "upcoming"
                    ? "border-border/80 bg-surface-soft/75 text-foreground hover:border-primary/20 hover:text-primary"
                    : "border-border/70 bg-transparent text-muted hover:border-border-strong hover:text-foreground"
              )}
            >
              <span className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] tabular-nums",
                step.status === "active" ? "bg-primary text-primary-foreground" : "bg-surface-container text-stable"
              )}>
                {index + 1}
              </span>
              {step.label}
            </Link>
            {index < steps.length - 1 && (
              <span className="text-stable/55" aria-hidden="true">
                →
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </GlassCard>
  );
}

export function ChartCard({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("overflow-hidden", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="panel-title">{title}</h3>
          {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </GlassCard>
  );
}

type FinancialTooltipSeries = {
  key: string;
  label: string;
  color?: string;
  formatter?: (value: number) => string;
};

type FinancialTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string; value?: number | string; color?: string }>;
  labelFormatter?: (label: string) => string;
  note?: string;
  title?: string;
  series: FinancialTooltipSeries[];
};

export function FinancialTooltip({
  active,
  label,
  payload,
  labelFormatter,
  note,
  title = "Detay",
  series,
}: FinancialTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = series
    .map((seriesItem) => {
      const row = payload.find((item) => item.dataKey === seriesItem.key);
      if (!row || row.value === undefined || row.value === null) return null;

      const numericValue = Number(row.value);
      return {
        ...seriesItem,
        color: seriesItem.color ?? row.color ?? "var(--stable)",
        value: seriesItem.formatter ? seriesItem.formatter(numericValue) : formatCurrency(numericValue),
      };
    })
    .filter((row): row is FinancialTooltipSeries & { color: string; value: string } => Boolean(row));

  if (rows.length === 0) return null;

  return (
    <div className="min-w-[220px] rounded-xl border border-border/80 bg-panel/98 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      {label ? (
        <p className="mt-1 text-sm font-semibold text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </div>
            <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
      {note ? <p className="mt-3 text-[11px] leading-5 text-muted">{note}</p> : null}
    </div>
  );
}

// ─── Loading & Empty States ─────────────────────────────────────────

type SkeletonVariant = "card" | "table-row" | "text-line" | "circle";

interface SkeletonCardProps {
  className?: string;
  variant?: SkeletonVariant;
  height?: number | string;
  delayIndex?: number;
}

export function SkeletonCard({
  className,
  variant = "card",
  height,
  delayIndex = 0,
}: SkeletonCardProps) {
  const defaultHeight =
    height ??
    (variant === "table-row" ? 44 : variant === "text-line" ? 12 : variant === "circle" ? 48 : 160);
  const resolvedStyle: React.CSSProperties = {
    animationDelay: `${delayIndex * 100}ms`,
    height: defaultHeight,
  };

  if (variant === "circle") {
    resolvedStyle.width = defaultHeight;
  }

  return (
    <div
      className={cn(
        "skeleton-shimmer border border-border/70 bg-surface-container",
        variant === "card"
          ? "rounded-xl"
          : variant === "table-row"
            ? "rounded-lg"
            : "rounded-full",
        className
      )}
      style={resolvedStyle}
    />
  );
}

interface SkeletonTableProps {
  rows?: number;
  rowHeight?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, rowHeight = 44, className }: SkeletonTableProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} variant="table-row" height={rowHeight} delayIndex={index} className="w-full" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "inline";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isInline = variant === "inline";
  return (
    <GlassCard
      className={cn(
        "border-dashed border-border/70 text-center",
        isInline ? "p-5 sm:p-6" : "p-7 sm:p-9",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary",
          isInline ? "h-11 w-11" : "h-14 w-14"
        )}
      >
        <Icon className={cn(isInline ? "h-[18px] w-[18px]" : "h-5 w-5")} />
      </div>
      <h3 className={cn("font-heading font-semibold tracking-[-0.04em] text-foreground", isInline ? "text-base" : "text-lg")}>
        {title}
      </h3>
      {description && (
        <p className={cn("mx-auto mt-2 leading-6 text-muted", isInline ? "max-w-xs text-xs" : "max-w-sm text-sm")}>
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </GlassCard>
  );
}

interface ErrorStateCardProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function ErrorStateCard({
  title,
  description,
  action,
  className,
  icon: Icon = AlertTriangle,
}: ErrorStateCardProps) {
  return (
    <GlassCard className={cn("border-danger/30 bg-danger/5 p-6", className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Notification Badge ─────────────────────────────────────────────

export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-danger px-1.5 text-[9px] font-bold text-danger-foreground",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
