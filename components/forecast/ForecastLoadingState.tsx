"use client";

import { GlassCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";

export default function ForecastLoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("page-shell space-y-6", className)}>
      <div className="space-y-4">
        <SkeletonCard variant="text-line" height={12} className="w-24" />
        <SkeletonCard variant="text-line" height={28} className="w-72" />
        <SkeletonCard variant="text-line" height={14} className="w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} variant="card" height={104} delayIndex={index} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <GlassCard className="space-y-4 border-border/70">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={index} variant="text-line" height={28} className="w-28" delayIndex={index} />
              ))}
            </div>
            <SkeletonCard variant="card" height={370} delayIndex={3} />
          </GlassCard>

          <GlassCard className="space-y-3 border-border/70">
            <SkeletonCard variant="text-line" height={14} className="w-40" />
            <SkeletonTable rows={5} />
          </GlassCard>
        </div>

        <GlassCard className="space-y-4 border-border/70">
          <SkeletonCard variant="text-line" height={14} className="w-32" />
          <SkeletonCard variant="card" height={64} />
          <SkeletonCard variant="card" height={220} />
          <SkeletonCard variant="card" height={44} />
        </GlassCard>
      </div>
    </div>
  );
}
