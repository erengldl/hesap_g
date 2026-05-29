import { MarketplaceIntegrationPanel } from "@/components/integrations/MarketplaceIntegrationPanel";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export default function IntegrationsPage() {
  return (
    <div className="page-shell">
      <PageHeader
        title="Bağlantılar"
        description="Entegrasyon ayarlarını yönet ve mevcut bağlantı yüzeylerine geç."
      />

      <MarketplaceIntegrationPanel />
    </div>
  );
}
