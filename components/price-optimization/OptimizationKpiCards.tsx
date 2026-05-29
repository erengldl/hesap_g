"use client";

import type { ElementType } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles, Target, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { PriceOptimizationResult } from "@/lib/price-optimization-types";

interface OptimizationKpiCardsProps {
  result: PriceOptimizationResult | null;
}

function KpiShell({
  title,
  value,
  caption,
  icon: Icon,
  accent = false,
  delta,
}: {
  title: string;
  value: string;
  caption: string;
  icon: ElementType;
  accent?: boolean;
  delta?: string;
}) {
  return (
    <div className="h-full transition-colors duration-200 hover:border-primary/20">
      <GlassCard className={accent ? "border-primary/25 bg-primary/5 h-full" : "h-full"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{title}</p>
            <p className={accent ? "text-2xl font-bold text-primary" : "text-2xl font-bold text-foreground"}>
              {value}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted">
              {delta && (
                <span className={delta.startsWith("-") ? "text-danger" : "text-primary"}>
                  {delta.startsWith("-") ? <ArrowDownRight className="inline w-3.5 h-3.5 mr-1" /> : <ArrowUpRight className="inline w-3.5 h-3.5 mr-1" />}
                  {delta}
                </span>
              )}
              <span className="text-muted">{caption}</span>
            </div>
          </div>

          <div className={accent ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/20 text-primary" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-container text-muted"}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </GlassCard>
    </div>
  );
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
      <KpiShell
        title="Fiyat değişimi"
        value={`${formatCurrency(result.current_price)} -> ${formatCurrency(result.recommended_price)}`}
        caption={`${priceDelta >= 0 ? "Yukarı" : "Aşağı"} yönlü ${priceDeltaPercent}`}
        icon={Target}
        delta={formatCurrency(priceDelta)}
      />
      <KpiShell
        title="Satış değişimi"
        value={`${result.expected_demand_current.toFixed(0)} -> ${result.expected_demand_recommended.toFixed(0)}`}
        caption={`Talep değişimi ${formatPercent(demandDeltaPercent)}`}
        icon={TrendingUp}
        delta={`${demandDelta >= 0 ? "+" : ""}${demandDelta.toFixed(0)} adet`}
      />
      <KpiShell
        title="Kâr değişimi"
        value={formatCurrency(result.expected_profit_recommended)}
        caption={`Kâr farkı ${formatCurrency(profitDelta)} · Güven ${result.confidence_score}`}
        icon={Sparkles}
        accent
        delta={`${profitDeltaPercent >= 0 ? "+" : ""}${formatPercent(profitDeltaPercent)}`}
      />
    </div>
  );
}
