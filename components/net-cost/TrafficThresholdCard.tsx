"use client";

import React from "react";
import { Target } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { TrafficThreshold } from "@/lib/cost-engine";

interface TrafficThresholdCardProps {
  thresholds: TrafficThreshold[];
  currentTrafficCost: number;
  bestChannelName: string;
}

export default function TrafficThresholdCard({ thresholds, currentTrafficCost, bestChannelName }: TrafficThresholdCardProps) {
  const isWebsiteBest = bestChannelName === "Kendi Websitem";
  const tightestThreshold = thresholds.length > 0
    ? thresholds.reduce((prev, curr) => (prev.maxTrafficCost < curr.maxTrafficCost ? prev : curr))
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface-container p-5 sm:p-6">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10 space-y-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            isWebsiteBest ? "border-primary/20 bg-primary/10 text-primary" : "border-danger/20 bg-danger/10 text-danger"
          )}>
            <Target className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              Trafik eşiği
            </p>
            <h4 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Web sitesi için kârlılık aralığı
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-muted/60">
              Sipariş başı trafik maliyetini bu aralığın altında tuttuğunuzda web sitesi kanalındaki avantaj korunur.
            </p>
          </div>
        </div>

        {tightestThreshold && (
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Mevcut CPA</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatCurrency(currentTrafficCost)} · en sıkı eşik {formatCurrency(tightestThreshold.maxTrafficCost)}
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {thresholds.map((threshold) => {
            const isExceeded = currentTrafficCost > threshold.maxTrafficCost;
            const remainingMargin = threshold.maxTrafficCost - currentTrafficCost;
            const usagePercent = threshold.maxTrafficCost > 0
              ? Math.min(100, (currentTrafficCost / threshold.maxTrafficCost) * 100)
              : 100;

            return (
              <div
                key={threshold.vsChannel}
                className={cn(
                  "rounded-2xl border p-4 transition-colors duration-200",
                  isExceeded ? "border-danger/20 bg-danger/[0.04]" : "border-border/80 bg-surface-container"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                      Karşılaştırma
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {threshold.vsChannel}
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-md border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                    isExceeded ? "border-danger/20 bg-danger/10 text-danger" : "border-primary/20 bg-primary/10 text-primary"
                  )}>
                    {isExceeded ? "Kritik" : "Güvenli"}
                  </div>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-surface-container p-[2px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isExceeded
                        ? "bg-danger"
                        : usagePercent > 80
                          ? "bg-warning"
                          : "bg-primary"
                    )}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted/60">Eşik</span>
                  <span className={cn("font-medium", isExceeded ? "text-danger" : "text-primary")}>
                    {formatCurrency(threshold.maxTrafficCost)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted/60">Fark</span>
                  <span className={cn("font-medium", isExceeded ? "text-danger" : "text-foreground")}>
                    {formatCurrency(Math.abs(remainingMargin))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
          <p className="text-sm leading-relaxed text-muted/60">
            Eşiğin üzerinde trafik maliyeti oluşursa pazaryeri kanalları matematiksel olarak daha verimli hale gelir.
          </p>
        </div>
      </div>
    </div>
  );
}
