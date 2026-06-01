"use client";

import { GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingState() {
  return (
    <div className="flex w-full flex-col gap-4">
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[300px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[260px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[360px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[140px]" />
      </GlassCard>
    </div>
  );
}
