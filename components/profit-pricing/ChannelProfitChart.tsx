"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency } from "@/lib/profit-pricing/formatters";
import type { ChannelComparisonItem } from "@/lib/profit-pricing/types";
import { channelLabel } from "@/lib/profit-pricing/utils";

export default function ChannelProfitChart({ items }: { items: ChannelComparisonItem[] }) {
  const [isMounted, setIsMounted] = useState(false);
  const data = items.map((item) => ({
    label: channelLabel(item.channel),
    unitProfit: item.netProfit,
    totalProfit: item.estimatedTotalProfit,
  }));
  const hasTotalProfit = data.some((item) => item.totalProfit !== null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <GlassCard className="border-border/80">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Kanal grafiği</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Kanal bazlı kâr karşılaştırması</h3>
      </div>
      <div className="h-[300px] min-w-0">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <BarChart data={data} margin={{ top: 8, right: 14, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" tickFormatter={(value) => formatProfitPricingCurrency(Number(value))} />
              <Tooltip
                formatter={(value) => formatProfitPricingCurrency(Number(value))}
                contentStyle={{
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--surface-strong)",
                  background: "var(--panel-bg)",
                }}
              />
              <Bar dataKey="unitProfit" fill="var(--success)" radius={[10, 10, 0, 0]} name="Birim net kâr" />
              {hasTotalProfit && (
                <Bar dataKey="totalProfit" fill="var(--primary)" radius={[10, 10, 0, 0]} name="Beklenen toplam kâr" />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </GlassCard>
  );
}
