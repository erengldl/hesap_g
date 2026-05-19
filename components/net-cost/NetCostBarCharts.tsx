"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";

interface NetCostBarChartsProps {
  results: ChannelCostResult[];
}

export default function NetCostBarCharts({ results }: NetCostBarChartsProps) {
  const chartData = results.map(r => ({
    name: r.channel_name,
    "Net Kâr": r.net_profit,
    "Toplam Maliyet": r.total_unit_cost,
    "Kâr Marjı": r.profit_margin_percent
  }));
  if (chartData.length === 0) {
    return null;
  }
  const bestEntry = chartData.reduce((best, current) => (current["Net Kâr"] > best["Net Kâr"] ? current : best), chartData[0]);

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3 sm:hidden">
        {chartData.map((entry) => {
          const isBest = bestEntry?.name === entry.name;

          return (
            <details
              key={entry.name}
              className={`rounded-2xl border p-4 transition-colors duration-200 ${isBest ? "border-primary/20 bg-primary/5" : "border-border/80 bg-surface-container"}`}
            >
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-extrabold italic tracking-tighter text-foreground">{entry.name}</p>
                      {isBest && (
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-primary">
                          En iyi
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted">
                      Net Kâr {formatCurrency(entry["Net Kâr"])}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Marj</p>
                    <p className={entry["Net Kâr"] > 0 ? "text-primary text-sm font-extrabold italic" : "text-danger text-sm font-extrabold italic"}>
                      {formatPercent(entry["Kâr Marjı"])}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.25em]">
                  <span className="text-muted">Satırları göster</span>
                  <span className="text-muted">Maliyet özeti</span>
                </div>
              </summary>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/80 bg-panel/40 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Toplam Maliyet</p>
                  <p className="text-sm font-extrabold text-foreground">{formatCurrency(entry["Toplam Maliyet"])}</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-panel/40 p-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Marj</p>
                  <p className={entry["Net Kâr"] > 0 ? "text-primary text-sm font-extrabold italic" : "text-danger text-sm font-extrabold italic"}>
                    {formatPercent(entry["Kâr Marjı"])}
                  </p>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="hidden sm:block space-y-12">
        <div className="h-[280px]">
          <h5 className="text-[10px] font-extrabold text-muted uppercase mb-6 tracking-[0.2em] text-center italic">Net Kâr Karşılaştırması</h5>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
              <Tooltip
                cursor={{ fill: 'var(--grid-line)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-panel/90 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-[var(--shadow-card)]">
                        <p className="text-[9px] text-muted uppercase font-extrabold tracking-widest mb-1">{payload[0].payload.name}</p>
                        <p className="text-base font-extrabold italic tracking-tighter text-primary">{formatCurrency(payload[0].value as number)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="Net Kâr" radius={[2, 2, 0, 0]} barSize={32}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry["Net Kâr"] > 0 ? "var(--success)" : "var(--danger)"}
                    style={{ filter: entry["Net Kâr"] > 0 ? "drop-shadow(0 0 10px var(--success))" : "none" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[280px]">
          <h5 className="text-[10px] font-extrabold text-muted uppercase mb-6 tracking-[0.2em] text-center italic">Toplam Maliyet Karşılaştırması</h5>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
              <Tooltip
                cursor={{ fill: 'var(--grid-line)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-panel/90 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-[var(--shadow-card)]">
                        <p className="text-[9px] text-muted uppercase font-extrabold tracking-widest mb-1">{payload[0].payload.name}</p>
                        <p className="text-base font-extrabold italic tracking-tighter text-foreground">{formatCurrency(payload[0].value as number)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="Toplam Maliyet" fill="var(--surface-strong)" radius={[2, 2, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
