import ProfitPricingLoadingState from "@/components/profit-pricing/ProfitPricingLoadingState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingRoute() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Karar ekrani"
        title="Karlilik ve Fiyat Optimizasyonu"
        description="Urunun gercek maliyetini hesapla, karli fiyat araligini ayni ekranda gor."
      />
      <ProfitPricingLoadingState />
    </div>
  );
}
