"use client";

import { ClipboardCopy, Globe, Loader2, RefreshCw, Save, Tag, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChannelSeoContent, ChannelSeoProduct, SalesChannel } from "@/lib/channel-seo/types";
import { ChannelSeoEditableDescription } from "./ChannelSeoEditableDescription";
import { ChannelSeoEditableTitle } from "./ChannelSeoEditableTitle";
import { ChannelSeoPreviewPanel } from "./ChannelSeoPreviewPanel";
import { ChannelSeoStatusBadge } from "./ChannelSeoStatusBadge";

type ChannelSeoProductDrawerProps = {
  product: ChannelSeoProduct | null;
  content: ChannelSeoContent | null;
  activeChannel: SalesChannel;
  activeChannelLabel: string;
  channelOptions: Array<{ id: SalesChannel; label: string }>;
  dirty: boolean;
  localScore: number | null;
  qualityWarnings: string[];
  rowError?: string | null;
  optimizing?: boolean;
  saving?: boolean;
  onClose?: () => void;
  onChannelChange: (channel: SalesChannel) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOptimize: () => void;
  onSave: () => void;
  onCopy: () => void;
  onRevert: () => void;
  className?: string;
};

function createCopyText(product: ChannelSeoProduct | null, content: ChannelSeoContent | null) {
  if (!product || !content) {
    return "";
  }

  return [
    `Ürün: ${product.name}`,
    `Ürün açıklaması: ${formatDescriptionText(product.baseDescription)}`,
    `Kanal: ${content.channel}`,
    `Başlık: ${content.title}`,
    `Kanal açıklaması: ${content.description}`,
  ].join("\n");
}

function formatDescriptionText(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : "Bilgi yok";
}

export function ChannelSeoProductDrawer({
  product,
  content,
  activeChannel,
  activeChannelLabel,
  channelOptions,
  dirty,
  localScore,
  qualityWarnings,
  rowError,
  optimizing = false,
  saving = false,
  onClose,
  onChannelChange,
  onTitleChange,
  onDescriptionChange,
  onOptimize,
  onSave,
  onCopy,
  onRevert,
  className,
}: ChannelSeoProductDrawerProps) {
  if (!product || !content) {
    return null;
  }

  return (
    <aside className={cn("rounded-xl border border-border bg-panel p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Ürün detay</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{product.name}</h3>
          <p className="mt-1 text-xs text-muted">{product.category ?? "Kategorisiz"} · {activeChannelLabel}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-container text-muted transition-colors duration-200 hover:text-foreground"
            aria-label="Detay panelini kapat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-container/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Marka</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{product.brand ?? "Bilgi yok"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-container/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">SKU / Barkod</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{product.sku ?? product.barcode ?? "Bilgi yok"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-container/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Fiyat</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{typeof product.price === "number" ? product.price.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }) : "Bilgi yok"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-container/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Stok</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{typeof product.stock === "number" ? product.stock.toLocaleString("tr-TR") : "Bilgi yok"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-background/35 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Ürün açıklaması</p>
          <span className="rounded-full border border-border bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-muted">
            Kaynak
          </span>
        </div>
        <div className="mt-2 max-h-36 overflow-auto rounded-md border border-border/70 bg-surface-container/30 p-3">
          <p className={cn("whitespace-pre-wrap text-sm leading-6", product.baseDescription ? "text-soft" : "italic text-muted")}>
            {formatDescriptionText(product.baseDescription)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="form-label">Satış kanalı</span>
          <select
            value={activeChannel}
            onChange={(event) => onChannelChange(event.target.value as SalesChannel)}
            className="form-select w-full rounded-md border border-border bg-surface-container text-sm text-foreground"
          >
            {channelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <ChannelSeoEditableTitle value={content.title} onChange={onTitleChange} />
        <ChannelSeoEditableDescription value={content.description} onChange={onDescriptionChange} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChannelSeoStatusBadge status={content.status} generatedBy={content.generatedBy} dirty={dirty} />
        <span className="inline-flex items-center rounded-full border border-border bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-muted">
          Yerel skor: {localScore ?? "—"}
        </span>
      </div>

      {rowError ? (
        <div className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {rowError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOptimize}
          disabled={optimizing}
          className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          SEO Odaklı Optimize Et
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3.5 py-2 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Kaydet
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-3.5 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:text-foreground"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Kopyala
        </button>
        <button
          type="button"
          onClick={onRevert}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-3.5 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Geri Al
        </button>
      </div>

      <ChannelSeoPreviewPanel
        className="mt-4"
        product={product}
        content={content}
        localScore={localScore}
        qualityWarnings={qualityWarnings}
        onCopy={() => onCopy()}
      />

      <div className="mt-4 rounded-lg border border-border bg-background/35 p-3 text-xs text-muted">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Tag className="h-3.5 w-3.5 text-primary" />
          Kayıt notu
        </div>
        <p className="mt-2 leading-6">
          {createCopyText(product, content) || "Seçili ürün için içerik oluşturuluyor."}
        </p>
      </div>
    </aside>
  );
}
