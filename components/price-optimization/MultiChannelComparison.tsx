"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { BarChart3, Zap, Target } from "lucide-react";
import type { PriceOptimizationInput, PriceOptimizationResult } from "@/lib/price-optimization-types";

interface Props {
  productId: number;
  marketplaceIds: number[];
  marketplaceNames: string[];
  baseInput: PriceOptimizationInput;
}

type ChannelResult = {
  marketplaceName: string;
  marketplaceId: number;
  result: PriceOptimizationResult | null;
  loading: boolean;
};

export default function MultiChannelComparison({ productId, marketplaceIds, marketplaceNames, baseInput }: Props) {
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const resultCacheRef = useRef(new Map<string, ChannelResult[]>());
  const comparisonMarketplaces = useMemo(
    () =>
      marketplaceIds.map((marketplaceId, index) => ({
        marketplaceId,
        marketplaceName: marketplaceNames[index] ?? `Kanal ${marketplaceId}`,
      })),
    [marketplaceIds, marketplaceNames],
  );
  const comparisonBaseInput = useMemo(
    () => ({
      productId: baseInput.productId,
      marketplaceId: baseInput.marketplaceId,
      minPrice: baseInput.minPrice,
      maxPrice: baseInput.maxPrice,
      currentSalesVolume: baseInput.currentSalesVolume,
      stock: baseInput.stock,
      elasticityEstimate: baseInput.elasticityEstimate,
    }),
    [
      baseInput.currentSalesVolume,
      baseInput.elasticityEstimate,
      baseInput.marketplaceId,
      baseInput.maxPrice,
      baseInput.minPrice,
      baseInput.productId,
      baseInput.stock,
    ],
  );
  const comparisonCacheKey = useMemo(
    () =>
      [
        productId,
        marketplaceIds.join(","),
        comparisonBaseInput.marketplaceId,
        comparisonBaseInput.minPrice,
        comparisonBaseInput.maxPrice,
        comparisonBaseInput.currentSalesVolume,
        comparisonBaseInput.stock,
        comparisonBaseInput.elasticityEstimate ?? "auto",
      ].join("|"),
    [comparisonBaseInput, marketplaceIds, productId],
  );

  useEffect(() => {
    if (comparisonMarketplaces.length === 0) {
      setChannels([]);
      return;
    }

    const cached = resultCacheRef.current.get(comparisonCacheKey);
    if (cached) {
      setChannels(cached);
      return;
    }

    const controller = new AbortController();
    const initial: ChannelResult[] = comparisonMarketplaces.map((channel) => ({
      marketplaceName: channel.marketplaceName,
      marketplaceId: channel.marketplaceId,
      result: null,
      loading: true,
    }));
    setChannels(initial);

    void (async () => {
      const results = await Promise.all(
        initial.map(async (ch) => {
          try {
            const res = await fetch("/api/price-optimization/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                ...comparisonBaseInput,
                productId,
                marketplaceId: ch.marketplaceId,
                persist: false,
              }),
            });
            if (!res.ok) {
              return { ...ch, loading: false };
            }
            const json = await res.json();
            return { ...ch, result: json.success ? json.result : null, loading: false };
          } catch {
            if (controller.signal.aborted) {
              return ch;
            }
            return { ...ch, loading: false };
          }
        })
      );
      if (!controller.signal.aborted) {
        resultCacheRef.current.set(comparisonCacheKey, results);
        setChannels(results);
      }
    })();
    return () => controller.abort();
  }, [comparisonBaseInput, comparisonCacheKey, comparisonMarketplaces, productId]);

  if (channels.length === 0) return null;

  const bestChannel = channels
    .filter((c) => c.result)
    .sort((a, b) => (b.result?.expected_profit_recommended ?? 0) - (a.result?.expected_profit_recommended ?? 0))[0];

  return (
    <GlassCard className="border-primary/20 bg-primary/5">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/20 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Kanal karşılaştırması</h3>
            <p className="text-[11px] text-muted">Kanalları tek tabloda karşılaştır</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-muted">
                <th className="pb-2 font-bold">Kanal</th>
                <th className="pb-2 font-bold text-right">Mevcut</th>
                <th className="pb-2 font-bold text-right">Öneri</th>
                <th className="pb-2 font-bold text-right">Maliyet</th>
                <th className="pb-2 font-bold text-right">Talep</th>
                <th className="pb-2 font-bold text-right">Net Kâr</th>
                <th className="pb-2 font-bold text-right">Fark</th>
                <th className="pb-2 font-bold text-center">Güven</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {channels.map((ch) => {
                if (ch.loading) {
                  return (
                    <tr key={ch.marketplaceId}>
                      <td className="py-3 font-bold text-foreground">{ch.marketplaceName}</td>
                      <td colSpan={7} className="py-3 text-center text-muted text-xs">
                        <span className="inline-block animate-pulse">Hesaplanıyor...</span>
                      </td>
                    </tr>
                  );
                }

                if (!ch.result) {
                  return (
                    <tr key={ch.marketplaceId}>
                      <td className="py-3 font-bold text-foreground">{ch.marketplaceName}</td>
                      <td colSpan={7} className="py-3 text-center text-muted text-xs">Veri yok</td>
                    </tr>
                  );
                }

                const r = ch.result;
                const profitDelta = r.expected_profit_recommended - r.expected_profit_current;
                const isBest = bestChannel?.marketplaceId === ch.marketplaceId;

                return (
                  <tr key={ch.marketplaceId} className={cn("group hover:bg-surface-container transition-colors duration-200", isBest && "bg-primary/5")}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {isBest && <Zap className="w-3.5 h-3.5 text-primary" />}
                        <span className="font-bold text-foreground">{ch.marketplaceName}</span>
                        {isBest && (
                          <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            En iyi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right text-muted">{formatCurrency(r.current_price)}</td>
                    <td className="py-3 text-right">
                      <span className={cn("font-bold", r.recommended_price > r.current_price ? "text-primary" : "text-warning")}>
                        {formatCurrency(r.recommended_price)}
                      </span>
                    </td>
                    <td className="py-3 text-right text-muted">{formatCurrency(r.current_unit_cost)}</td>
                    <td className="py-3 text-right text-soft">{r.expected_demand_recommended.toFixed(0)} adet</td>
                    <td className="py-3 text-right font-bold text-primary">{formatCurrency(r.expected_profit_recommended)}</td>
                    <td className="py-3 text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold",
                        profitDelta > 0 ? "bg-primary/10 text-primary border-primary/20" :
                        profitDelta < 0 ? "bg-danger/10 text-danger border-danger/20" :
                        "bg-surface-container text-muted border-border"
                      )}>
                        <Target className="w-3 h-3" />
                        {profitDelta >= 0 ? "+" : ""}{formatCurrency(profitDelta)}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-bold",
                        r.confidence_score === "High" ? "bg-primary/10 text-primary border-primary/20" :
                        r.confidence_score === "Medium" ? "bg-warning/10 text-warning border-warning/20" :
                        "bg-danger/10 text-danger border-danger/20"
                      )}>
                        {r.confidence_score === "High" ? "YÜKSEK" : r.confidence_score === "Medium" ? "ORTA" : "DÜŞÜK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </GlassCard>
  );
}
