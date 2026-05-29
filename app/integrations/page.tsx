import { MarketplaceIntegrationPanel } from "@/components/integrations/MarketplaceIntegrationPanel";
import ModuleHero from "@/components/layout/ModuleHero";

export default function IntegrationsPage() {
  return (
    <div className="space-y-5">
      <ModuleHero
        eyebrow="Bağlantılar"
        title="Entegrasyonlar"
        description="Pazar yeri, veri ve servis bağlantılarını tek panelde yönet. Kimlik bilgisi, senkron durumu ve katalog akışı aynı yerde görünür."
        badges={["Pazar yerleri", "Kimlik bilgileri", "Senkron durumları"]}
        actions={[
          { href: "/veri-merkezi", label: "Veri merkezine git" },
          { href: "/dashboard", label: "Kontrol merkezine dön", variant: "primary" },
        ]}
      />

      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
        <MarketplaceIntegrationPanel />
      </section>
    </div>
  );
}
