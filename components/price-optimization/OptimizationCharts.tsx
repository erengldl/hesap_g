"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import type { PriceOptimizationResult, PriceOptimizationScenarioPoint } from "@/lib/price-optimization-types";

interface OptimizationChartsProps {
  result: PriceOptimizationResult;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PriceOptimizationScenarioPoint }>;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-md border border-border bg-panel/70 px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        {point.is_optimum ? "En iyi nokta" : "Diğer nokta"}
      </p>
      <div className="space-y-1 text-sm">
        <p className="font-extrabold text-primary">{formatCurrency(point.price)}</p>
        <p className="text-muted">Talep: {point.expected_demand.toFixed(1)}</p>
        <p className="text-muted">Kâr: {formatCurrency(point.total_profit)}</p>
      </div>
    </div>
  );
}

export default function OptimizationCharts({ result }: OptimizationChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <GlassCard className="border-border bg-surface-container">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Fiyat ve kâr</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Arama sonucu</p>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            En iyi fiyat {formatCurrency(result.recommended_price)}
          </div>
        </div>
        <div className="h-[280px] min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
            <AreaChart data={result.scenario_data} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
              <XAxis
                dataKey="price"
                stroke="var(--text-muted)"
                fontSize={10}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="total_profit"
                stroke="var(--success)"
                strokeWidth={3}
                fill="url(#profitFill)"
                dot={false}
                isAnimationActive={true} animationDuration={400}
              />
              {result.recommended_point && (
                <ReferenceDot
                  x={result.recommended_point.price}
                  y={result.recommended_point.total_profit}
                  r={8}
                  fill="var(--success)"
                  stroke="var(--panel-bg)"
                  strokeWidth={2}
                />
              )}
              {result.current_point && (
                <ReferenceDot
                  x={result.current_point.price}
                  y={result.current_point.total_profit}
                  r={6}
                  fill="#A1A1AA"
                  stroke="var(--panel-bg)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="border-border bg-surface-container">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Fiyat ve talep</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Talep modeli</p>
          </div>
          <div className="rounded-md border border-border bg-surface-container px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-soft">
            Hassasiyet {result.elasticity_estimate.toFixed(2)}
          </div>
        </div>
        <div className="h-[280px] min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
            <LineChart data={result.scenario_data} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
              <XAxis
                dataKey="price"
                stroke="var(--text-muted)"
                fontSize={10}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickFormatter={(value) => `${Number(value).toFixed(0)} adet`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="expected_demand"
                stroke="var(--success)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--success)", stroke: "var(--panel-bg)", strokeWidth: 2 }}
                activeDot={{ r: 8, fill: "var(--success)", stroke: "var(--panel-bg)", strokeWidth: 2 }}
                isAnimationActive={true} animationDuration={400}
              />
              {result.recommended_point && (
                <ReferenceDot
                  x={result.recommended_point.price}
                  y={result.recommended_point.expected_demand}
                  r={8}
                  fill="var(--success)"
                  stroke="var(--panel-bg)"
                  strokeWidth={2}
                />
              )}
              {result.current_point && (
                <ReferenceDot
                  x={result.current_point.price}
                  y={result.current_point.expected_demand}
                  r={6}
                  fill="#A1A1AA"
                  stroke="var(--panel-bg)"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
