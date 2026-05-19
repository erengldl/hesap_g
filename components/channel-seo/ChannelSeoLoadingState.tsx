"use client";

import { cn } from "@/lib/utils";
import { GlassCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";

type ChannelSeoLoadingStateProps = {
  className?: string;
};

export function ChannelSeoLoadingState({ className }: ChannelSeoLoadingStateProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <GlassCard className="space-y-4 border-border/70">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} variant="card" height={40} delayIndex={index} />
          ))}
        </div>
        <SkeletonCard variant="card" height={72} delayIndex={5} />
      </GlassCard>

      <GlassCard className="space-y-3 border-border/70">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <SkeletonCard variant="text-line" height={14} className="w-40" />
          <SkeletonCard variant="text-line" height={14} className="w-28" />
          <SkeletonCard variant="text-line" height={14} className="w-24" />
        </div>
        <SkeletonTable rows={6} />
      </GlassCard>
    </div>
  );
}
