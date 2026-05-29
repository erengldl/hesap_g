import React from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.ComponentPropsWithoutRef<"div"> {
  className?: string;
  elevated?: boolean;
}

export function GlassCard({
  children,
  className,
  elevated = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      {...props}
      className={cn(
        elevated ? "glass-panel" : "glass-card",
        "rounded-xl p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

type KpiTone = "default" | "primary" | "success" | "warning" | "danger";

const KPI_CARD_TONES: Record<KpiTone, { card: string; icon: string }> = {
  default: {
    card: "border-border/80 bg-surface-container",
    icon: "border-border/70 bg-background/60 text-muted",
  },
  primary: {
    card: "border-primary/20 bg-primary/5",
    icon: "border-primary/20 bg-primary text-primary-foreground shadow-[var(--shadow-primary)]",
  },
  success: {
    card: "border-success/20 bg-success/5",
    icon: "border-success/20 bg-success/10 text-success",
  },
  warning: {
    card: "border-warning/20 bg-warning/10",
    icon: "border-warning/20 bg-warning/10 text-warning",
  },
  danger: {
    card: "border-danger/20 bg-danger/10",
    icon: "border-danger/20 bg-danger/10 text-danger",
  },
};

interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  tone?: KpiTone;
  className?: string;
  goldRim?: boolean;
}

export function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  tone = "default",
  className,
  goldRim = false,
}: KpiCardProps) {
  const toneStyles = KPI_CARD_TONES[tone];

  return (
    <GlassCard
      className={cn(
        "group relative h-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5",
        toneStyles.card,
        goldRim && "gold-rim",
        className
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</p>
          <h3 className="font-heading mt-3 max-w-full truncate text-[1.65rem] font-semibold leading-none tracking-[-0.05em] text-foreground sm:text-[1.9rem]">
            {value}
          </h3>
          {subValue && <p className="mt-2 text-[12px] leading-5 text-soft">{subValue}</p>}
          {trend && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  trend.isPositive
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-danger/20 bg-danger/10 text-danger"
                )}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border", toneStyles.icon)}>
          <Icon className="h-5 w-5" />
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
      <span className="opacity-80">{label}</span>
      <span className="text-[8px] opacity-60">•</span>
      <span>{value}</span>
    </div>
  );
}

export function WarningBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-warning",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      {children}
    </div>
  );
}

type EyebrowBadgeVariant = "default" | "primary";

interface EyebrowBadgeProps {
  children: React.ReactNode;
  variant?: EyebrowBadgeVariant;
  className?: string;
}

export function EyebrowBadge({
  children,
  variant = "default",
  className,
}: EyebrowBadgeProps) {
  const variantStyles: Record<EyebrowBadgeVariant, string> = {
    default: "border border-border/80 bg-surface-container/70 text-muted",
    primary: "border border-primary/20 bg-primary/10 text-primary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
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
          <EyebrowBadge variant="default">{eyebrow}</EyebrowBadge>
        )}
        <div className="space-y-2">
          <h1 className="font-heading text-[2.15rem] font-semibold tracking-[-0.06em] text-foreground sm:text-[2.65rem] lg:text-[2.95rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-soft sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">{children}</div>
    </div>
  );
}

interface MobileCardListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function MobileCardList<T>({
  data,
  renderItem,
  className,
}: MobileCardListProps<T>) {
  return <div className={cn("space-y-2", className)}>{data.map((item, index) => renderItem(item, index))}</div>;
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
        <p className={cn("mx-auto mt-2 leading-6 text-soft", isInline ? "max-w-xs text-xs" : "max-w-sm text-sm")}>
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
          <p className="mt-1 text-sm leading-6 text-soft">{description}</p>
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
