"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Smartphone,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { Product } from "@/lib/types";
import { EmptyState } from "@/components/ui-custom/GlassComponents";

interface ToastLike {
  text: string;
  type: "success" | "warning" | "error";
}

type ChannelSlug = "trendyol" | "hepsiburada" | "my_website";

type CarrierOption = {
  id: number;
  name: string;
};

type ProductDetailChannel = {
  channelName: string;
  slug: string;
  salePrice: number | null;
  buyboxPrice: number | null;
  shippingCompanyId: number | null;
  shipping: number | null;
  mode: string | null;
};

type ProductSalesHistoryRow = {
  order_id: number;
  order_date: string;
  marketplace_name: string;
  external_order_number: string | null;
  external_package_number: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string | null;
  merchant_sku: string | null;
  barcode: string | null;
};

type ProductSalesHistorySummary = {
  totalUnits: number;
  totalRevenue: number;
  activeDays: number;
  avgDailyUnits: number;
  peakDay: { date: string; units: number } | null;
};

type ProductSalesHistoryState = {
  summary: ProductSalesHistorySummary | null;
  orderHistory: ProductSalesHistoryRow[];
};

type ProductDetailResponse = {
  success?: boolean;
  product?: {
    id: number;
    name: string;
    sku?: string;
    barcode?: string;
    imageUrl?: string | null;
    categoryPath?: string | null;
    categoryName?: string | null;
    description?: string | null;
    cost: number;
    packagingCost: number;
    desi: number;
    status?: string | null;
    stock?: number | null;
  };
  channels?: ProductDetailChannel[];
  salesSummary30?: ProductSalesHistorySummary;
  orderHistory?: ProductSalesHistoryRow[];
};

type ChannelDraft = {
  enabled: boolean;
  title: string;
  salePrice: string;
  buyboxPrice: string;
  manualShippingCost: string;
  shippingCompanyId: string;
};

type PanelState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  carriers: Record<Exclude<ChannelSlug, "my_website">, CarrierOption[]>;
  drafts: Record<ChannelSlug, ChannelDraft>;
  salesHistory?: ProductSalesHistoryState | null;
};

interface ProductDataTableProps {
  products: Product[];
  onDelete?: (id: number) => void;
  onEdit?: (product: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onNotify?: (message: ToastLike) => void;
  onRefresh?: () => Promise<void> | void;
}

const CHANNELS = [
  { slug: "trendyol", label: "Trendyol", icon: Smartphone, marketplaceName: "Trendyol", seoChannel: "trendyol", carrierEnabled: true, badgeTone: "amber" },
  { slug: "hepsiburada", label: "Hepsiburada", icon: Store, marketplaceName: "Hepsiburada", seoChannel: "hepsiburada", carrierEnabled: true, badgeTone: "blue" },
  { slug: "my_website", label: "Kendi Websitem", icon: Globe, marketplaceName: null, seoChannel: "website", carrierEnabled: false, badgeTone: "emerald" },
] as const;

const FIELD_CLASS =
  "w-full rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-soft/80 disabled:cursor-not-allowed disabled:opacity-60";

const CONTROL_CLASS =
  "appearance-none rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2 text-xs text-muted outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-soft/80 focus:text-foreground";

const TABLE_CARD_CLASS =
  "overflow-hidden rounded-lg border border-border/70 bg-panel/60 shadow-[var(--shadow-card)]";

const PANEL_CARD_CLASS =
  "rounded-lg border border-border/70 bg-surface-container/55";

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-surface-container/70 px-2.5 py-1 text-[10px] font-semibold text-muted";

const CHANNEL_BADGE_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-200";

const CHANNEL_BADGE_TONES = {
  amber: "border-warning/20 bg-warning/10 text-warning hover:bg-warning/15",
  blue: "border-info/20 bg-info/10 text-info hover:bg-info/15",
  emerald: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
} as const;

function normalizeProductChannelSlug(value: string | null | undefined): ChannelSlug | null {
  if (value === "trendyol" || value === "hepsiburada" || value === "my_website") {
    return value;
  }

  if (value === "own_website" || value === "own-website" || value === "website") {
    return "my_website";
  }

  return null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function createFallbackDrafts(product: Product): Record<ChannelSlug, ChannelDraft> {
  return CHANNELS.reduce((acc, channel) => {
    const enabled = product.active_channels.includes(channel.slug);
    acc[channel.slug] = {
      enabled,
      title: product.name,
      salePrice: String(product.sale_price ?? 0),
      buyboxPrice: "",
      manualShippingCost: "",
      shippingCompanyId: "",
    };
    return acc;
  }, {} as Record<ChannelSlug, ChannelDraft>);
}

function buildDrafts(
  product: Product,
  detailChannels: ProductDetailChannel[],
  carriers: Record<Exclude<ChannelSlug, "my_website">, CarrierOption[]>
) {
  const detailMap = new Map<ChannelSlug, ProductDetailChannel>();
  for (const channel of detailChannels) {
    const slug = normalizeProductChannelSlug(channel.slug);
    if (slug) {
      detailMap.set(slug, channel);
    }
  }

  return CHANNELS.reduce((acc, channel) => {
    const detail = detailMap.get(channel.slug);
    const carrierOptions = channel.carrierEnabled
      ? carriers[channel.slug as Exclude<ChannelSlug, "my_website">] ?? []
      : [];
    const salePrice = normalizeNumber(detail?.salePrice ?? product.sale_price ?? 0);
    const shippingCompanyId =
      channel.carrierEnabled
        ? detail?.shippingCompanyId ?? carrierOptions[0]?.id ?? null
        : null;
    const buyboxPrice =
      detail?.buyboxPrice != null && Number.isFinite(detail.buyboxPrice)
        ? String(detail.buyboxPrice)
        : "";
    const manualShippingCost =
      detail?.shipping != null && Number.isFinite(detail.shipping)
        ? String(detail.shipping)
        : "";

    acc[channel.slug] = {
      enabled: product.active_channels.includes(channel.slug) || Boolean(detail),
      title: detail?.channelName ?? product.name,
      salePrice: String(salePrice),
      buyboxPrice,
      manualShippingCost,
      shippingCompanyId: shippingCompanyId != null ? String(shippingCompanyId) : "",
    };
    return acc;
  }, {} as Record<ChannelSlug, ChannelDraft>);
}

function ChannelEditorCard({
  channel,
  draft,
  carriers,
  disabled,
  onToggle,
  onChange,
}: {
  channel: typeof CHANNELS[number];
  draft: ChannelDraft;
  carriers: CarrierOption[];
  disabled?: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ChannelDraft>) => void;
}) {
  const Icon = channel.icon;
  const active = draft.enabled;
  const isWebsite = channel.slug === "my_website";

  return (
    <div
      className={cn(
        PANEL_CARD_CLASS,
        "p-4 transition-colors duration-200",
        active ? "border-primary/20 bg-primary/[0.04]" : "opacity-[0.88]"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-md border", active ? "border-primary/20 bg-primary/10 text-primary" : "border-border/70 bg-surface-container/70 text-muted")}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{channel.label}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              {active ? "Aktif kanal" : "Pasif kanal"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200 disabled:opacity-60",
            active ? "border-primary/20 bg-primary/10 text-primary" : "border-border/70 bg-surface-container/70 text-muted"
          )}
        >
          {active ? <Check className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {active ? "Kapat" : "Aç"}
        </button>
      </div>

      <div
        className={cn(
          "mt-4 grid gap-3",
          channel.carrierEnabled ? "lg:grid-cols-3" : "lg:grid-cols-2"
        )}
      >
        <label className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
            Satış fiyatı
          </span>
          <input
            type="number"
            step="0.01"
            value={draft.salePrice}
            onChange={(event) => onChange({ salePrice: event.target.value })}
            disabled={disabled || !active}
            className={FIELD_CLASS}
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
            {isWebsite ? "Kargo fiyatı" : "Buybox fiyatı"}
          </span>
          <input
            type="number"
            step="0.01"
            value={isWebsite ? draft.manualShippingCost : draft.buyboxPrice}
            onChange={(event) =>
              onChange(
                isWebsite
                  ? { manualShippingCost: event.target.value }
                  : { buyboxPrice: event.target.value }
              )
            }
            disabled={disabled || !active}
            className={FIELD_CLASS}
          />
        </label>

        {channel.carrierEnabled ? (
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              <Truck className="h-3.5 w-3.5" />
              Kargo firması
            </span>
            <select
              value={draft.shippingCompanyId}
              onChange={(event) => onChange({ shippingCompanyId: event.target.value })}
              disabled={disabled || !active || carriers.length === 0}
              className={`${FIELD_CLASS} appearance-none`}
            >
              {carriers.length === 0 ? (
                <option value="">Kargo firmaları yükleniyor...</option>
              ) : (
                carriers.map((carrier) => (
                  <option key={carrier.id} value={String(carrier.id)}>
                    {carrier.name}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : (
          null
        )}

      </div>
    </div>
  );
}

function orderStatusCopy(status?: string | null) {
  switch (status) {
    case "completed":
      return { label: "Tamamlandı", className: "border-primary/20 bg-primary/10 text-primary" };
    case "processing":
      return { label: "İşleniyor", className: "border-warning/20 bg-warning/10 text-warning" };
    case "pending":
      return { label: "Bekliyor", className: "border-info/20 bg-info/10 text-info" };
    case "returned":
      return { label: "İade", className: "border-danger/20 bg-danger/10 text-danger" };
    case "cancelled":
      return { label: "İptal", className: "border-zinc-500/20 bg-zinc-500/10 text-muted" };
    default:
      return { label: "Bilinmiyor", className: "border-border/70 bg-surface-container/70 text-muted" };
  }
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-container/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SalesHistoryPreview({
  productId,
  salesHistory,
}: {
  productId: number;
  salesHistory?: ProductSalesHistoryState | null;
}) {
  const summary = salesHistory?.summary ?? null;
  const orderHistory = salesHistory?.orderHistory ?? [];
  const recentOrders = orderHistory.slice(0, 5);

  return (
    <div className="space-y-4 rounded-lg border border-border/70 bg-surface-container/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">Satış geçmişi</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">Son satışlar</h3>
          <p className="mt-1 text-sm text-muted">Ürün için son 30 günlük satış kaydı ve sipariş akışı.</p>
        </div>
        <Link
          href={`/products/${productId}`}
          className="inline-flex items-center gap-2 self-start rounded-md border border-border/70 bg-surface-container/70 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-primary/25 hover:text-foreground"
        >
          Tam detay
        </Link>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HistoryStat label="Toplam" value={formatNumber(summary.totalUnits)} />
          <HistoryStat label="Ciro" value={formatCurrency(summary.totalRevenue)} />
          <HistoryStat label="Aktif gün" value={formatNumber(summary.activeDays)} />
          <HistoryStat label="Günlük ort." value={summary.avgDailyUnits.toFixed(1)} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-surface-container/50 px-4 py-3 text-sm text-muted">
          Bu ürün için satış özeti henüz yok.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border/70">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-surface-container/80">
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted/60">
              <th className="px-4 py-3 font-semibold">Tarih</th>
              <th className="px-4 py-3 font-semibold">Kanal</th>
              <th className="px-4 py-3 font-semibold text-right">Adet</th>
              <th className="px-4 py-3 font-semibold text-right">Tutar</th>
              <th className="px-4 py-3 font-semibold text-center">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-panel/40">
            {recentOrders.length > 0 ? (
              recentOrders.map((row) => {
                const status = orderStatusCopy(row.status);
                return (
                  <tr key={`${row.order_id}-${row.external_order_number ?? row.order_id}`} className="transition-colors duration-200 hover:bg-surface-container/40">
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(row.order_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{row.marketplace_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted">{formatNumber(row.quantity)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-primary">{formatCurrency(row.line_total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", status.className)}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  Satış geçmişi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductMobileCard({
  product,
  isSelected,
  isExpanded,
  panel,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleExpanded,
  onUpdateDraft,
  onSavePanel,
}: {
  product: Product;
  isSelected: boolean;
  isExpanded: boolean;
  panel: PanelState | undefined;
  onToggleSelect?: (id: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: number) => void;
  onToggleExpanded: (product: Product) => void;
  onUpdateDraft: (productId: number, channelSlug: ChannelSlug, patch: Partial<ChannelDraft>) => void;
  onSavePanel: (product: Product) => void;
}) {
  const fallbackDrafts = createFallbackDrafts(product);
  const draftMap = panel?.drafts ?? fallbackDrafts;
  const activeChannels = CHANNELS.filter((channel) => product.active_channels.includes(channel.slug));
  const statusValue = product.status ?? "draft";
  const statusLabel =
    product.status_label ||
    (statusValue === "active" ? "Aktif" : statusValue === "draft" ? "Taslak" : "Pasif");

  return (
    <article className="rounded-lg border border-border/70 bg-panel/65 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        {onToggleSelect ? (
          <input
            type="checkbox"
            aria-label={`${product.name} seç`}
            checked={isSelected}
            onChange={() => onToggleSelect(product.id)}
            className="mt-1 h-4 w-4 rounded border-border/70 bg-surface-container/70 text-primary focus:ring-primary/30"
          />
        ) : null}

        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border/70 bg-surface-container/70">
          {product.image_url ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${product.image_url})` }}
              role="img"
              aria-label={product.name}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-surface-soft to-cyan-500/20 text-[11px] font-extrabold text-foreground">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/products/${product.id}`}
                className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
              >
                <span className="truncate">{product.name}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </Link>
              <p className="mt-1 truncate text-[11px] text-muted">
                {product.category_path ?? product.category_name ?? "Kategorisiz"}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                statusValue === "active"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : statusValue === "draft"
                    ? "border-info/20 bg-info/10 text-info"
                    : "border-border/70 bg-surface-container/70 text-muted"
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={PANEL_CARD_CLASS + " p-3"}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Maliyet</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(product.cost)}</p>
        </div>
        <div className={PANEL_CARD_CLASS + " p-3"}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Fiyat</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(product.sale_price)}</p>
        </div>
        <div className={PANEL_CARD_CLASS + " p-3"}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Stok</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatNumber(Math.max(0, product.stock ?? 0))}</p>
        </div>
        <div className={PANEL_CARD_CLASS + " p-3"}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Desi</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{product.desi}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {activeChannels.length > 0 ? (
          activeChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.slug} className={CHIP_CLASS} title={channel.label}>
                <Icon className="h-3.5 w-3.5" />
                {channel.label}
              </div>
            );
          })
        ) : (
          <span className="text-[10px] text-muted">Aktif kanal yok</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(product)}
          className="action-inline-button"
        >
          Düzenle
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(product.id)}
          className="action-inline-button-danger"
        >
          Sil
        </button>
        <button
          type="button"
          onClick={() => onToggleExpanded(product)}
          className="action-inline-button"
          aria-expanded={isExpanded}
          aria-controls={`product-panel-mobile-${product.id}`}
        >
          {isExpanded ? "Kapat" : "Kanal Ayarları"}
        </button>
      </div>

      {isExpanded && (
        <div id={`product-panel-mobile-${product.id}`} className="mt-4 space-y-3">
          {panel?.loading ? (
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface-container/60 px-4 py-4 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Ürün detayları yükleniyor...
            </div>
          ) : (
            <>
              {panel?.error && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {panel.error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const draft = draftMap[channel.slug];
                  const carriers = channel.carrierEnabled
                    ? panel?.carriers[channel.slug as Exclude<ChannelSlug, "my_website">] ?? []
                    : [];
                  return (
                    <ChannelEditorCard
                      key={channel.slug}
                      channel={channel}
                      draft={draft}
                      carriers={carriers}
                      disabled={Boolean(panel?.saving)}
                      onToggle={() => {
                        const currentDraft = draftMap[channel.slug];
                        onUpdateDraft(product.id, channel.slug, {
                          enabled: !currentDraft.enabled,
                          shippingCompanyId:
                            !currentDraft.enabled && channel.carrierEnabled
                              ? currentDraft.shippingCompanyId || String(carriers[0]?.id ?? "")
                              : currentDraft.shippingCompanyId,
                        });
                      }}
                      onChange={(patch) => onUpdateDraft(product.id, channel.slug, patch)}
                    />
                  );
                })}
              </div>

              <SalesHistoryPreview
                productId={product.id}
                salesHistory={panel?.salesHistory}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted">
                  {panel?.saving ? "Kanal ayarları kaydediliyor..." : "Kanal bazlı değişiklikler bu panelde tutulur."}
                </div>
                <button
                  type="button"
                  onClick={() => onSavePanel(product)}
                  disabled={Boolean(panel?.saving)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {panel?.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {panel?.saving ? "Kaydediliyor..." : "Kanal Ayarlarını Kaydet"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function ProductDataTable({
  products,
  onDelete,
  onEdit,
  selectedIds = [],
  onToggleSelect,
  onNotify,
  onRefresh,
}: ProductDataTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [panelStates, setPanelStates] = useState<Record<number, PanelState>>({});
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ left: 0 });
  }, [products.length]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const expandedIdSet = useMemo(() => new Set(expandedIds), [expandedIds]);

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const categoryLabel = product.category_path ?? product.category_name ?? "";
      const channelLabel = product.active_channels.join(" ");
      const searchable = [
        product.name,
        product.sku ?? "",
        categoryLabel,
        channelLabel,
        String(product.stock ?? 0),
        String(product.sale_price ?? 0),
        product.status ?? "draft",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = query.length === 0 || searchable.includes(query);
      const matchesChannel = channelFilter === "all" || product.active_channels.includes(channelFilter);
      const matchesStatus = statusFilter === "all" || (product.status ?? "draft") === statusFilter;

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [channelFilter, deferredSearchQuery, products, statusFilter]);

  const exportCSV = () => {
    const header = ["Ürün", "Kod", "Kategori", "Stok", "Maliyet", "Ambalaj", "Desi", "Ortalama Satış Fiyatı", "Kanallar", "Durum"];
    const rows = filteredProducts.map((product) => [
      product.name,
      product.sku ?? "Belirtilmedi",
      product.category_path ?? product.category_name ?? "Belirtilmedi",
      String(product.stock ?? 0),
      String(product.cost),
      String(product.packaging_cost),
      String(product.desi),
      String(product.sale_price),
      product.active_channels.join("; "),
      product.status_label ?? product.status ?? "Belirtilmedi",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `urunler_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadProductPanel = async (product: Product) => {
    setPanelStates((current) => {
      const existing = current[product.id];
      if (existing?.loading || existing?.drafts) {
        return current;
      }

      return {
        ...current,
        [product.id]: {
          loading: true,
          saving: false,
          error: null,
          carriers: { trendyol: [], hepsiburada: [] },
          drafts: createFallbackDrafts(product),
          salesHistory: null,
        },
      };
    });

    try {
      const [productResponse, trendyolCarrierResponse, hepsiburadaCarrierResponse] = await Promise.all([
        fetch(`/api/products/${product.id}`, { cache: "no-store" }),
        fetch("/api/tariffs?type=carriers&marketplace=Trendyol", { cache: "no-store" }).catch(() => null),
        fetch("/api/tariffs?type=carriers&marketplace=Hepsiburada", { cache: "no-store" }).catch(() => null),
      ]);

      const productData = (await productResponse.json().catch(() => null)) as ProductDetailResponse | null;
      if (!productResponse.ok || !productData?.success || !Array.isArray(productData.channels) || !productData.product) {
        throw new Error("Ürün detayları alınamadı.");
      }

      const trendyolData = trendyolCarrierResponse ? await trendyolCarrierResponse.json().catch(() => null) : null;
      const hepsiburadaData = hepsiburadaCarrierResponse ? await hepsiburadaCarrierResponse.json().catch(() => null) : null;

      const carriers = {
        trendyol: Array.isArray(trendyolData?.carriers)
          ? trendyolData.carriers.map((carrier: { id: number; name: string }) => ({
              id: Number(carrier.id),
              name: carrier.name,
            }))
          : [],
        hepsiburada: Array.isArray(hepsiburadaData?.carriers)
          ? hepsiburadaData.carriers.map((carrier: { id: number; name: string }) => ({
              id: Number(carrier.id),
              name: carrier.name,
            }))
          : [],
      };

      const drafts = buildDrafts(
        product,
        productData.channels,
        carriers
      );

      setPanelStates((current) => ({
        ...current,
        [product.id]: {
          loading: false,
          saving: false,
          error: null,
          carriers,
          drafts,
          salesHistory: {
            summary: productData.salesSummary30 ?? null,
            orderHistory: Array.isArray(productData.orderHistory) ? productData.orderHistory.slice(0, 5) : [],
          },
        },
      }));
    } catch (error) {
      console.error("Product panel load error:", error);
      setPanelStates((current) => ({
        ...current,
        [product.id]: {
          loading: false,
          saving: false,
          error: error instanceof Error ? error.message : "Ürün detayları alınamadı.",
          carriers: { trendyol: [], hepsiburada: [] },
          drafts: createFallbackDrafts(product),
          salesHistory: null,
        },
      }));
    }
  };

  const toggleExpanded = (product: Product) => {
    setExpandedIds((current) => {
      const isOpen = current.includes(product.id);
      if (isOpen) {
        return current.filter((id) => id !== product.id);
      }

      void loadProductPanel(product);
      return [...current, product.id];
    });
  };

  const updateDraft = (productId: number, channelSlug: ChannelSlug, patch: Partial<ChannelDraft>) => {
    setPanelStates((current) => {
      const panel = current[productId];
      if (!panel) return current;

      const nextDrafts = {
        ...panel.drafts,
        [channelSlug]: {
          ...panel.drafts[channelSlug],
          ...patch,
        },
      };

      if (patch.enabled === true) {
        const channel = CHANNELS.find((item) => item.slug === channelSlug);
        if (channel?.carrierEnabled) {
          const currentCarrier = nextDrafts[channelSlug].shippingCompanyId;
          const carrierOptions = panel.carriers[channelSlug as Exclude<ChannelSlug, "my_website">] ?? [];
          if (!currentCarrier && carrierOptions[0]) {
            nextDrafts[channelSlug] = {
              ...nextDrafts[channelSlug],
              shippingCompanyId: String(carrierOptions[0].id),
            };
          }
        }
      }

      return {
        ...current,
        [productId]: {
          ...panel,
          drafts: nextDrafts,
        },
      };
    });
  };

  const savePanel = async (product: Product) => {
    const panel = panelStates[product.id];
    if (!panel || panel.loading || panel.saving) {
      return;
    }

    setPanelStates((current) => ({
      ...current,
      [product.id]: {
        ...(current[product.id] ?? {
          loading: false,
          saving: false,
          error: null,
          carriers: { trendyol: [], hepsiburada: [] },
          drafts: createFallbackDrafts(product),
        }),
        saving: true,
        error: null,
      },
    }));

    try {
        const channelPayload = CHANNELS.map((channel) => {
          const draft = panel.drafts[channel.slug];
          return {
            slug: channel.slug,
            enabled: draft.enabled,
            salePrice: draft.salePrice,
            buyboxPrice: draft.buyboxPrice || null,
            manualShippingCost:
              channel.slug === "my_website" ? draft.manualShippingCost || null : null,
            shippingCompanyId: channel.carrierEnabled ? draft.shippingCompanyId || null : null,
          };
        });

      const channelsResponse = await fetch(`/api/products/${product.id}/channels`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channels: channelPayload }),
      });

      const channelsData = (await channelsResponse.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!channelsResponse.ok || !channelsData?.success) {
        throw new Error(channelsData?.error || "Kanal ayarları kaydedilemedi.");
      }

      await onRefresh?.();
      onNotify?.({
        text: "Ürün kanal ayarları kaydedildi.",
        type: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kayıt işlemi başarısız oldu.";
      setPanelStates((current) => ({
        ...current,
        [product.id]: {
          ...(current[product.id] ?? {
            loading: false,
            saving: false,
            error: null,
            carriers: { trendyol: [], hepsiburada: [] },
            drafts: createFallbackDrafts(product),
          }),
          saving: false,
          error: message,
        },
      }));
      onNotify?.({
        text: message,
        type: "error",
      });
      return;
    }

    setPanelStates((current) => ({
      ...current,
      [product.id]: {
        ...(current[product.id] ?? {
          loading: false,
          saving: false,
          error: null,
          carriers: { trendyol: [], hepsiburada: [] },
          drafts: createFallbackDrafts(product),
        }),
        saving: false,
        error: null,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 bg-panel/65 p-4 shadow-[var(--shadow-card)] xl:flex-row xl:items-start">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          <input
            type="text"
            placeholder="Ürün, stok, kategori veya kanal ara..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-md border border-border/70 bg-surface-container/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-primary/40 focus:bg-surface-soft/80 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCSV}
            disabled={filteredProducts.length === 0}
            className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-primary/25 hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
            className={`${CONTROL_CLASS} min-w-[140px] [&>option]:bg-panel [&>option]:text-foreground`}
          >
            <option value="all">Tüm Kanallar</option>
            <option value="trendyol">Trendyol</option>
            <option value="hepsiburada">Hepsiburada</option>
            <option value="my_website">Kendi Websitem</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={`${CONTROL_CLASS} min-w-[140px] [&>option]:bg-panel [&>option]:text-foreground`}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="draft">Taslak</option>
          </select>
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-3 md:hidden">
            {filteredProducts.map((product) => {
              const isSelected = selectedIdSet.has(product.id);
              const isExpanded = expandedIdSet.has(product.id);
              const panel = panelStates[product.id];

              return (
                <ProductMobileCard
                  key={product.id}
                  product={product}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                  panel={panel}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleExpanded={toggleExpanded}
                  onUpdateDraft={updateDraft}
                  onSavePanel={savePanel}
                />
              );
            })}
          </div>

          <div className={`${TABLE_CARD_CLASS} hidden md:block`}>
            <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-surface-container/40">
                <tr className="border-b border-border/70 text-left text-[10px] uppercase tracking-[0.18em] text-muted/60">
                  <th className="w-[40px] px-3 py-3"> </th>
                  <th className="w-[160px] px-3 py-3">Ürün</th>
                  <th className="w-[72px] px-3 py-3">SKU</th>
                  <th className="w-[68px] px-3 py-3">Durum</th>
                  <th className="w-[92px] px-3 py-3">Alım / Üretim Maliyeti</th>
                  <th className="w-[78px] px-3 py-3">Paketleme</th>
                  <th className="w-[56px] px-3 py-3">Desi</th>
                  <th className="w-[62px] px-3 py-3">Stok</th>
                  <th className="w-[92px] px-3 py-3">Ortalama Fiyat</th>
          <th className="w-[92px] px-3 py-3 text-center">Kanallar</th>
                  <th className="w-[120px] px-3 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredProducts.map((product) => {
                  const isSelected = selectedIdSet.has(product.id);
                  const isExpanded = expandedIdSet.has(product.id);
                  const panel = panelStates[product.id];
                  const fallbackDrafts = createFallbackDrafts(product);
                  const activeChannels = CHANNELS.filter((channel) => product.active_channels.includes(channel.slug));
                  const statusValue = product.status ?? "draft";
                  const statusLabel =
                    product.status_label ||
                    (statusValue === "active" ? "Aktif" : statusValue === "draft" ? "Taslak" : "Pasif");
                  const draftMap = panel?.drafts ?? fallbackDrafts;

                  return (
                    <React.Fragment key={product.id}>
                      <tr className={cn("transition-colors duration-200 hover:bg-surface-container/35", isExpanded && "bg-primary/[0.04]")}>
                        <td className="px-3 py-4 align-middle">
                          {onToggleSelect ? (
                            <input
                              type="checkbox"
                              aria-label={`${product.name} seç`}
                              checked={isSelected}
                              onChange={() => onToggleSelect(product.id)}
                              className="h-4 w-4 rounded border-border/70 bg-surface-container/70 text-primary focus:ring-primary/30"
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-surface-container/70">
                              {product.image_url ? (
                                <div
                                  className="h-full w-full bg-cover bg-center"
                                  style={{ backgroundImage: `url(${product.image_url})` }}
                                  role="img"
                                  aria-label={product.name}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-surface-soft to-cyan-500/20 text-[11px] font-extrabold text-foreground">
                                  {product.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/products/${product.id}`}
                                  className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
                                >
                                  <span className="truncate">{product.name}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                </Link>
                              </div>
                              <p className="mt-1 truncate text-[11px] text-muted">
                                {product.category_path ?? product.category_name ?? "Kategorisiz"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-middle text-sm text-muted">
                          {product.sku ?? "—"}
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                              statusValue === "active"
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : statusValue === "draft"
                                  ? "border-info/20 bg-info/10 text-info"
                                  : "border-border/70 bg-surface-container/70 text-muted"
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-middle text-sm font-semibold text-foreground">
                          {formatCurrency(product.cost)}
                        </td>
                        <td className="px-3 py-4 align-middle text-sm font-semibold text-foreground">
                          {formatCurrency(product.packaging_cost)}
                        </td>
                        <td className="px-3 py-4 align-middle text-sm font-semibold text-foreground">
                          {product.desi}
                        </td>
                        <td className="px-3 py-4 align-middle text-sm font-semibold text-foreground">
                          {formatNumber(Math.max(0, product.stock ?? 0))}
                        </td>
                        <td className="px-3 py-4 align-middle text-sm font-semibold text-foreground">
                          {formatCurrency(product.sale_price)}
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            {activeChannels.length > 0 ? (
                              activeChannels.map((channel) => {
                                const Icon = channel.icon;
                                return (
                                  <div
                                    key={channel.slug}
                                    className={cn(CHANNEL_BADGE_CLASS, CHANNEL_BADGE_TONES[channel.badgeTone])}
                                    title={channel.label}
                                    role="img"
                                    aria-label={channel.label}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-muted">Yok</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit?.(product)}
                              className="action-icon-button"
                              aria-label={`${product.name} düzenle`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete?.(product.id)}
                              className="action-icon-button-danger"
                              aria-label={`${product.name} sil`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(product)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-surface-container/70 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-primary/25 hover:bg-card hover:text-foreground"
                              aria-expanded={isExpanded}
                              aria-controls={`product-panel-${product.id}`}
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                              {isExpanded ? "Kapat" : "Aç"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="bg-surface-container/20 px-3 pb-4 pt-0">
                            <div id={`product-panel-${product.id}`} className="rounded-lg border border-border/70 bg-panel/55 p-4 shadow-[var(--shadow-card)]">
                              {panel?.loading ? (
                                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface-container/60 px-4 py-4 text-sm text-muted">
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  Ürün detayları yükleniyor...
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className={PANEL_CARD_CLASS + " p-3"}>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Stok Miktarı</p>
                                      <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(Math.max(0, product.stock ?? 0))}</p>
                                    </div>
                                    <div className={PANEL_CARD_CLASS + " p-3"}>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Maliyet</p>
                                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(product.cost)}</p>
                                    </div>
                                    <div className={PANEL_CARD_CLASS + " p-3"}>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Paketleme</p>
                                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(product.packaging_cost)}</p>
                                    </div>
                                    <div className={PANEL_CARD_CLASS + " p-3"}>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Desi</p>
                                      <p className="mt-1 text-lg font-semibold text-foreground">{product.desi}</p>
                                    </div>
                                  </div>

                                  {panel?.error && (
                                    <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                                      <AlertCircle className="h-4 w-4 shrink-0" />
                                      {panel.error}
                                    </div>
                                  )}

                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                                          Satış kanalları
                                        </p>
                                        <p className="mt-1 text-sm text-muted">
                                          Kanal seçimi ve kargo firması bu bölümden düzenlenir.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      {CHANNELS.map((channel) => {
                                        const draft = draftMap[channel.slug];
                                        const carriers = channel.carrierEnabled
                                          ? panel?.carriers[channel.slug as Exclude<ChannelSlug, "my_website">] ?? []
                                          : [];
                                        return (
                                          <ChannelEditorCard
                                            key={channel.slug}
                                            channel={channel}
                                            draft={draft}
                                            carriers={carriers}
                                            disabled={Boolean(panel?.saving)}
                                            onToggle={() => {
                                              const currentDraft = draftMap[channel.slug];
                                              updateDraft(product.id, channel.slug, {
                                                enabled: !currentDraft.enabled,
                                                shippingCompanyId:
                                                  !currentDraft.enabled && channel.carrierEnabled
                                                    ? currentDraft.shippingCompanyId || String(carriers[0]?.id ?? "")
                                                    : currentDraft.shippingCompanyId,
                                              });
                                            }}
                                            onChange={(patch) => updateDraft(product.id, channel.slug, patch)}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <SalesHistoryPreview
                                    productId={product.id}
                                    salesHistory={panel?.salesHistory}
                                  />

                                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-xs text-muted">
                                      {panel?.saving ? "Kanal ayarları kaydediliyor..." : "Kanal bazlı değişiklikler bu panelde tutulur."}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => savePanel(product)}
                                      disabled={Boolean(panel?.saving)}
                                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {panel?.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                      {panel?.saving ? "Kaydediliyor..." : "Kanal Ayarlarını Kaydet"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={AlertCircle}
          title="Eşleşen ürün bulunamadı"
          description="Aramayı daraltabilir ya da filtreleri temizleyerek tekrar deneyebilirsin."
          action={
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setChannelFilter("all");
                setStatusFilter("all");
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Filtreleri temizle
            </button>
          }
        />
      )}
    </div>
  );
}
