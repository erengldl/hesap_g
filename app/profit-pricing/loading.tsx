import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import ModuleHero from "@/components/layout/ModuleHero";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="space-y-5">
      <ModuleHero
        eyebrow="Kârlılık"
        title="Kârlılık çalışma alanı"
        description="Fiyat Optimizasyonu ve Net Maliyet sekmeleri hazırlanıyor."
        badges={["Kanal kıyası", "Fiyat eğrisi", "Maliyet analizi"]}
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
