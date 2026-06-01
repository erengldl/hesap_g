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
import { TrendingUp } from "lucide-react";

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

const TOTAL_PROFIT_COLOR = "var(--profit)";
const UNIT_PROFIT_COLOR = "#8f6bff";
const DEMAND_COLOR = "#62a8ff";
const CURRENT_PRICE_COLOR = "#ff7f6d";
const BUYBOX_COLOR = "var(--warning)";

const STRATEGY_POINT_COLORS: Record<OptimizationStrategyKey, string> = {
  high_sales: "#31d0aa",
  buybox_balance: "#8f6bff",
  premium_balance: "#f5b759",
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
    <div className="w-[248px] rounded-2xl border border-border bg-[var(--panel-bg)] p-3 text-sm text-foreground shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
        Fiyat noktası
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
      <p className="mt-3 text-[11px] leading-5 text-muted">
        Bu fiyat seviyesinde talep tahmini ile birim ve toplam kâr birlikte okunur.
      </p>
    </div>
  );
}

function cockpitChannelLabel(channel: SalesChannel) {
  return channel === "website" ? "Kendi Websitem" : channelLabel(channel);
}

function findCurvePoint(points: CurvePoint[], price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return null;
  }

  return points.find((point) => Math.abs(point.price - price) < 0.01) ?? null;
}

function LegendChip(props: {
  label: string;
  color: string;
  dashed?: boolean;
  dot?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-container/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span
        className={cn(
          props.dot ? "h-2.5 w-2.5 rounded-full" : "h-0.5 w-4 rounded-full",
          props.dashed && "border-t border-dashed bg-transparent"
        )}
        style={{
          backgroundColor: props.dashed ? "transparent" : props.color,
          borderColor: props.dashed ? props.color : undefined,
        }}
      />
      {props.label}
    </span>
  );
}

export default function PriceProfitCurve(props: {
  result: ProfitPricingResult;
  selectedChannel: SalesChannel;
  strategies: OptimizationStrategySuggestion[];
  activeStrategy: OptimizationStrategyKey | null;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const { result, strategies, activeStrategy } = props;

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
  })).sort((left, right) => left.price - right.price);

  const hasDemand = curveData.some((point) => point.demand !== null);
  const hasTotalProfit = curveData.some((point) => point.totalProfit !== null);
  const currentPoint = findCurvePoint(curveData, result.input.salePrice);
  const buyboxPoint = findCurvePoint(curveData, result.input.buyboxPrice);

  return (
    <GlassCard className="border-border/80">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
            Fiyat ve kâr eğrisi
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {cockpitChannelLabel(props.selectedChannel)} için fiyat aralığını güvenle karşılaştır
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">
            Toplam kâr, birim kâr ve talep aynı eksende izlenir. Mevcut fiyat, buybox çizgisi
            ve strateji noktaları karar anında görünür kalır.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LegendChip label="Toplam kâr" color={TOTAL_PROFIT_COLOR} />
          <LegendChip label="Birim kâr" color={UNIT_PROFIT_COLOR} />
          {hasDemand ? <LegendChip label="Talep" color={DEMAND_COLOR} /> : null}
          <LegendChip label="Mevcut fiyat" color={CURRENT_PRICE_COLOR} dashed />
          {result.input.buyboxPrice ? (
            <LegendChip label="Buybox" color={BUYBOX_COLOR} dashed />
          ) : null}
          {strategies.map((strategy) => (
            <LegendChip
              key={strategy.key}
              label={strategy.key === "high_sales"
                ? "High Sales"
                : strategy.key === "buybox_balance"
                  ? "Buybox Balance"
                  : "Premium Balance"}
              color={STRATEGY_POINT_COLORS[strategy.key]}
              dot
            />
          ))}
        </div>
      </div>

      <div className="mt-4 h-[360px] min-w-0">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
            <LineChart data={curveData} margin={{ top: 18, right: 22, left: 4, bottom: 8 }}>
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
                  stroke={DEMAND_COLOR}
                  tickFormatter={(value) => formatProfitPricingNumber(Number(value))}
                />
              ) : null}
              <Tooltip
                cursor={{ stroke: "var(--primary)", strokeDasharray: "3 3", strokeOpacity: 0.25 }}
                content={<CurveTooltip />}
              />

              <ReferenceLine
                x={result.input.salePrice}
                stroke={CURRENT_PRICE_COLOR}
                strokeDasharray="5 5"
                strokeOpacity={0.9}
                strokeWidth={1.5}
              />
              {result.input.buyboxPrice ? (
                <ReferenceLine
                  x={result.input.buyboxPrice}
                  stroke={BUYBOX_COLOR}
                  strokeDasharray="5 5"
                  strokeOpacity={0.85}
                  strokeWidth={1.35}
                />
              ) : null}

              {currentPoint && currentPoint.totalProfit !== null ? (
                <ReferenceDot
                  x={result.input.salePrice}
                  y={currentPoint.totalProfit}
                  yAxisId="profit"
                  r={6}
                  fill={CURRENT_PRICE_COLOR}
                  stroke="var(--text-main)"
                  strokeWidth={1.5}
                />
              ) : null}
              {buyboxPoint && buyboxPoint.totalProfit !== null ? (
                <ReferenceDot
                  x={result.input.buyboxPrice ?? 0}
                  y={buyboxPoint.totalProfit}
                  yAxisId="profit"
                  r={5}
                  fill={BUYBOX_COLOR}
                  stroke="var(--text-main)"
                  strokeWidth={1.25}
                />
              ) : null}

              {strategies.map((strategy) => {
                const selectedTarget =
                  strategy.channelTargets.find(
                    (target) => target.channel === props.selectedChannel
                  ) ?? strategy.channelTargets[0];
                const profitPoint = findCurvePoint(curveData, selectedTarget?.price);

                if (!selectedTarget?.price || !profitPoint || profitPoint.totalProfit === null) {
                  return null;
                }

                return (
                  <ReferenceDot
                    key={`${strategy.key}-${selectedTarget.price}`}
                    x={selectedTarget.price}
                    y={profitPoint.totalProfit}
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
                  type="linear"
                  dataKey="totalProfit"
                  stroke={TOTAL_PROFIT_COLOR}
                  strokeWidth={3.2}
                  strokeOpacity={0.98}
                  isAnimationActive={false}
                  dot={{ r: 2.2, strokeWidth: 0, fill: TOTAL_PROFIT_COLOR }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: TOTAL_PROFIT_COLOR }}
                  name="Tahmini toplam kâr"
                  connectNulls
                />
              ) : null}
              <Line
                yAxisId="profit"
                type="linear"
                dataKey="unitProfit"
                stroke={UNIT_PROFIT_COLOR}
                strokeWidth={2.6}
                strokeOpacity={0.96}
                isAnimationActive={false}
                dot={{ r: 1.8, strokeWidth: 0, fill: UNIT_PROFIT_COLOR }}
                activeDot={{ r: 4.6, strokeWidth: 0, fill: UNIT_PROFIT_COLOR }}
                name="Birim net kâr"
              />
              {hasDemand ? (
                <Line
                  yAxisId="demand"
                  type="linear"
                  dataKey="demand"
                  stroke={DEMAND_COLOR}
                  strokeWidth={2.6}
                  strokeOpacity={0.95}
                  isAnimationActive={false}
                  dot={{ r: 1.8, strokeWidth: 0, fill: DEMAND_COLOR }}
                  activeDot={{ r: 4.2, strokeWidth: 0, fill: DEMAND_COLOR }}
                  name="Tahmini talep"
                  connectNulls
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-surface-container/45 text-muted">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Grafik hazırlanıyor
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
