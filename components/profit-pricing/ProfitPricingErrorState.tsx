"use client";

import { TriangleAlert } from "lucide-react";

import { ErrorStateCard } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingErrorState({ message }: { message: string }) {
  return (
    <ErrorStateCard
      title="Kârlılık hesaplanamadı."
      description={message}
      icon={TriangleAlert}
    />
  );
}
