"use client";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency, formatProfitPricingPercent } from "@/lib/profit-pricing/formatters";
import type { CostBreakdownItem } from "@/lib/profit-pricing/types";

const GROUP_LABELS: Record<CostBreakdownItem["group"], string> = {
  product: "Ürün",
  channel: "Kanal",
  operation: "Operasyon",
  growth: "Büyüme",
  tax: "Vergi",
  fixed: "Sabit",
};

export default function CostBreakdownTable({ items }: { items: CostBreakdownItem[] }) {
  return (
    <GlassCard className="border-border/80">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Detay tablo</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Maliyet açıklaması</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Maliyet Kalemi</th>
              <th>Grup</th>
              <th>Tutar</th>
              <th>Satışa Oran</th>
              <th>Fiyata Bağlı mı?</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>{GROUP_LABELS[item.group]}</td>
                <td>{formatProfitPricingCurrency(item.amount)}</td>
                <td>{formatProfitPricingPercent(item.percentageOfSalePrice)}</td>
                <td>{item.isVariableWithPrice ? "Evet" : "Hayır"}</td>
                <td className="text-soft">{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
