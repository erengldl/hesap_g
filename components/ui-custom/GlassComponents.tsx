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

interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function KpiCard({ title, value, subValue, icon: Icon, trend, className }: KpiCardProps) {
  return (
    <GlassCard className={cn("group relative h-full overflow-hidden border-border/70 transition-transform duration-200 hover:-translate-y-0.5", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
          <h3 className="font-heading mt-3 max-w-full truncate text-[1.65rem] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[1.85rem]">
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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-primary)] transition-transform duration-200 group-hover:scale-[1.03]">
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
