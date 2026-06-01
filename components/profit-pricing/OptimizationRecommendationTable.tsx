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
import type {
  OptimizationStrategyKey,
  OptimizationStrategySuggestion,
} from "@/lib/profit-pricing/strategy-engine";
import { channelLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

type OptimizationRecommendationTableProps = {
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>;
  selectedChannel: SalesChannel;
  strategies: OptimizationStrategySuggestion[];
  activeStrategy: OptimizationStrategyKey | null;
  applyingStrategy: OptimizationStrategyKey | null;
  onApplyStrategy: (key: OptimizationStrategyKey) => void;
};

const STRATEGY_DISPLAY: Record<
  OptimizationStrategyKey,
  { title: string; card: string; badge: string; button: string }
> = {
  high_sales: {
    title: "High Sales",
    card: "border-profit/20 bg-gradient-to-b from-profit/[0.08] to-transparent",
    badge: "border-profit/20 bg-profit/10 text-profit",
    button: "border-profit/20 bg-profit/10 text-profit hover:bg-profit/15",
  },
  buybox_balance: {
    title: "Buybox Balance",
    card: "border-primary/25 bg-gradient-to-b from-primary/[0.08] to-transparent",
    badge: "border-primary/20 bg-primary/10 text-primary",
    button: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
  },
  premium_balance: {
    title: "Premium Balance",
    card: "border-warning/20 bg-gradient-to-b from-warning/[0.08] to-transparent",
    badge: "border-warning/20 bg-warning/10 text-warning",
    button: "border-warning/20 bg-warning/10 text-warning hover:bg-warning/15",
  },
};

function cockpitChannelLabel(channel: SalesChannel) {
  return channel === "website" ? "Kendi Websitem" : channelLabel(channel);
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

function deltaTone(delta: number | null) {
  if (delta === null || !Number.isFinite(delta)) {
    return "border-border/70 bg-surface-container/70 text-muted";
  }

  if (delta > 0) {
    return "border-profit/20 bg-profit/[0.08] text-profit";
  }

  if (delta < 0) {
    return "border-loss/20 bg-loss/[0.08] text-loss";
  }

  return "border-warning/20 bg-warning/[0.08] text-warning";
}

function StrategyCard(props: {
  strategy: OptimizationStrategySuggestion;
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>;
  selectedChannel: SalesChannel;
  active: boolean;
  applying: boolean;
  anyApplying: boolean;
  onApplyStrategy: (key: OptimizationStrategyKey) => void;
}) {
  const display = STRATEGY_DISPLAY[props.strategy.key];
  const selectedTarget =
    props.strategy.channelTargets.find((target) => target.channel === props.selectedChannel) ??
    props.strategy.channelTargets[0];

  return (
    <article
      className={cn(
        "h-full rounded-2xl border p-4 transition-all duration-200",
        display.card,
        props.active && "shadow-[var(--shadow-primary)] ring-1 ring-current/20",
        props.strategy.disabled && "opacity-65"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{display.title}</p>
          <p className="mt-1 text-[12px] leading-5 text-soft">
            {selectedTarget?.note ?? props.strategy.subtitle}
          </p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", display.badge)}>
          {cockpitChannelLabel(props.selectedChannel)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted/70">
            Önerilen fiyat
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatProfitPricingCurrency(props.strategy.selectedChannelPrice)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted/70">
            Beklenen talep
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatProfitPricingNumber(props.strategy.selectedChannelDemand)}
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted/70">
          Beklenen toplam kâr
        </p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {formatProfitPricingCurrency(props.strategy.selectedChannelTotalProfit)}
        </p>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">
          Tüm kanallara etki
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.strategy.channelTargets.map((target) => {
            const currentTotalProfit = getCurrentTotalProfit(
              props.resultsByChannel[target.channel]
            );
            const delta =
              target.totalProfit !== null &&
              currentTotalProfit !== null &&
              Number.isFinite(target.totalProfit) &&
              Number.isFinite(currentTotalProfit)
                ? Number((target.totalProfit - currentTotalProfit).toFixed(2))
                : null;

            return (
              <span
                key={`${props.strategy.key}-${target.channel}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                  deltaTone(delta)
                )}
              >
                <span className="text-foreground/90">{cockpitChannelLabel(target.channel)}</span>
                <span>{formatProfitPricingCurrency(target.price)}</span>
                <span className="opacity-80">
                  {delta === null
                    ? "Takip"
                    : `${delta > 0 ? "+" : ""}${formatProfitPricingCurrency(delta)}`}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={props.strategy.disabled || props.anyApplying}
        onClick={() => props.onApplyStrategy(props.strategy.key)}
        className={cn(
          "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          display.button
        )}
      >
        {props.applying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {props.applying ? "Kaydediliyor" : "Bu öneriyi kaydet"}
      </button>
    </article>
  );
}

export default function OptimizationRecommendationTable(
  props: OptimizationRecommendationTableProps
) {
  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
          Optimizasyon önerileri
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              En iyi fiyat stratejisini seç ve güvenle kaydet
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-soft">
              Her kart seçili kanal için önerilen fiyatı gösterir, ardından üç kanalın toplam
              kâra etkisini özetler.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {props.strategies.map((strategy) => (
          <StrategyCard
            key={strategy.key}
            strategy={strategy}
            resultsByChannel={props.resultsByChannel}
            selectedChannel={props.selectedChannel}
            active={props.activeStrategy === strategy.key}
            applying={props.applyingStrategy === strategy.key}
            anyApplying={props.applyingStrategy !== null}
            onApplyStrategy={props.onApplyStrategy}
          />
        ))}
      </div>
    </GlassCard>
  );
}
