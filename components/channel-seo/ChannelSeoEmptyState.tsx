"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";

type ChannelSeoEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  onResetFilters?: () => void;
  className?: string;
};

export function ChannelSeoEmptyState({ title, description, action, onResetFilters, className }: ChannelSeoEmptyStateProps) {
  return (
    <EmptyState
      icon={Search}
      title={title}
      description={description}
      variant="inline"
      className={cn("mx-auto max-w-md", className)}
      action={
        action ??
        (onResetFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center rounded-md border border-border bg-surface-container px-3.5 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:text-primary"
          >
            Filtreleri temizle
          </button>
        ) : null)
      }
    />
  );
}
