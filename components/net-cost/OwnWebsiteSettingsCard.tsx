"use client";

import React from "react";
import { Globe, Megaphone, Truck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface OwnWebsiteSettingsCardProps {
  active: boolean;
  salePrice: number;
  onChangePrice: (price: number) => void;
  shippingCost: number;
  onChangeShippingCost: (cost: number) => void;
  cpa: number;
  onChangeCpa: (cost: number) => void;
}

export default function OwnWebsiteSettingsCard({
  active,
  salePrice,
  onChangePrice,
  shippingCost,
  onChangeShippingCost,
  cpa,
  onChangeCpa,
}: OwnWebsiteSettingsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 sm:p-6",
        active
          ? "border-border/80 bg-surface-container shadow-[var(--shadow-card)]"
          : "pointer-events-none border-border/80 bg-surface-container opacity-50 grayscale"
      )}
    >
      <div className="relative z-10 mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-surface-container text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold tracking-tight text-foreground">
              Kendi web sitem
            </h4>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              Direkt satış kanalı
            </p>
          </div>
        </div>

        <span
          className={cn(
            "rounded-md border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-200",
            active ? "border-primary/20 bg-primary/10 text-primary" : "border-border/80 bg-surface-container text-muted/60"
          )}
        >
          {active ? "Aktif" : "Pasif"}
        </span>
      </div>

      <div className="relative z-10 space-y-5">
        <label className="block space-y-3">
          <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60">
            <Tag className="h-4 w-4 text-primary/70" />
            Satış fiyatı
          </span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted/60">₺</span>
            <input
              type="number"
              disabled={!active}
              value={salePrice}
              onChange={(e) => onChangePrice(Number(e.target.value))}
              className="w-full rounded-2xl border border-border/80 bg-surface-container pl-8 pr-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container disabled:opacity-50"
            />
          </div>
        </label>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <label className="block space-y-3">
            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60">
              <Truck className="h-4 w-4 text-primary/70" />
              Lojistik
            </span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted/60">₺</span>
              <input
                type="number"
                disabled={!active}
                value={shippingCost}
                onChange={(e) => onChangeShippingCost(Number(e.target.value))}
                className="w-full rounded-2xl border border-border/80 bg-surface-container pl-8 pr-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container disabled:opacity-50"
              />
            </div>
          </label>

          <label className="block space-y-3">
            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60">
              <Megaphone className="h-4 w-4 text-warning/80" />
              Müşteri edinimi (CPA)
            </span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted/60">₺</span>
              <input
                type="number"
                disabled={!active}
                value={cpa}
                onChange={(e) => onChangeCpa(Number(e.target.value))}
                className="w-full rounded-2xl border border-border/80 bg-surface-container pl-8 pr-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-warning/40 focus:bg-surface-container disabled:opacity-50"
              />
            </div>
          </label>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-primary/70">
            Merkezi entegrasyon
          </p>
          <p className="text-xs leading-relaxed text-muted/60">
            Ödeme altyapısı ve sabit giderler veri merkezinden otomatik çekilir.
          </p>
        </div>
      </div>
    </div>
  );
}
