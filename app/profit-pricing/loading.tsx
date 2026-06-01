import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="page-shell">
      <PageHeader
        title="Kârlılık ve Fiyat Optimizasyonu"
        description="Ürünü seç, kanal fiyatlarını kontrol et, en iyi fiyat stratejisini uygula."
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
