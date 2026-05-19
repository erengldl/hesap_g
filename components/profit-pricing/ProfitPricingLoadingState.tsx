"use client";

import { GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";

export default function ProfitPricingLoadingState() {
  return (
    <div className="flex w-full flex-col gap-4">
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[420px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[320px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[360px]" />
      </GlassCard>
      <GlassCard className="border-border/80">
        <SkeletonCard className="h-[360px]" />
      </GlassCard>
    </div>
  );
}
