"use client";

import React from "react";
import { TrendingUp, Info, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";
import type { TrafficThreshold } from "@/lib/cost-engine";
import { cn } from "@/lib/utils";

interface NetCostRecommendationCardProps {
  bestChannelName: string;
  bestMargin: number;
  results: ChannelCostResult[];
  trafficThresholds: TrafficThreshold[];
  currentTrafficCost: number;
}

export default function NetCostRecommendationCard({
  bestChannelName,
  bestMargin,
  results,
  trafficThresholds,
  currentTrafficCost
}: NetCostRecommendationCardProps) {
  const isOwnWebsite = bestChannelName === "Kendi Websitem";
  const websiteResult = results.find(r => r.channel_name === "Kendi Websitem");
  const lowestThreshold = trafficThresholds.length > 0
    ? trafficThresholds.reduce((prev, curr) => prev.maxTrafficCost < curr.maxTrafficCost ? prev : curr)
    : null;

  const getRecommendationText = () => {
    if (isOwnWebsite && websiteResult && lowestThreshold) {
      const margin = lowestThreshold.maxTrafficCost - currentTrafficCost;
      if (margin > 50) {
        return `Kendi Websitem komisyon avantajı sayesinde güçlü görünür. ${formatCurrency(currentTrafficCost)} trafik maliyetiyle şu an avantajlıdır. Fakat trafik maliyeti ${formatCurrency(lowestThreshold.maxTrafficCost)}'yi aşarsa ${lowestThreshold.vsChannel} daha kârlı hale gelir.`;
      } else if (margin > 0) {
        return `Kendi Websitem şu an kıl payı avantajlı. Trafik maliyeti yalnızca ${formatCurrency(margin)} daha artarsa ${lowestThreshold.vsChannel} daha kârlı hale gelir. Reklam harcamalarını azaltmanız önerilir.`;
      } else {
        return `Kendi Websitem trafik maliyeti eşiği aşılmış durumda. ${lowestThreshold.vsChannel} kanalına yönelmeniz veya trafik maliyetini düşürmeniz önerilir.`;
      }
    }

    if (!isOwnWebsite) {
      const wsResult = websiteResult;
      if (wsResult && lowestThreshold) {
        return `${bestChannelName} pazar yerinin hazır trafiği sayesinde en kârlı kanal konumundadır. Kendi Websitem kanalı trafik maliyeti dahil edildiğinde ${formatCurrency(wsResult.net_profit)} net kâr sağlamaktadır. Trafik maliyetini ${formatCurrency(lowestThreshold.maxTrafficCost)} altına düşürebilirseniz Kendi Websitem daha avantajlı olabilir.`;
      }
      return `${bestChannelName} pazar yerinin hazır trafiği sayesinde daha hızlı satış yapabilirsiniz ancak komisyon ve platform bedelleri marjınızı düşürür.`;
    }

    return `${bestChannelName} kanalı şu anki senaryoda en avantajlı satış kanalınızdır.`;
  };
  const recommendationText = getRecommendationText();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface-container p-5 sm:p-6">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10 space-y-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            isOwnWebsite ? "border-warning/20 bg-warning/10 text-warning" : "border-primary/20 bg-primary/10 text-primary"
          )}>
            {isOwnWebsite && lowestThreshold && (lowestThreshold.maxTrafficCost - currentTrafficCost) < 30 ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              Stratejik karar
            </p>
            <h4 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {bestChannelName} şu an en verimli kanal
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted/60">
              Sistem analizine göre {bestChannelName} kanalında marj {formatPercent(bestMargin)} seviyesinde.
              Aşağıdaki not, trafik maliyeti eşiğine göre kısa yönlendirme sağlar.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Lider kanal</p>
            <p className="mt-1 text-sm font-medium text-primary">{bestChannelName}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Kâr marjı</p>
            <p className="mt-1 text-sm font-medium text-primary">{formatPercent(bestMargin)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
          <div className="mb-3 flex items-center gap-2">
            {isOwnWebsite && lowestThreshold && (lowestThreshold.maxTrafficCost - currentTrafficCost) < 30 ? (
              <AlertTriangle className="h-4 w-4 text-warning" />
            ) : (
              <Info className="h-4 w-4 text-primary" />
            )}
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              Kısa öneri
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted/60">{recommendationText}</p>
        </div>
      </div>
    </div>
  );
}
