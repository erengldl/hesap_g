import { AlertTriangle, BarChart3, Clock3, Coins, Gauge, TrendingUp } from "lucide-react";

import { GlassCard, MetricBadge, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDecimal, formatNumber } from "@/lib/formatters";
import type { ManualAdMetrics } from "@/lib/manual-ads/types";
import { cn } from "@/lib/utils";

type ManualAdMetricPreviewProps = {
  metrics: ManualAdMetrics | null;
  validationErrors?: string[];
  className?: string;
};

function formatNullableCurrency(value: number | null) {
  return value === null ? "Hesaplanamadı" : formatCurrency(value);
}

function formatCostPerOrder(value: number | null) {
  return value === null ? "Hesaplanamadı" : formatCurrency(value);
}

function formatNullableRatio(value: number | null) {
  return value === null ? "Hesaplanamadı" : `${formatDecimal(value, 2, 2)}x`;
}

export function ManualAdMetricPreview({ metrics, validationErrors = [], className }: ManualAdMetricPreviewProps) {
  return (
    <GlassCard className={cn("border border-border bg-surface-container", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Anlık önizleme</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">Metrikler formla birlikte hesaplanır</h3>
        </div>
        <BarChart3 className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            Reklam süresi
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">{metrics ? `${formatNumber(metrics.campaignDays)} gün` : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <Coins className="h-3.5 w-3.5 text-primary" />
            Günlük harcama
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">{metrics ? formatCurrency(metrics.dailySpend) : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Sipariş başı maliyet
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">{metrics ? formatCostPerOrder(metrics.costPerOrder) : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Veri yeterliliği
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">{metrics ? metrics.dataQuality.toUpperCase() : "Bekleniyor"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">ROAS</p>
          <p className="mt-2 text-base font-semibold text-foreground">{metrics ? formatNullableRatio(metrics.roas) : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Tahmini kâr sonrası</p>
          <p className="mt-2 text-base font-semibold text-foreground">{metrics ? formatNullableCurrency(metrics.estimatedProfitAfterAds) : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Break-even CPA</p>
          <p className="mt-2 text-base font-semibold text-foreground">{metrics ? formatNullableCurrency(metrics.breakEvenCPA) : "Bekleniyor"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-container p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Toplam ciro</p>
          <p className="mt-2 text-base font-semibold text-foreground">{metrics ? formatNullableCurrency(metrics.estimatedRevenue) : "Bekleniyor"}</p>
        </div>
      </div>

      {validationErrors.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            Form doğrulaması
          </div>
          <div className="mt-2 space-y-1 text-sm text-warning/90">
            {validationErrors.map((error) => (
              <p key={error}>• {error}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {metrics ? (
            <>
              <MetricBadge label="Gün" value={`${formatNumber(metrics.campaignDays)}`} type="info" />
              <MetricBadge label="CPA" value={formatCostPerOrder(metrics.costPerOrder)} type="success" />
              <MetricBadge label="Veri" value={metrics.dataQuality.toUpperCase()} type="default" />
            </>
          ) : (
            <WarningBadge>Girdi bekleniyor</WarningBadge>
          )}
        </div>
      )}
    </GlassCard>
  );
}
