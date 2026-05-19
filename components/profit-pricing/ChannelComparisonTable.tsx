"use client";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency, formatProfitPricingNumber, formatProfitPricingPercent } from "@/lib/profit-pricing/formatters";
import type { ChannelComparisonItem, SalesChannel } from "@/lib/profit-pricing/types";
import { cn } from "@/lib/utils";
import { channelLabel, decisionLabel } from "@/lib/profit-pricing/utils";

export default function ChannelComparisonTable(props: {
  items: ChannelComparisonItem[];
  onSelectChannel: (channel: SalesChannel) => void;
}) {
  const bestChannel =
    [...props.items].sort(
      (left, right) =>
        (right.estimatedTotalProfit ?? right.netProfit) - (left.estimatedTotalProfit ?? left.netProfit)
    )[0] ?? null;

  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
              Kanal karşılaştırması
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Hangi kanal daha kârlı?</h3>
          </div>
          {bestChannel && (
            <div className="rounded-full border border-success/20 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              En güçlü kanal: {channelLabel(bestChannel.channel)}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto px-1 py-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kanal</th>
              <th>Mevcut Fiyat</th>
              <th>Net Maliyet</th>
              <th>Net Kâr</th>
              <th>Marj</th>
              <th>Başabaş Fiyat</th>
              <th>Önerilen Fiyat</th>
              <th>Talep Tahmini</th>
              <th>Beklenen Toplam Kâr</th>
              <th>Durum</th>
              <th>Öneri</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr
                key={item.channel}
                className={cn(bestChannel?.channel === item.channel && "bg-success/5")}
              >
                <td>
                  <button
                    type="button"
                    className="font-semibold text-foreground transition-colors duration-200 hover:text-primary"
                    onClick={() => props.onSelectChannel(item.channel)}
                  >
                    {channelLabel(item.channel)}
                  </button>
                </td>
                <td>{formatProfitPricingCurrency(item.currentPrice)}</td>
                <td>{formatProfitPricingCurrency(item.netCost)}</td>
                <td>{formatProfitPricingCurrency(item.netProfit)}</td>
                <td>{formatProfitPricingPercent(item.profitMargin)}</td>
                <td>{formatProfitPricingCurrency(item.breakEvenPrice)}</td>
                <td>
                  {item.recommendedPriceRange
                    ? `${formatProfitPricingCurrency(item.recommendedPriceRange.preferred)}`
                    : "Veri eksik"}
                </td>
                <td>{formatProfitPricingNumber(item.estimatedDemand)}</td>
                <td>{formatProfitPricingCurrency(item.estimatedTotalProfit)}</td>
                <td>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                      item.decision === "profitable"
                        ? "border-success/20 bg-success/10 text-success"
                        : item.decision === "loss"
                          ? "border-danger/20 bg-danger/10 text-danger"
                          : "border-warning/20 bg-warning/10 text-warning"
                    )}
                  >
                    {decisionLabel(item.decision)}
                  </span>
                </td>
                <td className="text-soft">{item.shortRecommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
