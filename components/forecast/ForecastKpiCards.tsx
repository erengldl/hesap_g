"use client";

import { AlertTriangle, Boxes, ChartSpline, TrendingUp, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import type { DemandForecastResult } from "@/lib/demand-forecast-types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDecimal, formatNumber } from "@/lib/formatters";

interface ForecastKpiCardsProps {
  result: DemandForecastResult | null;
}

export default function ForecastKpiCards({ result }: ForecastKpiCardsProps) {
  const summary = result?.summary;
  const stockCritical = summary?.stockWarning === "STOK YETERSIZ" || summary?.stockWarning === "STOK YOK";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Tahmini adet"
        value={formatNumber(summary?.totalForecastUnits ?? 0)}
        subValue={`${summary?.horizonDays ?? 0} gün toplam · günlük ortalama ${formatDecimal((summary?.totalForecastUnits ?? 0) / Math.max(1, summary?.horizonDays ?? 1), 1)}`}
        icon={TrendingUp}
        tone="primary"
      />
      <KpiCard
        title="Ciro"
        value={formatCurrency(summary?.expectedRevenue ?? 0)}
        subValue={`Seçili pazar için toplam gelir`}
        icon={ChartSpline}
        tone="glow"
      />
      <KpiCard
        title="Net kâr"
        value={formatCurrency(summary?.expectedNetProfit ?? 0)}
        subValue={`Birim net kâr: ${formatCurrency(summary?.unitNetProfit ?? 0)}`}
        icon={AlertTriangle}
        tone={summary?.confidenceScore === "High" ? "success" : summary?.confidenceScore === "Medium" ? "warning" : "danger"}
      />
      <KpiCard
        title="Hata oranı"
        value={`%${formatNumber((summary?.wmape ?? 0) * 100)}`}
        subValue={`Güven ${
          summary?.confidenceScore === "High" ? "Yüksek" : summary?.confidenceScore === "Medium" ? "Orta" : summary?.confidenceScore === "Low" ? "Düşük" : "Belirlenmedi"
        } · Stok ${summary?.stockWarning ?? "Belirtilmedi"}`}
        icon={Boxes}
        tone={stockCritical ? "danger" : "success"}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "glow" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/20 bg-primary/10"
      : tone === "glow"
        ? "border-primary/20 bg-primary/5"
        : tone === "success"
          ? "border-primary/20 bg-primary/5"
          : tone === "warning"
            ? "border-warning/20 bg-warning/10"
            : tone === "danger"
              ? "border-danger/20 bg-danger/10"
              : "border-border bg-surface-container";

  const iconTone =
    tone === "primary"
      ? "text-primary border-primary/20 bg-primary/10"
      : tone === "glow"
        ? "text-primary border-primary/20 bg-surface-container"
        : tone === "success"
          ? "text-primary border-primary/20 bg-primary/5"
          : tone === "warning"
            ? "text-warning border-warning/20 bg-warning/10"
            : tone === "danger"
              ? "text-danger border-danger/20 bg-danger/10"
              : "text-foreground/80 border-border bg-surface-container";

  return (
    <GlassCard className={cn("overflow-hidden p-4", toneClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</p>
          <h3 className={cn("mt-2 text-xl font-semibold text-foreground sm:text-[1.6rem]", tone === "glow" ? "profit-glow" : "")}>
            {value}
          </h3>
          {subValue && <p className="mt-2 text-xs leading-relaxed text-muted">{subValue}</p>}
        </div>

        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md border", iconTone)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </GlassCard>
  );
}
