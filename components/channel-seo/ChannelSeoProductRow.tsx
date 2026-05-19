"use client";

import Link from "next/link";
import { ArrowRight, Eye, RotateCcw, Save, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChannelSeoEditableDescription } from "./ChannelSeoEditableDescription";
import { ChannelSeoEditableTitle } from "./ChannelSeoEditableTitle";
import { ChannelSeoStatusBadge } from "./ChannelSeoStatusBadge";
import type { ChannelSeoContent, ChannelSeoProduct, SalesChannel } from "@/lib/channel-seo/types";

export type ChannelSeoProductRowModel = {
  product: ChannelSeoProduct;
  content: ChannelSeoContent;
  activeChannel: SalesChannel;
  activeChannelLabel: string;
  selected: boolean;
  dirty: boolean;
  localScore: number | null;
  qualityWarnings: string[];
  rowError?: string | null;
  loadingOptimize?: boolean;
  loadingSave?: boolean;
  onToggleSelect: () => void;
  onChannelChange: (channel: SalesChannel) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOptimize: () => void;
  onSave: () => void;
  onPreview: () => void;
  onRevert: () => void;
  onRetry?: () => void;
};

type ChannelSeoProductRowProps = ChannelSeoProductRowModel & {
  channelOptions: Array<{ id: SalesChannel; label: string }>;
};

function formatOptimizedAt(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ChannelSeoProductRow({
  product,
  content,
  activeChannel,
  activeChannelLabel,
  selected,
  dirty,
  localScore,
  qualityWarnings,
  rowError,
  loadingOptimize = false,
  loadingSave = false,
  onToggleSelect,
  onChannelChange,
  onTitleChange,
  onDescriptionChange,
  onOptimize,
  onSave,
  onPreview,
  onRevert,
  onRetry,
  channelOptions,
}: ChannelSeoProductRowProps) {
  return (
    <tr className={cn("group border-b border-border/30 transition-colors duration-200 hover:bg-background/30", selected ? "bg-primary/5" : "")}>
      <td className="px-3 py-3 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`${product.name} seç`}
          className="h-4 w-4 rounded border-border bg-surface-container text-primary focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="h-11 w-11 overflow-hidden rounded-lg border border-border bg-surface-container">
          {product.imageUrl ? (
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${product.imageUrl})` }} aria-label={product.name} role="img" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted">{product.name.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <Link href={`/products/${product.id}`} className="text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary">
              {product.name}
            </Link>
            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>
          {qualityWarnings.length > 0 ? (
            <p className="text-[10px] text-warning">{qualityWarnings[0]}</p>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm text-muted">{product.category ?? "Kategorisiz"}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <select
          value={activeChannel}
          onChange={(event) => onChannelChange(event.target.value as SalesChannel)}
          className="form-select w-full min-w-[140px] rounded-md border border-border bg-surface-container text-sm text-foreground"
        >
          {channelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-muted">{activeChannelLabel}</p>
      </td>
      <td className="px-3 py-3 align-top min-w-[280px]">
        <ChannelSeoEditableTitle
          value={content.title}
          onChange={onTitleChange}
          compact
          ariaLabel={`${product.name} başlık`}
        />
      </td>
      <td className="px-3 py-3 align-top min-w-[340px]">
        <ChannelSeoEditableDescription
          value={content.description}
          onChange={onDescriptionChange}
          compact
          ariaLabel={`${product.name} açıklama`}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <ChannelSeoStatusBadge status={content.status} generatedBy={content.generatedBy} dirty={dirty} />
        {rowError ? <p className="mt-2 text-[10px] text-danger">{rowError}</p> : null}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1 text-sm">
          <p className="text-muted">{formatOptimizedAt(content.optimizedAt ?? content.updatedAt)}</p>
          <p className="text-[10px] text-muted">Yerel skor: {localScore ?? "—"}</p>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onOptimize}
            disabled={loadingOptimize}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-2 text-[10px] font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" />
            SEO Odaklı Optimize Et
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={loadingSave}
            className="inline-flex items-center gap-1.5 rounded-md border border-success/20 bg-success/10 px-2.5 py-2 text-[10px] font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Kaydet
          </button>
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2.5 py-2 text-[10px] font-semibold text-muted transition-colors duration-200 hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            Önizle
          </button>
          <button
            type="button"
            onClick={onRevert}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2.5 py-2 text-[10px] font-semibold text-muted transition-colors duration-200 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Geri Al
          </button>
          {rowError && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/20 bg-danger/10 px-2.5 py-2 text-[10px] font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              Tekrar Dene
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
