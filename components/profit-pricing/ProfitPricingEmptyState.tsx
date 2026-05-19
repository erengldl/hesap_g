"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingEmptyState() {
  return (
    <EmptyState
      icon={PackageSearch}
      title="Henüz ürün seçilmedi."
      description="Kârlılık analizi için bir ürün seç. Sistem gerçek maliyeti hesaplayarak önerilen fiyat aralığını gösterecek."
      action={
        <Link href="/veri-merkezi" className="btn-primary">
          Veri Merkezini Aç
        </Link>
      }
    />
  );
}
