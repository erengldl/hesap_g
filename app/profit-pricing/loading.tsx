import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Kârlılık"
        title="Kârlılık çalışma alanı"
        description="Fiyat Optimizasyonu ve Net Maliyet sekmeleri hazırlanıyor."
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
