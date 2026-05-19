"use client";

import { cn } from "@/lib/utils";
import type { ChannelSeoGeneratedBy, ChannelSeoStatus } from "@/lib/channel-seo/types";

const STATUS_LABELS: Record<ChannelSeoStatus, string> = {
  not_optimized: "Optimize edilmedi",
  draft: "Taslak",
  optimized: "Optimize edildi",
  needs_update: "Güncelleme gerekli",
  error: "İşlenemedi",
};

const STATUS_TONES: Record<ChannelSeoStatus, string> = {
  not_optimized: "border-border bg-surface-container text-muted",
  draft: "border-warning/20 bg-warning/10 text-warning",
  optimized: "border-success/20 bg-success/10 text-success",
  needs_update: "border-info/20 bg-info/10 text-info",
  error: "border-danger/20 bg-danger/10 text-danger",
};

const SOURCE_LABELS: Record<ChannelSeoGeneratedBy, string> = {
  manual: "Manuel",
  gemini: "Gemini",
  fallback: "Fallback",
};

type ChannelSeoStatusBadgeProps = {
  status: ChannelSeoStatus;
  generatedBy?: ChannelSeoGeneratedBy;
  dirty?: boolean;
  className?: string;
};

export function ChannelSeoStatusBadge({ status, generatedBy, dirty = false, className }: ChannelSeoStatusBadgeProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]",
          STATUS_TONES[status]
        )}
      >
        {STATUS_LABELS[status]}
      </span>
      {generatedBy ? (
        <span className="inline-flex items-center rounded-full border border-border bg-surface-container px-2 py-1 text-[10px] font-semibold text-muted">
          {SOURCE_LABELS[generatedBy]}
        </span>
      ) : null}
      {dirty ? (
        <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">
          Kaydedilmedi
        </span>
      ) : null}
    </div>
  );
}
