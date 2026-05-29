import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Kârlılık"
        title="Fiyat Optimizasyonu"
        description="Fiyat ve marj verileri hazırlanıyor."
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
