"use client";

import { AlertTriangle, Boxes, ChartSpline, TrendingUp } from "lucide-react";

import { KpiCard } from "@/components/ui-custom/GlassComponents";
import type { DemandForecastResult } from "@/lib/demand-forecast-types";
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
        subValue="Seçili pazar için toplam gelir"
        icon={ChartSpline}
        tone="primary"
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
