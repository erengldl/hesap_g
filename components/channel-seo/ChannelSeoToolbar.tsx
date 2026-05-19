"use client";

import { Filter, Search, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SalesChannel, ChannelSeoStatus } from "@/lib/channel-seo/types";

export type ChannelSeoCategoryOption = { value: string; label: string };
export type ChannelSeoChannelOption = { id: SalesChannel; label: string };

type ChannelSeoToolbarProps = {
  title: string;
  description: string;
  query: string;
  onQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  status: ChannelSeoStatus | "all";
  onStatusChange: (value: ChannelSeoStatus | "all") => void;
  selectedChannel: SalesChannel;
  onChannelChange: (value: SalesChannel) => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  categories: ChannelSeoCategoryOption[];
  channels: ChannelSeoChannelOption[];
  selectedCount: number;
  dirtyCount: number;
  totalCount: number;
  loading?: boolean;
  className?: string;
};

export function ChannelSeoToolbar({
  title,
  description,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  selectedChannel,
  onChannelChange,
  pageSize,
  onPageSizeChange,
  categories,
  channels,
  selectedCount,
  dirtyCount,
  totalCount,
  loading = false,
  className,
}: ChannelSeoToolbarProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-panel p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Package className="h-3.5 w-3.5" />
            SEO
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.8rem]">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-muted">
            <span className="rounded-full border border-border bg-surface-container px-2.5 py-1">Seçili: {selectedCount}</span>
            <span className="rounded-full border border-border bg-surface-container px-2.5 py-1">Taslak: {dirtyCount}</span>
            <span className="rounded-full border border-border bg-surface-container px-2.5 py-1">Toplam: {totalCount}</span>
            <span className="rounded-full border border-border bg-surface-container px-2.5 py-1">Kanal: {channels.find((item) => item.id === selectedChannel)?.label ?? selectedChannel}</span>
          </div>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:min-w-[320px] lg:max-w-[420px]">
          <label className="relative">
            <span className="sr-only">Ürün ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Ürün, SKU, barkod ara"
              className="form-input w-full rounded-md border border-border bg-surface-container pl-10 pr-3 text-sm text-foreground placeholder:text-muted/60"
              disabled={loading}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedChannel}
              onChange={(event) => onChannelChange(event.target.value as SalesChannel)}
              className="form-select w-full rounded-md border border-border bg-surface-container text-sm text-foreground"
              disabled={loading}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as ChannelSeoStatus | "all")}
              className="form-select w-full rounded-md border border-border bg-surface-container text-sm text-foreground"
              disabled={loading}
            >
              <option value="all">Tüm durumlar</option>
              <option value="not_optimized">Optimize edilmemiş</option>
              <option value="draft">Taslak</option>
              <option value="optimized">Optimize edilmiş</option>
              <option value="needs_update">Güncelleme gerekli</option>
              <option value="error">İşlenemedi</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="form-select w-full rounded-md border border-border bg-surface-container text-sm text-foreground"
              disabled={loading}
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="form-select w-full rounded-md border border-border bg-surface-container text-sm text-foreground"
              disabled={loading}
            >
              <option value={25}>25 / sayfa</option>
              <option value={50}>50 / sayfa</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        <Filter className="h-3.5 w-3.5" />
        Arama ve filtreler sunucudan uygulanır. Kanal bazlı içerik seçili kanala göre görüntülenir.
      </div>
    </div>
  );
}
