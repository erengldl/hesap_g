"use client";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency, formatProfitPricingPercent } from "@/lib/profit-pricing/formatters";
import type { ProfitPricingResult } from "@/lib/profit-pricing/types";

export default function ProfitMetricStrip({ result }: { result: ProfitPricingResult }) {
  const currentScenario = result.priceScenarios.find((scenario) => scenario.key === "current");
  const stripItems: Array<{
    label: string;
    value: string;
    helper: string;
    accent?: boolean;
  }> = [
    {
      label: "Satış Fiyatı",
      value: formatProfitPricingCurrency(result.input.salePrice),
      helper: "Mevcut kanal fiyatı",
    },
    {
      label: "Net Maliyet",
      value: formatProfitPricingCurrency(result.netCost),
      helper: "Tüm değişken maliyetler dahil",
    },
    {
      label: "Net Kâr",
      value: formatProfitPricingCurrency(result.netProfit),
      helper:
        currentScenario?.returnRiskCost && currentScenario.returnRiskCost > 0
          ? `İade/fire etkisi ${formatProfitPricingCurrency(-currentScenario.returnRiskCost)}`
          : "Risk maliyeti etkisi düşük",
      accent: result.netProfit >= 0,
    },
    {
      label: "Kâr Marjı",
      value: formatProfitPricingPercent(result.profitMargin),
      helper: result.decision === "profitable" ? "Sağlıklı bant" : decisionHint(result.decision),
      accent: (result.profitMargin ?? 0) >= 0.1,
    },
    {
      label: "Başabaş",
      value: formatProfitPricingCurrency(result.breakEvenPrice),
      helper: "Bu seviyenin altı zarar",
    },
    {
      label: "Max CPA",
      value: formatProfitPricingCurrency(result.maxProfitableAdCost),
      helper: "Bu limit üstünde sipariş zarar yazar",
    },
    {
      label: "Önerilen",
      value: result.recommendedPriceRange
        ? formatProfitPricingCurrency(result.recommendedPriceRange.preferred)
        : "Veri eksik",
      helper: result.recommendedPriceRange
        ? result.input.buyboxPrice !== undefined && result.input.buyboxPrice > 0
          ? `Buybox ${formatProfitPricingCurrency(result.input.buyboxPrice)} · ${formatProfitPricingCurrency(result.recommendedPriceRange.min)} - ${formatProfitPricingCurrency(result.recommendedPriceRange.max)}`
          : `${formatProfitPricingCurrency(result.recommendedPriceRange.min)} - ${formatProfitPricingCurrency(result.recommendedPriceRange.max)}`
        : "Aralık üretilemedi",
      accent: true,
    },
    {
      label: "Veri Güveni",
      value: result.dataQuality === "high" ? "Yüksek" : result.dataQuality === "medium" ? "Orta" : "Düşük",
      helper:
        result.missingFields.length > 0
          ? `${result.missingFields.length} alan eksik`
          : result.warnings.length > 0
            ? `${result.warnings.length} aktif uyarı`
            : "Ana veri seti tamam",
    },
  ];

  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
          Karar metrikleri
        </p>
      </div>
      <div className="flex flex-col">
        {stripItems.map((item) => (
          <div
            key={item.label}
            className="border-b border-border/50 px-4 py-3 last:border-b-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">{item.label}</p>
            <p
              className={`mt-2 whitespace-nowrap text-sm font-semibold tracking-tight ${
                item.accent ? "text-primary" : "text-foreground"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted/60">{item.helper}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function decisionHint(decision: ProfitPricingResult["decision"]) {
  switch (decision) {
    case "loss":
      return "Zarar baskısı yüksek";
    case "borderline":
      return "Sınırda bant";
    case "profitable_but_low_margin":
      return "Kırılgan ama pozitif";
    case "missing_data":
      return "Veri eksik";
    default:
      return "Takip edilmeli";
  }
}
