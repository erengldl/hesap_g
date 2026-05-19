"use client";

import { RotateCw } from "lucide-react";

import { ErrorStateCard } from "@/components/ui-custom/GlassComponents";

type ChannelSeoErrorPanelProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ChannelSeoErrorPanel({
  title = "SEO işlemi tamamlanamadı",
  message,
  onRetry,
  className,
}: ChannelSeoErrorPanelProps) {
  return (
    <ErrorStateCard
      title={title}
      description={message}
      className={className}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Tekrar dene
          </button>
        ) : null
      }
    />
  );
}
