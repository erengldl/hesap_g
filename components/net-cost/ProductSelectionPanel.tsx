"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Package, Tag, Edit3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

function getProductCategoryLabel(product: Product) {
  return product.category_path?.trim() || product.category_name?.trim() || "Kategori belirtilmedi";
}

function getProductStatusKey(product: Product) {
  return (product.status || "active").toLowerCase();
}

function getProductStatusLabel(product: Product) {
  if (product.status_label?.trim()) {
    return product.status_label;
  }

  const status = getProductStatusKey(product);
  if (status === "active") return "Aktif";
  if (status === "passive") return "Pasif";
  if (status === "draft") return "Taslak";
  return "Durum";
}

interface ProductSelectionPanelProps {
  selectedProductId: number | null;
  onSelectProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  refreshKey?: number;
}

export default function ProductSelectionPanel({
  selectedProductId,
  onSelectProduct,
  onEditProduct,
  refreshKey = 0,
}: ProductSelectionPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      setLoading(true);
      try {
        const response = await fetch("/api/products");
        const data = await response.json();
        if (!cancelled && data.success) {
          setProducts(data.products);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (categoryFilter === "all") return;

    const categoryExists = products.some((product) => getProductCategoryLabel(product) === categoryFilter);
    if (!categoryExists) {
      setCategoryFilter("all");
    }
  }, [products, categoryFilter]);

  const categoryOptions = Array.from(
    new Set(products.map((product) => getProductCategoryLabel(product)))
  ).sort((a, b) => a.localeCompare(b, "tr"));

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const categoryLabel = getProductCategoryLabel(product);
    const statusKey = getProductStatusKey(product);
    const matchesSearch =
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.sku?.toLowerCase().includes(normalizedSearch) ||
      categoryLabel.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === "all" || statusKey === statusFilter;
    const matchesCategory = categoryFilter === "all" || categoryLabel === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  useEffect(() => {
    if (loading || filteredProducts.length === 0) return;

    const selectedStillVisible =
      selectedProductId != null && filteredProducts.some((product) => product.id === selectedProductId);

    if (!selectedStillVisible) {
      onSelectProduct(filteredProducts[0]);
    }
  }, [filteredProducts, loading, onSelectProduct, selectedProductId]);

  const activeFilterCount =
    Number(Boolean(normalizedSearch)) +
    Number(statusFilter !== "all") +
    Number(categoryFilter !== "all");

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60">
            Ürün seçimi
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Ürün kataloğu
          </h3>
          <p className="max-w-sm text-sm leading-relaxed text-muted/60">
            Filtreleyin, seçin ve senaryoyu açın.
          </p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60 transition-colors duration-200 group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Ürün veya kategori ara"
            className="w-full rounded-md border border-border/80 bg-surface-container py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="ml-1 block text-[10px] font-medium uppercase tracking-[0.22em] text-muted/60">
              Kategori
            </span>
            <div className="relative group">
              <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60 transition-colors duration-200 group-focus-within:text-primary" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-border/80 bg-surface-container py-2.5 pl-11 pr-10 text-sm text-foreground transition-colors duration-200 focus:border-primary/40 focus:outline-none"
              >
                <option value="all" className="bg-panel text-foreground">
                  Tümü
                </option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category} className="bg-panel text-foreground">
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60 transition-colors duration-200 group-hover:text-primary" />
            </div>
          </label>

          <label className="space-y-2">
            <span className="ml-1 block text-[10px] font-medium uppercase tracking-[0.22em] text-muted/60">
              Durum
            </span>
            <div className="relative group">
              <Tag className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60 transition-colors duration-200 group-focus-within:text-primary" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "passive" | "draft")}
                className="w-full appearance-none rounded-md border border-border/80 bg-surface-container py-2.5 pl-11 pr-10 text-sm text-foreground transition-colors duration-200 focus:border-primary/40 focus:outline-none"
              >
                <option value="all" className="bg-panel text-foreground">
                  Durum
                </option>
                <option value="active" className="bg-panel text-foreground">
                  Aktif
                </option>
                <option value="passive" className="bg-panel text-foreground">
                  Pasif
                </option>
                <option value="draft" className="bg-panel text-foreground">
                  Taslak
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60 transition-colors duration-200 group-hover:text-primary" />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted/60">
            {filteredProducts.length} / {products.length} ürün
          </p>
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className={cn(
              "text-xs font-medium transition-colors duration-200",
              activeFilterCount === 0
                ? "cursor-default text-muted/60"
                : "text-primary hover:text-primary/80"
            )}
          >
            Filtreleri temizle
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border/80 bg-surface-container" />
          ))
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const isSelected = selectedProductId === product.id;
            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-lg border p-3.5 transition-colors duration-200",
                  isSelected
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/80 bg-surface-container hover:border-border hover:bg-surface-container"
                )}
              >
                {isSelected && <div className="absolute inset-y-0 left-0 w-1 bg-primary" />}

                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
                      isSelected
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border/80 bg-surface-container text-muted/60 group-hover:text-primary"
                    )}
                  >
                    <Package className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4
                          className={cn(
                            "truncate text-sm font-semibold tracking-tight",
                            isSelected ? "text-foreground" : "text-foreground/90"
                          )}
                        >
                          {product.name}
                        </h4>
                        <p className="mt-1 truncate text-xs text-muted/60">
                          {getProductCategoryLabel(product)}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                          getProductStatusKey(product) === "active"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border/80 bg-surface-container text-muted/60"
                        )}
                      >
                        {getProductStatusLabel(product)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted/60">
                          Satış fiyatı
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatCurrency(product.sale_price)}
                        </p>
                      </div>

                      <div className="h-8 w-px bg-border/60" />

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted/60">
                          Desi
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {product.desi} desi
                        </p>
                      </div>

                      <div className="ml-auto text-right">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted/60">
                          Seçim durumu
                        </p>
                        <p className={cn("mt-1 text-sm font-semibold", isSelected ? "text-primary" : "text-muted/60")}>
                          {isSelected ? "Aktif seçim" : "Seçilebilir"}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-border/80 bg-surface-container px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/60">
                            Net maliyet
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatCurrency(product.cost + product.packaging_cost)}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/80 bg-surface-container px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/60">
                            Durum
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {getProductStatusLabel(product)}
                          </p>
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-primary/70">
                          Seçili ürün
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProduct(product);
                          }}
                          className="action-inline-button"
                        >
                          <Edit3 className="h-4 w-4" />
                          Düzenle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-surface-container px-6 py-16 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted/60" />
            <p className="text-sm font-medium text-foreground/75">Ürün bulunamadı</p>
            <p className="mt-2 text-xs text-muted/60">Filtreleri değiştirerek tekrar deneyin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
