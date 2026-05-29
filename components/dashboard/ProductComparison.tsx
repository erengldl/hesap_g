"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard, MobileCardList } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type CompareChannel = {
  channelName: string;
  salePrice: number;
  totalCost: number;
  netProfit: number;
  margin: number;
};

type CompareProduct = {
  id: number;
  name: string;
  sku: string;
  imageUrl: string;
  cost: number;
  packagingCost: number;
  channels: CompareChannel[];
};

type ProductOption = {
  id: number;
  name: string;
};

export default function ProductComparison() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [results, setResults] = useState<CompareProduct[] | null>(null);

  const loadProducts = useCallback(async () => {
    if (productsLoaded || productsLoading) {
      return;
    }

    setProductsLoading(true);
    setProductsError(null);

    try {
      const response = await fetch("/api/products?limit=50", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(data?.products)) {
        throw new Error(data?.error || "Ürün listesi yüklenemedi.");
      }

      setProducts(data.products);
      setProductsLoaded(true);
    } catch (error) {
      console.error("Product comparison load error:", error);
      setProductsError("Ürün listesi yüklenemedi.");
    } finally {
      setProductsLoading(false);
    }
  }, [productsLoaded, productsLoading]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const addProduct = (id: number) => {
    setSelected((current) => {
      if (current.length >= 3 || current.includes(id)) {
        return current;
      }

      return [...current, id];
    });
    setResults(null);
    setCompareError(null);
  };

  const removeProduct = (id: number) => {
    setSelected((current) => current.filter((itemId) => itemId !== id));
    setResults(null);
    setCompareError(null);
  };

  const runCompare = async () => {
    if (selected.length < 2) {
      return;
    }

    setComparing(true);
    setCompareError(null);

    try {
      const params = selected.map((id) => `id=${id}`).join("&");
      const response = await fetch(`/api/products/compare?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !Array.isArray(data?.products)) {
        throw new Error(data?.error || "Karşılaştırma sonuçları alınamadı.");
      }

      setResults(data.products);
    } catch (error) {
      console.error("Product comparison run error:", error);
      setResults(null);
      setCompareError("Karşılaştırma sonuçları alınamadı.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-bold text-foreground">Benchmark Analizi</h3>
          <p className="text-sm font-medium text-muted/70">Seçili ürünlerin platformlar arası kârlılığı.</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <select
            value=""
            onFocus={() => {
              void loadProducts();
            }}
            onChange={(event) => {
              if (event.target.value) {
                addProduct(Number(event.target.value));
              }
            }}
            className="w-full rounded-md border border-border bg-surface-container px-3 py-2 text-sm font-medium text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 sm:w-[260px]"
          >
            <option value="" disabled className="text-muted">
              {productsLoading && !productsLoaded ? "Ürünler yükleniyor..." : "Ürün seçin..."}
            </option>
            {products
              .filter((product) => !selected.includes(product.id))
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={runCompare}
            disabled={selected.length < 2 || comparing}
            className="w-full rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-colors duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            {comparing ? "Analiz hazırlanıyor..." : "Kıyasla"}
          </button>
        </div>
      </div>

      {(productsError || compareError) && (
        <div className="mb-4 space-y-1.5">
          {productsError ? <p className="text-xs font-medium text-danger/80">{productsError}</p> : null}
          {compareError ? <p className="text-xs font-medium text-danger/80">{compareError}</p> : null}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selected.map((id) => {
            const name = products.find((product) => product.id === id)?.name ?? String(id);

            return (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary transition-colors duration-200 hover:bg-surface-soft"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeProduct(id)}
                  className="text-base font-semibold leading-none text-muted/60 transition-colors duration-200 hover:text-danger"
                >
                  &times;
                </button>
              </span>
            );
          })}
        </div>
      )}

      {results && results.length >= 2 ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-[0.1em] text-muted/60">
                  <th className="pb-2">Ürün Spesifikasyonu</th>
                  <th className="pb-2 text-right">Baz Maliyet</th>
                  {results[0]?.channels.map((channel) => (
                    <th key={channel.channelName} className="pb-2 text-right">
                      {channel.channelName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {results.map((product) => (
                  <tr key={product.id} className="group transition-colors duration-200 hover:bg-surface-subtle">
                    <td className="py-3">
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <p className="mt-0.5 text-xs text-muted/60">{product.sku}</p>
                    </td>
                    <td className="py-3 text-right text-sm font-semibold text-muted">
                      {formatCurrency(product.cost + product.packagingCost)}
                    </td>
                    {product.channels.map((channel) => (
                      <td key={channel.channelName} className="py-3 text-right">
                        <div className="space-y-1">
                          <p
                            className={cn(
                              "text-sm font-semibold tracking-tight",
                              channel.margin > 30 ? "text-primary" : channel.margin > 15 ? "text-warning" : "text-danger"
                            )}
                          >
                            {formatCurrency(channel.netProfit)}
                          </p>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-medium uppercase tracking-tight text-muted/60">
                              %{Math.round(channel.margin)} Marj
                            </span>
                            <span className="text-xs font-medium uppercase tracking-tight text-muted/60">
                              {formatCurrency(channel.totalCost)} Gider
                            </span>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MobileCardList
            className="space-y-3 md:hidden"
            data={results}
            renderItem={(product) => {
              const totalCost = product.cost + product.packagingCost;
              const peakProfit = Math.max(...product.channels.map((channel) => channel.netProfit), 1);
              const bestChannel =
                product.channels.length > 0
                  ? product.channels.reduce((best, channel) =>
                      channel.netProfit > best.netProfit ? channel : best
                    , product.channels[0])
                  : null;

              return (
                <GlassCard key={product.id} className="p-3">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                      <p className="mt-0.5 text-xs text-muted/60">{product.sku}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted/60">Baz Maliyet</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(totalCost)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {product.channels.map((channel) => {
                      const isBest = bestChannel?.channelName === channel.channelName;
                      const barWidth = Math.max(8, (Math.max(channel.netProfit, 0) / peakProfit) * 100);

                      return (
                        <div
                          key={channel.channelName}
                          className={cn(
                            "rounded-lg border p-3 transition-all duration-200",
                            isBest ? "border-border bg-primary-soft/40" : "border-border bg-surface-soft"
                          )}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{channel.channelName}</p>
                              <p className="mt-0.5 text-xs uppercase tracking-wide text-muted/60">
                                Fiyat {formatCurrency(channel.salePrice)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
                                isBest ? "border-border bg-primary-soft text-primary" : "border-border bg-surface-soft text-muted"
                              )}
                            >
                              {isBest ? "En iyi" : "Alt"}
                            </span>
                          </div>

                          <div className="mb-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted/60">Net Kâr</p>
                              <p
                                className={cn(
                                  "text-lg font-semibold tracking-tight",
                                  channel.margin > 30 ? "text-primary" : channel.margin > 15 ? "text-warning" : "text-danger"
                                )}
                              >
                                {formatCurrency(channel.netProfit)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted/60">Marj</p>
                              <p className={cn("text-lg font-semibold tracking-tight", isBest ? "text-primary" : "text-foreground/80")}>
                                %{Math.round(channel.margin)}
                              </p>
                            </div>
                          </div>

                          <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className={cn("h-full rounded-full transition-[width] duration-300", isBest ? "bg-primary" : "bg-border")}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-muted/60">
                            <span>Masraflar dahil</span>
                            <span>{formatCurrency(channel.totalCost)} maliyet</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              );
            }}
          />
        </div>
      ) : null}
    </GlassCard>
  );
}
