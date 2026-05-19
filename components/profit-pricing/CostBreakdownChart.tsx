"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency } from "@/lib/profit-pricing/formatters";
import type { CostBreakdownItem } from "@/lib/profit-pricing/types";

export default function CostBreakdownChart({ items }: { items: CostBreakdownItem[] }) {
  const [isMounted, setIsMounted] = useState(false);
  const data = items.map((item) => ({
    label: item.label,
    amount: item.amount,
  }));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <GlassCard className="border-border/80">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Maliyet kırılımı</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Kârı düşüren ana kalemler</h3>
      </div>
      <div className="h-[320px] min-w-0">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" tickFormatter={(value) => formatProfitPricingCurrency(Number(value))} />
              <YAxis type="category" dataKey="label" width={110} stroke="var(--text-muted)" />
              <Tooltip
                formatter={(value) => formatProfitPricingCurrency(Number(value))}
                contentStyle={{
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--surface-strong)",
                  background: "var(--panel-bg)",
                }}
              />
              <Bar dataKey="amount" radius={[0, 10, 10, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </GlassCard>
  );
}
