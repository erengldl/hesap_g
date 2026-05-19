"use client";

import { Copy, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChannelSeoContent, ChannelSeoProduct } from "@/lib/channel-seo/types";

type ChannelSeoPreviewPanelProps = {
  product: ChannelSeoProduct;
  content: ChannelSeoContent;
  localScore: number | null;
  qualityWarnings: string[];
  onCopy?: () => void;
  className?: string;
};

function formatGeneratedBy(value?: ChannelSeoContent["generatedBy"]) {
  if (value === "gemini") return "Gemini";
  if (value === "fallback") return "Fallback";
  return "Manuel";
}

export function ChannelSeoPreviewPanel({
  product,
  content,
  localScore,
  qualityWarnings,
  onCopy,
  className,
}: ChannelSeoPreviewPanelProps) {
  const keywords = content.keywords ?? [];
  const warnings = Array.from(new Set([...(content.warnings ?? []), ...qualityWarnings]));
  const notes = content.notes ?? [];

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-surface-container/40 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Gemini önerisi</p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">Önizleme ve kalite notları</h4>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-container px-2.5 py-1.5 text-[10px] font-semibold text-muted transition-colors duration-200 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopyala
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">SEO skoru</p>
          <p className="mt-1 text-2xl font-extrabold text-foreground">{content.seoScore ?? "—"}</p>
          <p className="mt-1 text-[10px] text-muted">Yerel doğrulama: {localScore ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Kaynak</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatGeneratedBy(content.generatedBy)}</p>
          <p className="mt-1 text-[10px] text-muted">{content.model ?? "Model bilgisi yok"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/35 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Başlık</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{content.title}</p>
      </div>

      <div className="rounded-lg border border-border bg-background/35 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Açıklama</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-soft">{content.description}</p>
      </div>

      {keywords.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Anahtar kelimeler
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span key={keyword} className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[10px] font-semibold text-muted">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">
            <ShieldAlert className="h-3.5 w-3.5" />
            Uyarılar
          </div>
          <ul className="space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 rounded-md border border-warning/15 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-info">
            <Lightbulb className="h-3.5 w-3.5" />
            Notlar
          </div>
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li key={note} className="rounded-md border border-info/15 bg-info/10 px-2.5 py-2 text-xs text-info">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 text-[10px] text-muted sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/35 p-3">
          <p className="uppercase tracking-[0.18em]">Ürün</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{product.name}</p>
          <p className="mt-1">{product.category ?? "Kategorisiz"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/35 p-3">
          <p className="uppercase tracking-[0.18em]">Bilgi durumu</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {qualityWarnings.length > 0 ? `${qualityWarnings.length} uyarı` : "Veri yeterli"}
          </p>
          <p className="mt-1">{qualityWarnings.length > 0 ? qualityWarnings[0] : "Bu ürün için güvenli içerik üretilebilir."}</p>
        </div>
      </div>
    </div>
  );
}
