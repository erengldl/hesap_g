"use client";

import { Sparkles, Target } from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency, formatProfitPricingNumber, formatProfitPricingPercent } from "@/lib/profit-pricing/formatters";
import type { PriceScenario } from "@/lib/profit-pricing/types";
import { decisionLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

function riskTone(risk: PriceScenario["risk"]) {
  if (risk === "low") return "border-success/20 bg-success/10 text-success";
  if (risk === "medium") return "border-warning/20 bg-warning/10 text-warning";
  return "border-danger/20 bg-danger/10 text-danger";
}

export default function PriceScenarioTable(props: {
  scenarios: PriceScenario[];
  selectedPrice: number | null;
  onSelectPrice: (price: number) => void;
  onApplyPrice: (price: number) => void;
}) {
  const recommendedScenario =
    props.scenarios.find((scenario) => scenario.key === "recommended") ?? props.scenarios[0] ?? null;

  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
              Senaryolar
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Fiyat senaryoları</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderBadge label="Senaryo sayısı" value={String(props.scenarios.length)} />
            {recommendedScenario && (
              <HeaderBadge
                label="Önerilen fiyat"
                value={formatProfitPricingCurrency(recommendedScenario.price)}
                accent
              />
            )}
            {props.selectedPrice !== null && (
              <HeaderBadge label="Seçili fiyat" value={formatProfitPricingCurrency(props.selectedPrice)} />
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto px-1 py-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Senaryo</th>
              <th>Satış Fiyatı</th>
              <th>Net Maliyet</th>
              <th>Net Kâr</th>
              <th>Marj</th>
              <th>Tahmini Talep</th>
              <th>Tahmini Toplam Kâr</th>
              <th>İade/Fire Risk Maliyeti</th>
              <th>Risk</th>
              <th>Durum</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {props.scenarios.map((scenario) => (
              <tr
                key={scenario.key}
                className={cn(
                  scenario.key === "recommended" && "bg-primary/6",
                  props.selectedPrice === scenario.price && "bg-primary/10",
                  scenario.key === "aggressive" && "bg-danger/5"
                )}
              >
                <td>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-foreground">{scenario.label}</div>
                      {scenario.key === "recommended" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                          <Sparkles className="h-3 w-3" />
                          Önerilen
                        </span>
                      )}
                      {props.selectedPrice === scenario.price && (
                        <span className="inline-flex rounded-full border border-border/70 bg-panel/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                          Seçili
                        </span>
                      )}
                    </div>
                    {scenario.notes[0] && <div className="text-xs text-soft">{scenario.notes[0]}</div>}
                  </div>
                </td>
                <td>{formatProfitPricingCurrency(scenario.price)}</td>
                <td>{formatProfitPricingCurrency(scenario.netCost)}</td>
                <td>{formatProfitPricingCurrency(scenario.netProfit)}</td>
                <td>{formatProfitPricingPercent(scenario.profitMargin)}</td>
                <td>{formatProfitPricingNumber(scenario.estimatedDemand)}</td>
                <td>{formatProfitPricingCurrency(scenario.estimatedTotalProfit)}</td>
                <td>
                  <div className="space-y-1">
                    <div>{formatProfitPricingCurrency(scenario.returnRiskCost)}</div>
                    <div className="text-xs text-soft">
                      {scenario.returnRiskPrediction?.usedFallback ? "Ortalama tahmini" : "ML tahmini"}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", riskTone(scenario.risk))}>
                    {scenario.risk === "low" ? "Düşük" : scenario.risk === "medium" ? "Orta" : "Yüksek"}
                  </span>
                </td>
                <td>{decisionLabel(scenario.decision)}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => props.onSelectPrice(scenario.price)}
                      className={cn(
                        "btn-secondary h-9 px-3 text-[11px]",
                        props.selectedPrice === scenario.price && "border-primary/30 bg-primary/10 text-primary"
                      )}
                    >
                      <Target className="h-3.5 w-3.5" />
                      Öneri yap
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onApplyPrice(scenario.price)}
                      className="btn-primary h-9 px-3 text-[11px]"
                    >
                      Uygula
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function HeaderBadge({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-2",
        accent ? "border-primary/20 bg-primary/10 text-primary" : "border-border/70 bg-panel/60 text-foreground"
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted/60">{label}</p>
      <p className="mt-1 text-sm font-semibold tracking-tight">{value}</p>
    </div>
  );
}
