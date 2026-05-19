"use client";

import React from "react";
import { BadgePercent, Calculator, FileBarChart2, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";

interface NetCostKpiCardsProps {
  result: ChannelCostResult;
}

const kpis = [
  {
    key: "net_profit",
    label: "Net kâr",
    icon: Calculator,
    highlight: true,
  },
  {
    key: "profit_margin_percent",
    label: "Kâr marjı",
    icon: BadgePercent,
  },
  {
    key: "total_unit_cost",
    label: "Toplam maliyet",
    icon: FileBarChart2,
  },
  {
    key: "estimated_vat_payable",
    label: "KDV",
    icon: ReceiptText,
  },
] as const;

export default function NetCostKpiCards({ result }: NetCostKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isHighlight = kpi.key === "net_profit";
        const valueKey = kpi.key as keyof ChannelCostResult;
        const value =
          kpi.key === "profit_margin_percent"
            ? formatPercent(Number(result[valueKey] ?? 0))
            : Number(result[valueKey] ?? 0) === 0
              ? "—"
              : formatCurrency(Number(result[valueKey] ?? 0));

        return (
          <div
            key={kpi.key}
            className={cn(
              "group relative overflow-hidden rounded-xl border transition-all duration-300",
              isHighlight
                ? "border-primary/20 bg-primary/[0.05] shadow-[var(--shadow-primary)]"
                : "border-border/80 bg-surface-container hover:border-border hover:bg-surface-container"
            )}
          >
            {isHighlight && (
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/15 blur-3xl" />
            )}

            <div className="relative z-10 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    {kpi.label}
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tracking-tight sm:text-3xl leading-none",
                      isHighlight ? "text-primary" : "text-foreground"
                    )}
                  >
                    {value}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors duration-200",
                    isHighlight
                      ? "border-primary/20 bg-primary text-primary-foreground"
                      : "border-border/80 bg-surface-container text-muted/60 group-hover:text-primary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-2">
                <div className={cn(
                  "h-1 w-10 rounded-full transition-colors duration-200",
                  isHighlight ? "bg-primary" : "bg-surface-container group-hover:bg-primary/25"
                )} />
                <div className="h-1 w-1 rounded-full bg-surface-container" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
