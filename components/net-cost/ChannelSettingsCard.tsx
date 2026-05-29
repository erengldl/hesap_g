"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Sparkles, Truck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheapestCarrier {
  company_name: string;
  price: number;
}

interface ChannelSettingsCardProps {
  marketplace: "Trendyol" | "Hepsiburada";
  active: boolean;
  salePrice: number;
  onChangePrice: (price: number) => void;
  carriers: string[];
  selectedCarrier: string;
  onChangeCarrier: (carrier: string) => void;
  productDesi?: number | null;
}

export default function ChannelSettingsCard({
  marketplace,
  active,
  salePrice,
  onChangePrice,
  carriers,
  selectedCarrier,
  onChangeCarrier,
  productDesi,
}: ChannelSettingsCardProps) {
  const [cheapest, setCheapest] = useState<CheapestCarrier | null>(null);

  useEffect(() => {
    if (!active || productDesi == null || productDesi <= 0) {
      setCheapest(null);
      return;
    }

    const cancelled = { current: false };
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/tariffs?type=cheapest_carrier&marketplace=${encodeURIComponent(marketplace)}&desi=${productDesi}`
        );
        const data = await response.json();
        if (!cancelled.current && data.success && data.cheapest) {
          setCheapest(data.cheapest);
        } else if (!cancelled.current) {
          setCheapest(null);
        }
      } catch {
        if (!cancelled.current) setCheapest(null);
      }
    }, 80);

    return () => {
      cancelled.current = true;
      window.clearTimeout(timer);
    };
  }, [active, marketplace, productDesi]);

  const isSelectedCheapest = cheapest && selectedCarrier === cheapest.company_name;

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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-surface-container text-sm font-semibold text-foreground">
            {marketplace === "Trendyol" ? "T" : "H"}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold tracking-tight text-foreground">
              {marketplace}
            </h4>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              Pazaryeri kanalı
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

        <label className="block space-y-3">
          <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60">
            <Truck className="h-4 w-4 text-primary/70" />
            Lojistik partneri
          </span>
          <div className="relative">
            <select
              disabled={!active}
              value={selectedCarrier}
              onChange={(e) => onChangeCarrier(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container disabled:opacity-50"
            >
              {carriers.map((carrier) => (
                <option key={carrier} value={carrier} className="bg-panel text-foreground">
                  {carrier}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          </div>
        </label>

        {active && cheapest && (
          <button
            type="button"
            onClick={() => onChangeCarrier(cheapest.company_name)}
            className={cn(
              "flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-colors duration-200",
              isSelectedCheapest
                ? "border-primary/20 bg-primary/[0.05]"
                : "border-border/80 bg-surface-container hover:border-primary/20 hover:bg-surface-container"
            )}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", isSelectedCheapest ? "bg-primary text-primary-foreground" : "bg-surface-container text-muted/60")}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted/60 mb-1">
                  En düşük tarife
                </p>
                <p className="truncate text-sm font-medium text-foreground">{cheapest.company_name}</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">
              ₺{cheapest.price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2 pt-1">
          <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">
            Desi bazlı en uygun taşıyıcı otomatik hesaplanır.
          </p>
        </div>
      </div>
    </div>
  );
}
