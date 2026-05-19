"use client";

import { useEffect, useState } from "react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Save } from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import {
  formatProfitPricingCurrency,
  formatProfitPricingNumber,
} from "@/lib/profit-pricing/formatters";
import type { ProfitPricingResult, SalesChannel } from "@/lib/profit-pricing/types";
import type {
  OptimizationStrategyKey,
  OptimizationStrategySuggestion,
} from "@/lib/profit-pricing/strategy-engine";
import { channelLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

type CurvePoint = {
  price: number;
  demand: number | null;
  totalProfit: number | null;
  unitProfit: number;
};

type CurveTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: CurvePoint }>;
};

const STRATEGY_TONES: Record<OptimizationStrategyKey, string> = {
  high_sales: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  buybox_balance: "border-primary/30 bg-primary/10 text-primary",
  premium_balance: "border-warning/30 bg-warning/10 text-warning",
};

const STRATEGY_POINT_COLORS: Record<OptimizationStrategyKey, string> = {
  high_sales: "#2dd4bf",
  buybox_balance: "#7c5cff",
  premium_balance: "#f59e0b",
};

function CurveTooltip({ active, payload }: CurveTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="w-[240px] rounded-2xl border border-border bg-[var(--panel-bg)] p-3 text-sm text-foreground shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
        Fiyat adayı
      </p>
      <h4 className="mt-2 text-base font-semibold text-foreground">
        {formatProfitPricingCurrency(point.price)}
      </h4>
      <div className="mt-3 space-y-2 text-[12px] text-soft">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Talep</p>
          <p className="mt-1 font-medium text-foreground">
            {formatProfitPricingNumber(point.demand)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Toplam kâr</p>
          <p className="mt-1 font-medium text-foreground">
            {formatProfitPricingCurrency(point.totalProfit)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Birim net kâr</p>
          <p className="mt-1 font-medium text-foreground">
            {formatProfitPricingCurrency(point.unitProfit)}
          </p>
        </div>
      </div>
    </div>
  );
}

function StrategyButton(props: {
  strategy: OptimizationStrategySuggestion;
  selectedChannel: SalesChannel;
  active: boolean;
  applying: boolean;
  anyApplying: boolean;
  onApply: (key: OptimizationStrategyKey) => void;
}) {
  const selectedChannelTarget =
    props.strategy.channelTargets.find(
      (target) => target.channel === props.selectedChannel
    ) ?? props.strategy.channelTargets[0];

  return (
    <article
      className={cn(
        "h-full rounded-2xl border p-3 text-left transition-all duration-200",
        STRATEGY_TONES[props.strategy.key],
        props.active ? "ring-1 ring-current shadow-[var(--shadow-primary)]" : "",
        props.strategy.disabled ? "opacity-60" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{props.strategy.label}</p>
          <p className="mt-1 text-xs opacity-80">{props.strategy.subtitle}</p>
        </div>
        <span className="rounded-full border border-current/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {props.strategy.disabled ? "Veri eksik" : channelLabel(props.selectedChannel)}
        </span>
      </div>

      <p className="mt-3 text-xl font-semibold">
        {formatProfitPricingCurrency(selectedChannelTarget?.price)}
      </p>

      <div className="mt-2 space-y-1 text-[11px] opacity-85">
        <span>
          Talep: {formatProfitPricingNumber(props.strategy.selectedChannelDemand)}
        </span>
        <span>
          Toplam kâr:{" "}
          {formatProfitPricingCurrency(props.strategy.selectedChannelTotalProfit)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {props.strategy.channelTargets.map((target) => (
          <span
            key={`${props.strategy.key}-${target.channel}`}
            className="rounded-full border border-current/15 px-2 py-0.5 text-[9px] font-semibold"
          >
            {target.label} {formatProfitPricingCurrency(target.price)}
          </span>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-5 opacity-85">
        {props.strategy.selectedChannelNote ?? props.strategy.description}
      </p>

      <button
        type="button"
        disabled={props.strategy.disabled || props.anyApplying}
        onClick={() => props.onApply(props.strategy.key)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-current/20 bg-current/10 px-2.5 py-2 text-[11px] font-semibold text-inherit transition hover:bg-current/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.applying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {props.applying ? "Veri Merkezi'ne kaydediliyor" : "Bu öneriyi Veri Merkezi'ne kaydet"}
      </button>
    </article>
  );
}

export default function PriceProfitCurve(props: {
  result: ProfitPricingResult;
  selectedChannel: SalesChannel;
  strategies: OptimizationStrategySuggestion[];
  activeStrategy: OptimizationStrategyKey | null;
  applyingStrategy: OptimizationStrategyKey | null;
  onApplyStrategy: (key: OptimizationStrategyKey) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const { result, strategies, activeStrategy, applyingStrategy } = props;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const curveData: CurvePoint[] = (result.priceGrid.length > 0
    ? result.priceGrid
    : result.priceScenarios
  ).map((point) => ({
    price: point.price,
    demand: point.estimatedDemand ?? null,
    totalProfit: point.estimatedTotalProfit ?? null,
    unitProfit: point.netProfit,
  }));

  const hasDemand = curveData.some((point) => point.demand !== null);
  const hasTotalProfit = curveData.some((point) => point.totalProfit !== null);

  return (
    <GlassCard className="border-border/80">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
            Fiyat talep eğrisi
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            Üç farklı optimizasyon önerisi tek tıkla uygulanır
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">
            Seçili kanal için talep ve toplam kâr eğrisi gösterilir. Üstteki öneri
            butonlarından biri seçildiğinde aynı strateji ürünün tüm kanallarına kaydedilir.
          </p>
        </div>

        <div className="grid w-full gap-3 md:grid-cols-3">
          {strategies.map((strategy) => (
            <StrategyButton
              key={strategy.key}
              strategy={strategy}
              selectedChannel={props.selectedChannel}
              active={activeStrategy === strategy.key}
              applying={applyingStrategy === strategy.key}
              anyApplying={applyingStrategy !== null}
              onApply={props.onApplyStrategy}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 h-[360px] min-w-0">
        {isMounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
          <LineChart data={curveData} margin={{ top: 18, right: 22, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              type="number"
              dataKey="price"
              domain={["dataMin", "dataMax"]}
              stroke="var(--text-muted)"
              tickFormatter={(value) => formatProfitPricingCurrency(Number(value))}
            />
            <YAxis
              yAxisId="profit"
              stroke="var(--text-muted)"
              tickFormatter={(value) => formatProfitPricingCurrency(Number(value))}
            />
            {hasDemand ? (
              <YAxis
                yAxisId="demand"
                orientation="right"
                stroke="var(--warning)"
                tickFormatter={(value) => formatProfitPricingNumber(Number(value))}
              />
            ) : null}
            <Tooltip content={<CurveTooltip />} />

            <ReferenceLine
              x={result.input.salePrice}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              label="Mevcut fiyat"
            />
            {result.input.buyboxPrice ? (
              <ReferenceLine
                x={result.input.buyboxPrice}
                stroke="var(--warning)"
                strokeDasharray="4 4"
                label="Buybox"
              />
            ) : null}

            {strategies.map((strategy) => {
              const selectedTarget =
                strategy.channelTargets.find(
                  (target) => target.channel === props.selectedChannel
                ) ?? strategy.channelTargets[0];

              if (!selectedTarget?.price) {
                return null;
              }

              const profitPoint =
                curveData.find((point) => point.price === selectedTarget.price) ?? null;

              return (
                <ReferenceDot
                  key={`${strategy.key}-${selectedTarget.price}`}
                  x={selectedTarget.price}
                  y={profitPoint?.totalProfit ?? 0}
                  yAxisId="profit"
                  r={activeStrategy === strategy.key ? 7 : 5}
                  fill={STRATEGY_POINT_COLORS[strategy.key]}
                  stroke="var(--text-main)"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              );
            })}

            {hasTotalProfit ? (
              <Line
                yAxisId="profit"
                type="monotone"
                dataKey="totalProfit"
                stroke="var(--success)"
                strokeWidth={2.8}
                dot={{ r: 1.8, strokeWidth: 0, fill: "var(--success)" }}
                activeDot={{ r: 5, strokeWidth: 0, fill: "var(--success)" }}
                name="Tahmini toplam kâr"
              />
            ) : null}
            <Line
              yAxisId="profit"
              type="monotone"
              dataKey="unitProfit"
              stroke="var(--primary)"
              strokeWidth={2.2}
              dot={{ r: 1.6, strokeWidth: 0, fill: "var(--primary)" }}
              activeDot={{ r: 4.6, strokeWidth: 0, fill: "var(--primary)" }}
              name="Birim net kâr"
            />
            {hasDemand ? (
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="demand"
                stroke="var(--warning)"
                strokeWidth={2.4}
                dot={{ r: 1.4, strokeWidth: 0, fill: "var(--warning)" }}
                activeDot={{ r: 4.2, strokeWidth: 0, fill: "var(--warning)" }}
                name="Tahmini talep"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
        ) : null}
      </div>
    </GlassCard>
  );
}
