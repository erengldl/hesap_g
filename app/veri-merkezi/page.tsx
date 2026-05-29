"use client";

import ModuleHero from "@/components/layout/ModuleHero";
import { DataCenterTabs } from "@/components/data-center/DataCenterTabs";

export default function DataCenterPage() {
  return (
    <div className="space-y-5">
      <ModuleHero
        eyebrow="Operasyon Merkezi"
        title="Veri Merkezi"
        description="Ürünleri, satış geçmişini ve temel ayarları tek akışta yönetin. Toplu işlemler arka planda senkron kalır."
        badges={["Ürün kayıtları", "Satış geçmişi", "Mağaza ayarları"]}
        actions={[
          { href: "/dashboard", label: "Anasayfaya dön" },
          { href: "/net-maliyet-motoru", label: "Net maliyete geç", variant: "primary" },
        ]}
      />

      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
        <DataCenterTabs />
      </section>
    </div>
  );
}
