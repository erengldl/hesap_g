"use client";

import { PageHeader } from "@/components/ui-custom/GlassComponents";
import { DataCenterTabs } from "@/components/data-center/DataCenterTabs";

export default function DataCenterPage() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Operasyon Merkezi"
        title="Veri Merkezi"
        description="Ürünleri, satış geçmişini ve temel ayarları tek akışta yönetin. Toplu işlemler arka planda senkron kalır."
      />

      <DataCenterTabs />
    </div>
  );
}
