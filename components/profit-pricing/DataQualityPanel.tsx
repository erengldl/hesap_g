"use client";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency, formatProfitPricingPercent } from "@/lib/profit-pricing/formatters";
import type { ProfitPricingResult } from "@/lib/profit-pricing/types";

export default function DataQualityPanel({ result }: { result: ProfitPricingResult }) {
  const currentScenario = result.priceScenarios.find((scenario) => scenario.key === "current");
  const returnRiskPrediction = currentScenario?.returnRiskPrediction;
  const returnRiskCost = currentScenario?.returnRiskCost ?? 0;
  const profitWithoutReturnRisk =
    Number.isFinite(result.netProfit) && Number.isFinite(returnRiskCost)
      ? result.netProfit + returnRiskCost
      : null;
  const sourceLabel =
    returnRiskPrediction?.modelType === "manual-override"
      ? "Manuel giriş"
      : returnRiskPrediction?.usedFallback
        ? "Geçmiş ortalama fallback"
        : returnRiskPrediction
          ? "Eğitilmiş ML modeli"
          : "Henüz yok";

  return (
    <GlassCard className="border-border/80">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Veri güveni</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {result.dataQuality === "high" ? "Yüksek" : result.dataQuality === "medium" ? "Orta" : "Düşük"}
          </h3>
        </div>

        <div className="flex w-full flex-col gap-3">
          <div className="rounded-2xl border border-border/70 bg-surface-container/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
              İade/Fire Risk Tahmini
            </p>
            <div className="mt-3 space-y-3">
              <RiskMetric label="Sipariş başı risk" value={formatProfitPricingCurrency(currentScenario?.returnRiskCost)} />
              <RiskMetric
                label="İade olasılığı"
                value={formatProfitPricingPercent(returnRiskPrediction?.returnProbability)}
              />
              <RiskMetric
                label="İade olursa maliyet"
                value={formatProfitPricingCurrency(returnRiskPrediction?.expectedCostIfReturned)}
              />
              <RiskMetric
                label="Güven"
                value={
                  returnRiskPrediction?.confidence === "high"
                    ? "Yüksek"
                    : returnRiskPrediction?.confidence === "medium"
                      ? "Orta"
                      : returnRiskPrediction?.confidence === "low"
                        ? "Düşük"
                        : "Henüz yok"
                }
              />
              <RiskMetric label="Kaynak" value={sourceLabel} />
              <RiskMetric
                label="Net kara etki"
                value={returnRiskCost > 0 ? formatProfitPricingCurrency(-returnRiskCost) : "Etkisiz"}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-soft">
              {returnRiskPrediction?.explanation ??
                "Geçmiş satış ve iade verisi yoksa kategori/kanal ortalamalarıyla güvenli tahmin kullanılır."}
            </p>
            {profitWithoutReturnRisk !== null && returnRiskCost > 0 && (
              <p className="mt-2 text-xs leading-5 text-soft">
                İade/fire riski olmasaydı birim net kâr yaklaşık {formatProfitPricingCurrency(profitWithoutReturnRisk)}
                olurdu; mevcut net kâra etkisi {formatProfitPricingCurrency(-returnRiskCost)}.
              </p>
            )}
          </div>
          <PanelList title="Eksik alanlar" items={result.missingFields.length > 0 ? result.missingFields : ["Eksik alan yok."]} />
          <PanelList title="Varsayımlar" items={result.assumptions.length > 0 ? result.assumptions : ["Ek varsayım kullanılmadı."]} />
          <PanelList title="Uyarılar" items={result.warnings.length > 0 ? result.warnings : ["Aktif uyarı yok."]} />
        </div>
      </div>
    </GlassCard>
  );
}

function RiskMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/60">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PanelList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-container/55 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-soft">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
