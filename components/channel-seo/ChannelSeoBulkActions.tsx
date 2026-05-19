"use client";

import { Wand2, Save, Trash2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type ChannelSeoBulkActionsProps = {
  selectedCount: number;
  dirtyCount: number;
  totalCount: number;
  onOptimizeSelected: () => void;
  onOptimizeAll: () => void;
  onSaveSelected: () => void;
  onClear: () => void;
  optimizeDisabled?: boolean;
  saveDisabled?: boolean;
  className?: string;
};

export function ChannelSeoBulkActions({
  selectedCount,
  dirtyCount,
  totalCount,
  onOptimizeSelected,
  onOptimizeAll,
  onSaveSelected,
  onClear,
  optimizeDisabled = false,
  saveDisabled = false,
  className,
}: ChannelSeoBulkActionsProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-panel p-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Toplu işlemler</p>
          <h3 className="text-sm font-semibold text-foreground">Seçim ve taslak durumu</h3>
          <p className="text-xs text-muted">
            {selectedCount > 0 ? `${selectedCount} ürün seçili` : "Ürün seçilmedi"} · {dirtyCount} kaydedilmemiş içerik · {totalCount} ürün yüklü
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOptimizeSelected}
            disabled={optimizeDisabled || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Seçilenleri Optimize Et
          </button>
          <button
            type="button"
            onClick={onOptimizeAll}
            disabled={optimizeDisabled || totalCount === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-3.5 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-background/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Tümünü SEO Odaklı Optimize Et
          </button>
          <button
            type="button"
            onClick={onSaveSelected}
            disabled={saveDisabled || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3.5 py-2 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Seçilenleri Kaydet
          </button>
          <button
            type="button"
            onClick={onClear}
            className="action-inline-button-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Değişiklikleri Temizle
          </button>
        </div>
      </div>
    </div>
  );
}
