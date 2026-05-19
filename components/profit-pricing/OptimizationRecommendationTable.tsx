"use client";

import { Loader2, Save } from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import {
  formatProfitPricingCurrency,
  formatProfitPricingNumber,
} from "@/lib/profit-pricing/formatters";
import type {
  ProfitPricingResult,
  SalesChannel,
} from "@/lib/profit-pricing/types";
import { SUPPORTED_SALES_CHANNELS } from "@/lib/profit-pricing/types";
import type {
  OptimizationStrategyKey,
  OptimizationStrategySuggestion,
} from "@/lib/profit-pricing/strategy-engine";
import { channelLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

type OptimizationRecommendationTableProps = {
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>;
  strategies: OptimizationStrategySuggestion[];
  activeStrategy: OptimizationStrategyKey | null;
  applyingStrategy: OptimizationStrategyKey | null;
  onApplyStrategy: (key: OptimizationStrategyKey) => void;
};

function getChannelReference(result: ProfitPricingResult | undefined) {
  if (!result) {
    return {
      label: "Referans",
      value: null,
      helper: "Veri yok",
    };
  }

  if (result.input.channel === "website") {
    return {
      label: "Kargo",
      value: result.input.shippingCost ?? null,
      helper: "Web sitesi için buybox yerine kargo fiyatı kullanılır.",
    };
  }

  return {
    label: "Buybox",
    value: result.input.buyboxPrice ?? null,
    helper: "Pazaryeri hedef buybox seviyesi.",
  };
}

function getStrategyTarget(
  strategy: OptimizationStrategySuggestion,
  channel: SalesChannel
) {
  return strategy.channelTargets.find((target) => target.channel === channel) ?? null;
}

function getCurrentTotalProfit(result: ProfitPricingResult | undefined) {
  if (!result) {
    return null;
  }

  const currentScenario =
    result.priceScenarios.find((scenario) => scenario.key === "current") ??
    result.priceScenarios.find((scenario) => scenario.label.toLocaleLowerCase("tr-TR").includes("mevcut"));

  if (currentScenario?.estimatedTotalProfit !== undefined) {
    return currentScenario.estimatedTotalProfit ?? null;
  }

  const currentGridPoint = result.priceGrid.find(
    (point) => Math.abs(point.price - result.input.salePrice) < 0.01
  );

  return currentGridPoint?.estimatedTotalProfit ?? null;
}

export default function OptimizationRecommendationTable(
  props: OptimizationRecommendationTableProps
) {
  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
              Optimizasyon tablosu
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              3 kanal için önerilen fiyatlar
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-soft">
              Grafik üstündeki üç strateji burada kanal bazında görünür. Kaydet butonu
              seçilen stratejinin fiyatlarını Veri Merkezi kanal ayarlarına yazar.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {props.strategies.map((strategy) => {
              const isApplying = props.applyingStrategy === strategy.key;
              const isActive = props.activeStrategy === strategy.key;

              return (
                <button
                  key={strategy.key}
                  type="button"
                  disabled={strategy.disabled || props.applyingStrategy !== null}
                  onClick={() => props.onApplyStrategy(strategy.key)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                    isActive
                      ? "border-primary/45 bg-primary/20 text-primary"
                      : "border-border bg-surface-container text-foreground hover:border-primary/35 hover:bg-primary/10"
                  )}
                >
                  {isApplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isApplying ? "Kaydediliyor" : `${strategy.label} kaydet`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
              <th className="px-3 py-2">Kanal</th>
              <th className="px-3 py-2">Mevcut fiyat</th>
              <th className="px-3 py-2">Buybox / Kargo</th>
              {props.strategies.map((strategy) => (
                <th key={strategy.key} className="px-3 py-2">
                  {strategy.label}
                </th>
              ))}
              <th className="px-3 py-2">Net kâr</th>
              <th className="px-3 py-2">Beklenen toplam kâr</th>
            </tr>
          </thead>
          <tbody>
            {SUPPORTED_SALES_CHANNELS.map((channel) => {
              const result = props.resultsByChannel[channel];
              const reference = getChannelReference(result);

              return (
                <tr key={channel} className="rounded-2xl bg-surface-container/70">
                  <td className="rounded-l-2xl px-3 py-3 font-semibold text-foreground">
                    {channelLabel(channel)}
                  </td>
                  <td className="px-3 py-3 text-foreground">
                    {formatProfitPricingCurrency(result?.input.salePrice)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-foreground">
                      {formatProfitPricingCurrency(reference.value)}
                    </div>
                    <div className="mt-1 text-[11px] text-muted/600">{reference.label}</div>
                  </td>
                  {props.strategies.map((strategy) => {
                    const target = getStrategyTarget(strategy, channel);

                    return (
                      <td key={`${channel}-${strategy.key}`} className="px-3 py-3">
                        <div className="font-semibold text-foreground">
                          {formatProfitPricingCurrency(target?.price)}
                        </div>
                        <div className="mt-1 text-[11px] text-soft">
                          Talep {formatProfitPricingNumber(target?.demand)}
                        </div>
                        <div className="mt-1 text-[11px] text-soft">
                          Kâr {formatProfitPricingCurrency(target?.totalProfit)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 font-semibold text-foreground">
                    {formatProfitPricingCurrency(result?.netProfit)}
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 font-semibold text-foreground">
                    {formatProfitPricingCurrency(getCurrentTotalProfit(result))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
