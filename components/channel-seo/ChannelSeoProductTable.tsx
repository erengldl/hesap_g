"use client";

import { ChevronLeft, ChevronRight, CheckSquare, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SalesChannel } from "@/lib/channel-seo/types";
import { ChannelSeoProductRow, type ChannelSeoProductRowModel } from "./ChannelSeoProductRow";
import { ChannelSeoStatusBadge } from "./ChannelSeoStatusBadge";
import { ChannelSeoEditableTitle } from "./ChannelSeoEditableTitle";
import { ChannelSeoEditableDescription } from "./ChannelSeoEditableDescription";

export type ChannelSeoProductTableProps = {
  rows: ChannelSeoProductRowModel[];
  channelOptions: Array<{ id: SalesChannel; label: string }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onToggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
};

export function ChannelSeoProductTable({
  rows,
  channelOptions,
  page,
  pageSize,
  total,
  totalPages,
  loading = false,
  onNextPage,
  onPreviousPage,
  onToggleAll,
  allSelected,
  someSelected,
}: ChannelSeoProductTableProps) {
  return (
    <div className="rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün listesi</p>
          <p className="mt-1 text-sm text-muted">{total} ürün · {pageSize} / sayfa</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <button
            type="button"
            onClick={onToggleAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2.5 py-1.5 font-semibold text-muted transition-colors duration-200 hover:text-foreground"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
            Sayfadakileri seç
          </button>
          <span className={cn("rounded-full border px-2.5 py-1", someSelected ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-surface-container")}>
            {someSelected ? "Kısmi seçim" : "Seçim yok"}
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="data-table min-w-[1600px]">
          <thead>
            <tr>
              <th className="w-[48px] px-4 py-3">Seçim</th>
              <th className="w-[70px] px-3 py-3">Görsel</th>
              <th className="px-3 py-3">Ürün</th>
              <th className="w-[220px] px-3 py-3">Kategori</th>
              <th className="w-[220px] px-3 py-3">Kanal</th>
              <th className="min-w-[280px] px-3 py-3">Başlık</th>
              <th className="min-w-[360px] px-3 py-3">Açıklama</th>
              <th className="w-[170px] px-3 py-3">Durum</th>
              <th className="w-[140px] px-3 py-3">Optimize</th>
              <th className="w-[220px] px-3 py-3">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ChannelSeoProductRow
                key={`${row.product.id}:${row.activeChannel}`}
                {...row}
                channelOptions={channelOptions}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {rows.map((row) => (
          <div key={`${row.product.id}:${row.activeChannel}`} className={cn("rounded-xl border border-border bg-background/40 p-4", row.selected ? "border-primary/25 bg-primary/5" : "")}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={row.onToggleSelect}
                className="mt-1 h-4 w-4 rounded border-border bg-surface-container text-primary"
                aria-label={`${row.product.name} seç`}
              />
              <div className="h-11 w-11 overflow-hidden rounded-lg border border-border bg-surface-container">
                {row.product.imageUrl ? (
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${row.product.imageUrl})` }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted">{row.product.name.slice(0, 2).toUpperCase()}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{row.product.name}</p>
                <p className="mt-1 text-[10px] text-muted">{row.product.category ?? "Kategorisiz"} · {row.activeChannelLabel}</p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <ChannelSeoEditableTitle value={row.content.title} onChange={row.onTitleChange} compact ariaLabel={`${row.product.name} başlık`} />
              <ChannelSeoEditableDescription value={row.content.description} onChange={row.onDescriptionChange} compact ariaLabel={`${row.product.name} açıklama`} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <ChannelSeoStatusBadge status={row.content.status} generatedBy={row.content.generatedBy} dirty={row.dirty} />
              <span className="text-[10px] text-muted">Yerel skor: {row.localScore ?? "—"}</span>
            </div>
            {row.rowError ? <p className="mt-2 text-xs text-danger">{row.rowError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={row.onOptimize} disabled={row.loadingOptimize} className="btn-primary px-3 py-2 text-[10px]">
                Optimize Et
              </button>
              <button type="button" onClick={row.onSave} disabled={row.loadingSave} className="btn-secondary px-3 py-2 text-[10px]">
                Kaydet
              </button>
              <button type="button" onClick={row.onPreview} className="btn-secondary px-3 py-2 text-[10px]">
                Önizle
              </button>
              <button type="button" onClick={row.onRevert} className="btn-secondary px-3 py-2 text-[10px]">
                Geri Al
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Önceki
        </button>
        <p className="text-xs text-muted">
          Sayfa {page} / {totalPages || 1}
        </p>
        <button
          type="button"
          onClick={onNextPage}
          disabled={page >= totalPages || loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sonraki
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
