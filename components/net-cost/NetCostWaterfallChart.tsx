"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NetCostWaterfallChartProps {
  data: ChannelCostResult;
}

export default function NetCostWaterfallChart({ data }: NetCostWaterfallChartProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.("change", update);
    return () => {
      mediaQuery.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setChartWidth(0);
      return;
    }

    const container = chartContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const measuredWidth = Math.floor(container.getBoundingClientRect().width);
      setChartWidth(Math.max(0, measuredWidth - 32));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      const raf = window.requestAnimationFrame(updateWidth);
      return () => window.cancelAnimationFrame(raf);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    return () => observer.disconnect();
  }, [isDesktop]);

  // Build cumulative waterfall steps
  let running = data.sale_price;
  const allSteps = [
    { name: "Satış Fiyatı", value: data.sale_price, display: data.sale_price, color: "var(--text-main)", start: 0, isStart: true },
  ];

  const costs = [
    { name: "Ürün", amount: data.product_cost, color: "var(--text-muted)" },
    { name: "Paketleme", amount: data.packaging_cost, color: "var(--text-muted)" },
    { name: "Kargo", amount: data.shipping_cost, color: "#a1a1aa" },
    { name: "Komisyon", amount: data.commission_cost, color: "#d4d4d8" },
    { name: "Platform", amount: data.platform_fee_cost, color: "#e4e4e7" },
    { name: "Ödeme", amount: data.payment_gateway_cost, color: "#f4f4f5" },
    { name: "Trafik/Reklam", amount: data.traffic_ad_cost, color: "var(--warning)" },
    { name: "Ek Reklam", amount: data.unit_ad_cost, color: "color-mix(in srgb, var(--success) 20%, transparent)" },
    { name: "Sabit Gider", amount: data.unit_fixed_cost, color: "color-mix(in srgb, var(--success) 7%, transparent)" },
    { name: "Beklenen İade", amount: data.expected_return_cost, color: "#f9731633" },
  ];

  for (const cost of costs) {
    if (cost.amount > 0) {
      running -= cost.amount;
      allSteps.push({
        name: cost.name,
        value: -cost.amount,
        display: cost.amount,
        color: cost.color,
        start: running,
        isStart: false,
      });
    }
  }

  allSteps.push({
    name: "Net Kâr",
    value: data.net_profit,
    display: data.net_profit,
    color: "var(--success)",
    start: 0,
    isStart: false,
  });

  const chartData = allSteps.map(step => ({
    name: step.name,
    display: step.display,
    uv: step.isStart ? [0, step.value] : step.name === "Net Kâr" ? [0, data.net_profit] : [step.start, step.start + step.display],
    color: step.color
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:hidden">
        {allSteps.map((step) => (
          <div
            key={step.name}
            className={cn(
              "rounded-2xl border px-4 py-3",
              step.name === "Net Kâr"
                ? "border-primary/20 bg-primary/[0.05]"
                : step.isStart
                  ? "border-border/80 bg-surface-container"
                  : "border-border/80 bg-surface-container"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                  {step.name}
                </p>
                <p className="text-xs text-muted/60">
                  {step.name === "Net Kâr" ? "Nihai sonuç" : "Ara maliyet"}
                </p>
              </div>
              <p className={cn("text-sm font-medium tracking-tight", step.name === "Net Kâr" ? "text-primary" : "text-foreground/80")}>
                {formatCurrency(step.display)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isDesktop && (
        <div
          ref={chartContainerRef}
          className="h-[340px] min-w-0 rounded-xl border border-border/80 bg-surface-container p-4"
        >
          {chartWidth > 0 ? (
            <ComposedChart
              width={chartWidth}
              height={308}
              data={chartData}
              layout="vertical"
              margin={{ top: 12, right: 72, bottom: 12, left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={true} vertical={false} />
              <XAxis type="number" hide domain={[0, data.sale_price * 1.1]} />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b8b8b", fontSize: 10, fontWeight: 500, textAnchor: "start" }}
                width={120}
                dx={-8}
              />
              <Tooltip
                cursor={{ fill: "var(--grid-line)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const step = payload[0].payload;
                  return (
                    <div className="rounded-2xl border border-border bg-panel/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted/60">
                        {step.name}
                      </p>
                      <p className={cn("text-sm font-medium tracking-tight", step.name === "Net Kâr" ? "text-primary" : "text-foreground")}>
                        {formatCurrency(step.display)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="uv" barSize={12} radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name === "Net Kâr" ? "var(--success)" : entry.color}
                    fillOpacity={entry.name === "Net Kâr" ? 1 : 0.45}
                    style={{ filter: entry.name === "Net Kâr" ? "drop-shadow(0 0 12px var(--success))" : "none" }}
                  />
                ))}
                <LabelList
                  dataKey="display"
                  position="right"
                  formatter={(val: any) => formatCurrency(Number(val ?? 0))}
                  style={{ fill: "#8b8b8b", fontSize: 10, fontWeight: 500, letterSpacing: "0.03em" }}
                  offset={18}
                />
              </Bar>
            </ComposedChart>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-container text-sm text-muted/60">
              Grafik verisi hazırlanıyor
            </div>
          )}
        </div>
      )}
    </div>
  );
}
