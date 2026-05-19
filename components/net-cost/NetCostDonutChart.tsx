"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";

import { cn } from "@/lib/utils";

interface NetCostDonutChartProps {
  data: ChannelCostResult;
}

export default function NetCostDonutChart({ data }: NetCostDonutChartProps) {
  const chartData = [
    { name: "Ürün Maliyeti", value: data.product_cost, color: "var(--surface-strong)" },
    { name: "Paketleme", value: data.packaging_cost, color: "var(--surface-strong)" },
    { name: "Kargo", value: data.shipping_cost, color: "var(--text-muted)" },
    { name: "Komisyon", value: data.commission_cost, color: "var(--text-muted)" },
    { name: "Platform", value: data.platform_fee_cost, color: "#a1a1aa" },
    { name: "Ödeme", value: data.payment_gateway_cost, color: "#d4d4d8" },
    { name: "Trafik / Reklam", value: data.traffic_ad_cost, color: "var(--warning)" },
    { name: "Ek Reklam", value: data.unit_ad_cost, color: "color-mix(in srgb, var(--success) 13%, transparent)" },
    { name: "Sabit Gider", value: data.unit_fixed_cost, color: "color-mix(in srgb, var(--success) 7%, transparent)" },
    { name: "Beklenen İade", value: data.expected_return_cost, color: "#f9731633" },
    { name: "Net Kâr", value: Math.max(0, data.net_profit), color: "var(--success)" },
  ].filter(item => item.value > 0);

  return (
    <div className="w-full min-w-0">
      <div className="space-y-2 sm:hidden">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-container p-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <p className="truncate text-xs font-bold text-soft">{item.name}</p>
            </div>
            <p className={cn("text-xs font-extrabold italic tracking-tighter", item.name === "Net Kâr" ? "text-primary" : "text-foreground")}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden sm:block h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={65}
              outerRadius={85}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{
                    filter: entry.name === "Net Kâr" ? "drop-shadow(0 0 12px var(--success))" : "none"
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-panel/90 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-[var(--shadow-card)]">
                      <p className="text-[9px] text-muted uppercase font-extrabold tracking-widest mb-1">{item.name}</p>
                      <p className={cn(
                        "text-base font-extrabold italic tracking-tighter",
                        item.name === "Net Kâr" ? "text-primary" : "text-foreground"
                      )}>
                        {formatCurrency(item.value)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-[9px] text-muted font-extrabold uppercase tracking-tighter ml-1">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
