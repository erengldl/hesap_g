"use client";

import { AlertTriangle, PlayCircle, Timer, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import type {
  DemandForecastResult,
  DemandForecastSelection,
  ForecastHorizon,
  ForecastMarketplaceOption,
  ForecastProductOption,
} from "@/lib/demand-forecast-types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface ForecastControlPanelProps {
  products: ForecastProductOption[];
  marketplaces: ForecastMarketplaceOption[];
  selection: DemandForecastSelection;
  selectedMarketplaceId: number;
  selectedProduct: ForecastProductOption | null;
  selectedMarketplace: ForecastMarketplaceOption | null;
  result: DemandForecastResult | null;
  onProductChange: (productId: number) => void;
  onMarketplaceChange: (marketplaceId: number) => void;
  onHorizonChange: (horizonDays: ForecastHorizon) => void;
  onRunForecast: () => void;
  submitting: boolean;
  className?: string;
}

export default function ForecastControlPanel({
  products,
  marketplaces,
  selection,
  selectedMarketplaceId,
  selectedProduct,
  selectedMarketplace,
  result,
  onProductChange,
  onMarketplaceChange,
  onHorizonChange,
  onRunForecast,
  submitting,
  className,
}: ForecastControlPanelProps) {
  const dataSource = result?.summary.dataSource ?? "real";
  const dataSourceLabel =
    dataSource === "real" ? "Gerçek veri" : dataSource === "mixed" ? "Karma veri" : "Sentetik veri";
  const dataSourceTone =
    dataSource === "real"
      ? "border-primary/20 bg-primary/10 text-primary"
      : dataSource === "mixed"
        ? "border-warning/20 bg-warning/10 text-warning"
        : "border-danger/20 bg-danger/10 text-danger";

  return (
    <GlassCard className={cn("flex w-full flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">Kontrol</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Tahmin ayarları</h2>
          <p className="mt-1 text-sm leading-6 text-soft">Seçimi değiştirdikçe sonuç yenilenir.</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={cn("rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", dataSourceTone)}>
            {dataSourceLabel}
          </span>
          <span className="rounded-md border border-border bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {selectedMarketplace?.name ?? `Pazar ${selectedMarketplaceId}`}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="form-label">Ürün</label>
        <select
          value={selection.productId}
          onChange={(event) => onProductChange(Number(event.target.value))}
          className="form-select"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · {product.sku ?? "Kod yok"}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <label className="form-label">Pazaryeri</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {marketplaces.map((marketplace) => {
            const active = marketplace.id === selection.marketplaceId;
            return (
              <button
                key={marketplace.id}
                type="button"
                onClick={() => onMarketplaceChange(marketplace.id)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface-container text-muted hover:border-border-strong hover:text-foreground"
                )}
              >
                {marketplace.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="form-label">Tahmin ufku</label>
        <div className="grid grid-cols-3 gap-2">
          {[7, 14, 30].map((days) => {
            const active = selection.horizonDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => onHorizonChange(days as ForecastHorizon)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface-container text-muted hover:border-border-strong hover:text-foreground"
                )}
              >
                <Timer className="h-3.5 w-3.5" />
                {days} gün
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface-container p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Seçim</p>
            <h3 className="mt-1 truncate text-base font-semibold text-foreground">
              {selectedProduct?.name ?? "Ürün seçilmedi"}
            </h3>
            <p className="mt-1 truncate text-xs text-soft">
              {selectedMarketplace?.name ?? "Kanal seçilmedi"} · Kod {selectedProduct?.sku ?? "Belirtilmedi"}
            </p>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/10 p-2.5 text-primary">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border/80 bg-surface-container">
          <MetricTile label="Fiyat" value={formatCurrency(selectedMarketplace?.current_price ?? 0)} />
          <MetricTile label="Birim maliyet" value={formatCurrency(selectedMarketplace?.current_unit_cost ?? 0)} />
          <MetricTile label="Net kâr" value={formatCurrency(selectedMarketplace?.current_net_profit ?? 0)} />
          <MetricTile label="Ürün stoku" value={formatNumber(selectedProduct?.current_stock ?? 0)} />
        </div>
      </div>

      <button
        type="button"
        onClick={onRunForecast}
        disabled={submitting}
        className="btn-primary w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <PlayCircle className="h-4 w-4 animate-pulse" />
            Çalışıyor
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Tahmini Güncelle
          </>
        )}
      </button>

      {result?.warnings?.length ? (
        <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Uyarılar</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-soft">
            {result.warnings.slice(0, 3).map((warning) => (
              <li key={warning} className="leading-6">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </GlassCard>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
