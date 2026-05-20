"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Globe, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";

interface ChannelCostResultCardProps {
  data: ChannelCostResult;
  isBest: boolean;
  productId: number;
}

function getMarketplaceId(data: ChannelCostResult) {
  if (data.marketplace_id) return data.marketplace_id;
  if (data.marketplace_slug === "trendyol") return 1;
  if (data.marketplace_slug === "hepsiburada") return 2;
  if (data.marketplace_slug === "own_website") return 3;
  return null;
}

function formatMoney(value: number) {
  return value === 0 ? "—" : formatCurrency(value);
}

export default function ChannelCostResultCard({ data, isBest, productId }: ChannelCostResultCardProps) {
  const isOwnWebsite = data.channel_name === "Kendi Websitem";
  const isLoss = data.net_profit < 0;
  const targetMarketplaceId = getMarketplaceId(data);
  const optimizeHref = productId
    ? `/profit-pricing?productId=${productId}${targetMarketplaceId ? `&marketplaceId=${targetMarketplaceId}` : ""}`
    : null;

  const mlConfidenceLabel =
    data.ml_confidence === "High"
      ? "Yüksek"
      : data.ml_confidence === "Medium"
        ? "Orta"
        : data.ml_confidence === "Low"
          ? "Düşük"
          : null;

  const summaryRows = [
    { label: "Satış fiyatı", value: data.sale_price },
    { label: "Toplam maliyet", value: data.total_unit_cost },
    { label: "Net kâr", value: data.net_profit, highlight: true },
    { label: "Kâr marjı", value: data.profit_margin_percent, isPercent: true, highlight: true },
  ];

  const costRows = [
    { label: "Ürün", value: data.product_cost },
    { label: "Paketleme", value: data.packaging_cost },
    { label: "Kargo", value: data.shipping_cost },
    { label: "Komisyon", value: data.commission_cost },
    { label: "Platform", value: data.platform_fee_cost },
    { label: "Ödeme", value: data.payment_gateway_cost },
    { label: "Trafik / reklam", value: data.traffic_ad_cost },
    { label: "Ek reklam", value: data.unit_ad_cost },
    { label: "Sabit gider", value: data.unit_fixed_cost },
    { label: "İade", value: data.expected_return_cost },
  ].filter((row) => row.value !== 0);

  const taxRows = [
    { label: "KDV", value: data.estimated_vat_payable },
    { label: "Gelir vergisi", value: Number(data.income_tax ?? 0) },
    { label: "Kargo KDV", value: Number(data.shipping_vat ?? 0) },
    { label: "Stopaj", value: Number(data.withholding_tax ?? 0) },
  ].filter((row) => row.value !== 0);

  const mlRows = [
    data.ml_return_rate && data.ml_return_rate > 0
      ? { label: "İade olasılığı", value: formatPercent(data.ml_return_rate) }
      : null,
    data.ml_predicted_cpa && data.ml_predicted_cpa > 0
      ? { label: "Tahmini CPA", value: formatCurrency(data.ml_predicted_cpa) }
      : null,
    data.ml_shipping_multiplier && Math.abs(data.ml_shipping_multiplier - 1) > 0.01
      ? { label: "Kargo çarpanı", value: `x${data.ml_shipping_multiplier.toFixed(2)}` }
      : null,
    data.ml_effective_desi && data.ml_effective_desi > 0 && data.ml_shipping_multiplier && Math.abs(data.ml_shipping_multiplier - 1) > 0.01
      ? { label: "Etkin desi", value: `${data.ml_effective_desi.toFixed(2)} desi` }
      : null,
    mlConfidenceLabel ? { label: "Güven", value: mlConfidenceLabel } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-colors duration-200",
        isBest ? "border-primary/20 bg-primary/5" : "border-border/80 bg-surface-container"
      )}
    >
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                isBest ? "border-primary/20 bg-primary text-primary-foreground" : "border-border/80 bg-surface-container text-muted/60"
              )}>
                {isOwnWebsite ? <Globe className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
              </div>

              <div className="min-w-0">
                <h4 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {data.channel_name}
                </h4>
                <p className="mt-1 text-xs text-muted/60">
                  Satış {formatCurrency(data.sale_price)} · Toplam {formatCurrency(data.total_unit_cost)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isBest && (
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Lider kanal
                </span>
              )}
              {data.is_fallback && (
                <span className="rounded-md border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-warning">
                  Veri merkezi tahmini
                </span>
              )}
              {mlConfidenceLabel && (
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                  ML {mlConfidenceLabel}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Net kâr</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight", isLoss ? "text-danger" : isBest ? "text-primary" : "text-foreground")}>
              {formatMoney(data.net_profit)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted/60">
              {formatPercent(data.profit_margin_percent)} marj
            </p>
          </div>
        </div>

        {isOwnWebsite && data.gross_net_profit_without_traffic !== undefined && (
          <div className="rounded-2xl border border-warning/15 bg-warning/[0.04] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-warning/80">
              Trafik hariç potansiyel
            </p>
            <p className="mt-1 text-sm text-muted/60">
              Trafik maliyeti hariç teorik kâr: <span className="text-warning">{formatCurrency(data.gross_net_profit_without_traffic)}</span>
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {summaryRows.map((row) => (
            <div
              key={row.label}
              className={cn(
                "rounded-2xl border px-4 py-3",
                row.highlight ? "border-primary/15 bg-primary/5" : "border-border/80 bg-surface-container"
              )}
            >
              <p className={cn("text-[10px] uppercase tracking-[0.16em]", row.highlight ? "text-primary/80" : "text-muted/60")}>
                {row.label}
              </p>
              <p className={cn("mt-1 text-sm font-medium tracking-tight", row.highlight ? "text-foreground" : "text-foreground/80")}>
                {row.isPercent ? formatPercent(row.value) : formatMoney(row.value)}
              </p>
            </div>
          ))}
        </div>

        <details className="rounded-2xl border border-border/80 bg-surface-container p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">Ayrıntılar</p>
                <p className="text-sm font-medium text-foreground">Maliyet, vergi ve tahmin dökümü</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                Aç / Kapat
              </span>
            </div>
          </summary>

          <div className="mt-4 space-y-4">
            {costRows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {costRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-border/80 bg-surface-container px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">{row.label}</p>
                    <p className="mt-1 text-sm font-medium text-foreground/85">{formatMoney(row.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {taxRows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {taxRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-border/80 bg-surface-container px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">{row.label}</p>
                    <p className="mt-1 text-sm font-medium text-foreground/85">{formatMoney(row.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {mlRows.length > 0 && (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                  ML tahminleri
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {mlRows.map((row) => (
                    <div key={row.label} className="rounded-2xl border border-primary/10 bg-surface-container px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-primary/70">{row.label}</p>
                      <p className="mt-1 text-sm font-medium text-primary">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>

        {isLoss && (
          <div className="flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Bu kanal mevcut parametrelerle zarar üretiyor.
          </div>
        )}

        {optimizeHref && (
          <Link
            href={optimizeHref}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-200",
              isBest
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border/80 bg-surface-container text-foreground hover:bg-surface-container"
            )}
          >
            Birleşik kârlılık ekranını aç
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
