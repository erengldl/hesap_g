"use client";

import { BadgePercent, Calculator, FileBarChart2, ReceiptText } from "lucide-react";

import { KpiCard } from "@/components/ui-custom/GlassComponents";
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
    tone: "primary",
  },
  {
    key: "profit_margin_percent",
    label: "Kâr marjı",
    icon: BadgePercent,
    tone: "default",
  },
  {
    key: "total_unit_cost",
    label: "Toplam maliyet",
    icon: FileBarChart2,
    tone: "default",
  },
  {
    key: "estimated_vat_payable",
    label: "KDV",
    icon: ReceiptText,
    tone: "default",
  },
] as const;

export default function NetCostKpiCards({ result }: NetCostKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const valueKey = kpi.key as keyof ChannelCostResult;
        const value =
          kpi.key === "profit_margin_percent"
            ? formatPercent(Number(result[valueKey] ?? 0))
            : Number(result[valueKey] ?? 0) === 0
              ? "—"
              : formatCurrency(Number(result[valueKey] ?? 0));

        return (
          <KpiCard
            key={kpi.key}
            title={kpi.label}
            value={value}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        );
      })}
    </div>
  );
}
