"use client";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PriceOptimizationResult } from "@/lib/price-optimization-types";

interface OptimizationScenarioTableProps {
  result: PriceOptimizationResult;
}

const badgeStyles: Record<string, string> = {
  Low: "bg-primary/10 text-primary border-primary/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  High: "bg-danger/10 text-danger border-danger/20",
};

const riskLabels: Record<string, string> = {
  Low: "Düşük",
  Medium: "Orta",
  High: "Yüksek",
};

export default function OptimizationScenarioTable({ result }: OptimizationScenarioTableProps) {
  return (
    <GlassCard className="border-border bg-surface-container">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Senaryo tablosu</h3>
          <p className="text-[11px] text-muted">Sistemin seçtiği 5 fiyat noktası</p>
        </div>
        <div className="rounded-md border border-border bg-surface-container px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-soft">
          Güven {result.confidence_score}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              <th className="px-3 py-2">Etiket</th>
              <th className="px-3 py-2">Test Fiyatı</th>
              <th className="px-3 py-2 text-right">Satış</th>
              <th className="px-3 py-2 text-right">Birim Kâr</th>
              <th className="px-3 py-2 text-right">Toplam Kâr</th>
              <th className="px-3 py-2 text-center">Risk</th>
            </tr>
          </thead>
          <tbody>
            {result.scenario_table.map((row) => (
              <tr
                key={row.label}
                className={cn(
                  "transition-colors duration-200",
                  row.label === "Optimum"
                    ? "bg-primary/[0.08] ring-1 ring-primary/20"
                    : "bg-surface-container hover:bg-surface-container"
                )}
              >
                <td className="rounded-l-md px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        row.label === "Optimum" ? "bg-primary shadow-[var(--shadow-primary)]" : "bg-zinc-600"
                      )}
                    />
                    <span className="font-bold text-foreground">{row.label === "Optimum" ? "En iyi" : row.label}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-soft">{formatCurrency(row.test_price)}</td>
                <td className="px-3 py-3 text-right text-soft">{row.expected_sales.toFixed(1)}</td>
                <td className="px-3 py-3 text-right text-soft">{formatCurrency(row.unit_profit)}</td>
                <td className="px-3 py-3 text-right font-bold text-foreground">{formatCurrency(row.total_profit)}</td>
                <td className="rounded-r-md px-3 py-3 text-center">
                  <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", badgeStyles[row.risk_level])}>
                    {riskLabels[row.risk_level] ?? row.risk_level} risk
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted">
        <span>Talep fiyat değişimine göre güncellenir</span>
        <span>|</span>
        <span>Son 30 günlük satış verisi kullanılır</span>
        <span>|</span>
        <span>Fiyat hassasiyeti dikkate alınır</span>
        <span>|</span>
        <span>Stok üst sınırdır</span>
      </div>
    </GlassCard>
  );
}
