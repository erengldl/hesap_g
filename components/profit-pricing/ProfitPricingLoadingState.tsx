"use client";

import { GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingState() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-4">
        <GlassCard className="border-border/80">
          <SkeletonCard className="h-[520px]" />
        </GlassCard>
        <div className="space-y-4">
          <SkeletonCard className="h-[240px]" />
          <SkeletonCard className="h-[128px]" />
        </div>
      </div>
      <SkeletonCard className="h-[240px]" />
      <SkeletonCard className="h-[300px]" />
    </div>
  );
}
