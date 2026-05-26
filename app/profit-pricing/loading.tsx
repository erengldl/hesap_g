import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Karar ekranı"
        title="Kârlılık ve Fiyat Optimizasyonu"
        description="Ürünün gerçek maliyetini hesapla, kârlı fiyat aralığını aynı ekranda gör."
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
