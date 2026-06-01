"use client";

import { PageHeader } from "@/components/ui-custom/GlassComponents";
import { DataCenterTabs } from "@/components/data-center/DataCenterTabs";

export default function DataCenterPage() {
  return (
    <div className="page-shell">
      <PageHeader
        title="Veri Merkezi"
        description="Ürünleri, satış geçmişini ve mağaza bilgilerini finans motoruyla senkron tutun."
      />

      <DataCenterTabs />
    </div>
  );
}
