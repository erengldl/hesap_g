"use client";

import { Sparkles, Target, TrendingUp } from "lucide-react";

import { KpiCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { PriceOptimizationResult } from "@/lib/price-optimization-types";

interface OptimizationKpiCardsProps {
  result: PriceOptimizationResult | null;
}

export default function OptimizationKpiCards({ result }: OptimizationKpiCardsProps) {
  if (!result) {
    return null;
  }

  const priceDelta = result.recommended_price - result.current_price;
  const priceDeltaPercent = result.current_price > 0 ? formatPercent((priceDelta / result.current_price) * 100) : "0%";
  const demandDelta = result.expected_demand_recommended - result.expected_demand_current;
  const demandDeltaPercent = result.demand_change_percent ?? 0;
  const profitDelta = result.expected_profit_recommended - result.expected_profit_current;
  const profitDeltaPercent = result.profit_change_percent ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <KpiCard
        title="Fiyat değişimi"
        value={`${formatCurrency(result.current_price)} -> ${formatCurrency(result.recommended_price)}`}
        subValue={`${priceDelta >= 0 ? "Yukarı" : "Aşağı"} yönlü ${priceDeltaPercent}`}
        icon={Target}
        trend={{
          value: `${priceDelta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(priceDelta))}`,
          isPositive: priceDelta >= 0,
        }}
      />
      <KpiCard
        title="Satış değişimi"
        value={`${result.expected_demand_current.toFixed(0)} -> ${result.expected_demand_recommended.toFixed(0)}`}
        subValue={`Talep değişimi ${formatPercent(demandDeltaPercent)}`}
        icon={TrendingUp}
        trend={{
          value: `${demandDelta >= 0 ? "+" : "-"}${Math.abs(demandDelta).toFixed(0)} adet`,
          isPositive: demandDelta >= 0,
        }}
      />
      <KpiCard
        title="Kâr değişimi"
        value={formatCurrency(result.expected_profit_recommended)}
        subValue={`Kâr farkı ${formatCurrency(profitDelta)} · Güven ${result.confidence_score}`}
        icon={Sparkles}
        tone="primary"
        trend={{
          value: `${profitDeltaPercent >= 0 ? "+" : "-"}${formatPercent(Math.abs(profitDeltaPercent))}`,
          isPositive: profitDeltaPercent >= 0,
        }}
      />
    </div>
  );
}
