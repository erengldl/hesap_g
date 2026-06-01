"use client";

import { type ElementType, useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheckBig, CircleDollarSign, CircleX, CloudDownload, Database, Package, Plus, RotateCw, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { Product, ProductUpsertInput } from "@/lib/types";
import { DEMO_PRODUCTS } from "@/lib/demo-data";
import { EmptyState, ErrorStateCard, GlassCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";

import ProductDataTable from "./ProductDataTable";
import ProductDataForm from "./ProductDataForm";
import SalesHistorySection from "./SalesHistorySection";
import StoreSettingsSection from "./StoreSettingsSection";

type ToastMessage = {
  text: string;
  type: "success" | "warning" | "error";
};

type AppStats = {
  product_count?: number | null;
  active_product_count?: number | null;
  average_price?: number | null;
  average_profit_margin?: number | null;
  active_store_expense_total?: number | null;
  last_bulk_sync_time?: string | null;
  last_bulk_sync_scope?: string | null;
  last_bulk_sync_count?: number | null;
  last_bulk_sync_processed?: number | null;
  last_bulk_sync_message?: string | null;
};

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "profit" | "warning";
  icon: ElementType;
}) {
  const toneStyles =
    tone === "profit"
      ? "border-profit/20 bg-profit/[0.04]"
      : tone === "warning"
        ? "border-warning/20 bg-warning/[0.04]"
        : "border-border/70";
  const iconStyles =
    tone === "profit"
      ? "border-profit/20 bg-profit/12 text-profit"
      : tone === "warning"
        ? "border-warning/20 bg-warning/12 text-warning"
        : "border-border/70 bg-surface-container/75 text-stable";

  return (
    <GlassCard className={cn("flex h-full items-center justify-between gap-4 p-4", toneStyles)}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="mt-2 truncate text-[1.25rem] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-2 text-[11px] text-muted/70">{hint}</p>}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", iconStyles)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
    </GlassCard>
  );
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Henüz işlem yapılmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz işlem yapılmadı";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "şimdi";
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gün önce`;
}

export function DataCenterTabs() {
  const useDemoData = process.env.NODE_ENV !== "production";
  const [activeTab, setActiveTab] = useState<"products" | "sales" | "settings">("products");
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [catalogImporting, setCatalogImporting] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, productsResponse] = await Promise.all([
        fetch("/api/data-center/status", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);

      const statsData = await statsResponse.json();
      setStats(statsData?.success ? statsData : null);

      const productsData = await productsResponse.json();
      const nextProducts: Product[] =
        Array.isArray(productsData?.products)
          ? (productsData.products as Product[])
          : useDemoData
            ? DEMO_PRODUCTS
            : [];
      setLoadError(null);
      setProducts(nextProducts);
      setSelectedIds((current) => current.filter((id) => nextProducts.some((product) => product.id === id)));
      return nextProducts;
    } catch (error) {
      console.error("Failed to refresh data", error);
      setStats(null);
      setLoadError("Veri merkezi yüklenemedi. Sunucu bağlantısı kesildi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      setProducts(useDemoData ? DEMO_PRODUCTS : []);
      setSelectedIds([]);
      return useDemoData ? DEMO_PRODUCTS : [];
    } finally {
      setLoading(false);
    }
  }, [useDemoData]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const showMessage = (nextMessage: ToastMessage) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 4500);
  };

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const handleSubmitProduct = async (payload: ProductUpsertInput) => {
    setSubmitting(true);
    try {
      const isEdit = Boolean(editingProduct);
      const response = await fetch(isEdit ? `/api/products/${editingProduct?.id}` : "/api/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Ürün kaydedilemedi");
      }

      await refreshData();
      setIsProductFormOpen(false);
      setEditingProduct(null);
      showMessage({
        text: isEdit ? "Ürün güncellendi ve maliyet sonuçları yenilendi." : "Ürün eklendi ve maliyet sonuçları üretildi.",
        type: "success",
      });
    } catch (error) {
      console.error("Product save error:", error);
      showMessage({ text: "Ürün kaydedilemedi.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    const product = products.find((item) => item.id === productId);
    const confirmed = window.confirm(`${product?.name ?? "Bu ürün"} silinsin mi? Bu işlem geri alınamaz.`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Ürün silinemedi");
      }

      await refreshData();
      showMessage({ text: "Ürün silindi.", type: "success" });
    } catch (error) {
      console.error("Product delete error:", error);
      showMessage({ text: "Ürün silinemedi.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkStatusChange = async (status: "active" | "passive" | "draft") => {
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const product = productById.get(id);
          if (!product) return;

          const response = await fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: product.name,
                sku: product.sku ?? "",
                image_url: product.image_url ?? "",
              category_id: product.category_id ?? null,
                category_path: product.category_path ?? product.category_name ?? "",
                cost: product.cost,
                packaging_cost: product.packaging_cost,
              desi: product.desi,
              sale_price: product.sale_price,
              active_channels: product.active_channels,
              status,
            } satisfies ProductUpsertInput),
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || `Ürün ${id} güncellenemedi`);
          }
        })
      );

      await refreshData();
      setSelectedIds([]);
      showMessage({ text: "Seçili ürünler güncellendi.", type: "success" });
    } catch (error) {
      console.error("Bulk status update error:", error);
      showMessage({ text: "Toplu güncelleme yapılamadı.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`${selectedIds.length} ürün silinsin mi? Bu işlem geri alınamaz.`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || `Ürün ${id} silinemedi`);
          }
        })
      );
      await refreshData();
      setSelectedIds([]);
      showMessage({ text: "Seçili ürünler silindi.", type: "success" });
    } catch (error) {
      console.error("Bulk delete error:", error);
      showMessage({ text: "Toplu silme yapılamadı.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const productCount = stats?.product_count ?? products.length;
  const activeProductCount = stats?.active_product_count ?? products.filter((item) => item.status === "active").length;
  const averagePrice = stats?.average_price ?? (products.reduce((sum, item) => sum + Number(item.sale_price ?? 0), 0) / Math.max(1, products.length));
  const averageProfitMargin = stats?.average_profit_margin ?? 0;
  const lastBulkSyncSummary = stats?.last_bulk_sync_time
    ? `${formatRelativeTime(stats.last_bulk_sync_time)} · ${Number(stats.last_bulk_sync_count ?? 0)} ürün`
    : "Henüz toplu işlem yapılmadı";
  const lastBulkSyncScope = stats?.last_bulk_sync_scope === "marketplace_catalog_import"
    ? "Pazaryeri katalog içe aktarma"
    : stats?.last_bulk_sync_scope === "all_products"
      ? "Veri merkezi yeniden hesaplama"
      : stats?.last_bulk_sync_scope ?? "İşlem yok";

  if (loading && products.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} variant="card" height={104} delayIndex={index} />
          ))}
        </div>

        <div className="space-y-4 rounded-lg border border-border/70 bg-panel/70 p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="space-y-2">
            <SkeletonCard variant="text-line" height={12} className="w-32" />
            <SkeletonCard variant="text-line" height={24} className="w-56" />
            <SkeletonCard variant="text-line" height={14} className="w-full max-w-2xl" />
          </div>
          <SkeletonTable rows={5} />
        </div>
      </div>
    );
  }

  const handleBulkUpload = async () => {
    setBulkSyncing(true);
    try {
      const response = await fetch("/api/data-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Veri merkezi yüklemesi başarısız oldu");
      }

      await refreshData();
      showMessage({
        text: data?.message || `${Number(data?.processed_products ?? data?.product_count ?? 0)} ürün veri merkezine yüklendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Data center bulk sync error:", error);
      showMessage({ text: "Tüm ürünler veri merkezine yüklenemedi.", type: "error" });
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleCatalogImport = async () => {
    setCatalogImporting(true);
    try {
      const response = await fetch("/api/data-center/import-marketplace-catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Pazaryeri katalogları içe aktarılamadı");
      }

      await refreshData();
      const importedCount = Number(data?.products_created ?? 0) + Number(data?.products_updated ?? 0);
      showMessage({
        text: data?.message || `${importedCount} ürün pazaryerlerinden içe aktarıldı ve veri merkezi yenilendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Marketplace catalog import error:", error);
      showMessage({ text: "Pazaryeri katalogları içe aktarılamadı.", type: "error" });
    } finally {
      setCatalogImporting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="custom-scrollbar flex w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-surface-container/55 p-1.5 shadow-[var(--shadow-card)]">
        <button
          onClick={() => setActiveTab("products")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "products" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          Ürünler
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "sales" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          Satış Geçmişi
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "settings" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          Mağaza Bilgileri
        </button>
      </div>

      {loadError ? (
        <ErrorStateCard
          title="Veri merkezi güncellenemedi"
          description={loadError}
          action={
            <button
              type="button"
              onClick={() => void refreshData()}
              className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              <RotateCw className="h-4 w-4" />
              Tekrar dene
            </button>
          }
        />
      ) : null}

      {message && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3.5 shadow-[var(--shadow-card)]",
            message.type === "success"
              ? "border-primary/20 bg-primary/10 text-primary"
              : message.type === "warning"
                ? "border-warning/20 bg-warning/10 text-warning"
                : "border-danger/20 bg-danger/10 text-danger"
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
              message.type === "success"
                ? "border-primary/20 bg-primary/15 text-primary"
                : message.type === "warning"
                  ? "border-warning/20 bg-warning/15 text-warning"
                  : "border-danger/20 bg-danger/15 text-danger"
            )}
          >
          {message.type === "success" ? (
            <CircleCheckBig className="h-4 w-4 shrink-0" />
          ) : message.type === "warning" ? (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          ) : (
            <CircleX className="h-4 w-4 shrink-0" />
          )}
          </div>
          <span className="pt-0.5 text-sm font-semibold leading-snug">{message.text}</span>
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-5">
          <GlassCard className="overflow-hidden p-4 sm:p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <h3 className="font-heading text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.2rem]">
                  Ürün verisi olmadan kârlılık ve tahmin hesapları başlamaz.
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-muted">
                  Ürün ekleyin, pazaryeri kataloglarını içe alın ve finans motorunu tekrar çalıştırarak tüm modülleri güncel tutun.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <span className="font-medium text-foreground">{lastBulkSyncSummary}</span>
                  <span>· {lastBulkSyncScope}</span>
                  {stats?.last_bulk_sync_message ? <span>· {stats.last_bulk_sync_message}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductFormOpen(true);
                  }}
                  className="btn-primary h-10 px-4 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Ürün Ekle
                </button>
                <button
                  type="button"
                  onClick={handleCatalogImport}
                  disabled={catalogImporting || submitting || bulkSyncing || loading}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-card disabled:opacity-60"
                >
                  <CloudDownload className={cn("h-4 w-4", catalogImporting && "animate-bounce")} />
                  {catalogImporting ? "Katalog alınıyor..." : "Katalog Al"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={bulkSyncing || submitting || loading}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary/35 hover:bg-primary/15 disabled:opacity-60"
                >
                  <Database className={cn("h-4 w-4", bulkSyncing && "animate-pulse")} />
                  {bulkSyncing ? "Yeniden hesaplanıyor..." : "Yeniden Hesapla"}
                </button>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Toplam Ürün" value={String(productCount)} hint="Katalogta kayıtlı" tone="neutral" icon={Package} />
            <MetricCard label="Aktif Ürün" value={String(activeProductCount)} hint="Satışa açık" tone="profit" icon={CircleCheckBig} />
            <MetricCard label="Ortalama Fiyat" value={formatCurrency(averagePrice)} hint="Liste ortalaması" tone="neutral" icon={CircleDollarSign} />
            <MetricCard label="Ortalama Kâr Marjı" value={`%${Number(averageProfitMargin).toFixed(1)}`} hint="En iyi kanal sonuçları" tone="warning" icon={TrendingUp} />
          </div>

          {selectedIds.length > 0 ? (
            <div className="sticky top-[84px] z-20">
              <GlassCard className="border-border-strong/80 bg-panel/92 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground tabular-nums">{selectedIds.length} ürün seçili</span>
                    <span className="hidden text-xs text-muted md:inline">Seçili ürünlerin durumunu tek hamlede güncelleyin.</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkStatusChange("active")}
                      disabled={submitting}
                      className="rounded-md bg-profit/10 px-3 py-2 text-xs font-semibold text-profit transition-colors duration-200 hover:bg-profit/15 disabled:opacity-60"
                    >
                      Aktif
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkStatusChange("passive")}
                      disabled={submitting}
                      className="rounded-md bg-surface-container/80 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground disabled:opacity-60"
                    >
                      Pasif
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkStatusChange("draft")}
                      disabled={submitting}
                      className="rounded-md bg-stable/10 px-3 py-2 text-xs font-semibold text-stable transition-colors duration-200 hover:bg-stable/15 disabled:opacity-60"
                    >
                      Taslak
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      disabled={submitting}
                      className="rounded-md px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-soft hover:text-foreground disabled:opacity-60"
                    >
                      Temizle
                    </button>
                    <div className="mx-1 hidden h-6 w-px bg-border/80 sm:block" />
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={submitting}
                      className="rounded-md bg-loss/10 px-3 py-2 text-xs font-semibold text-loss transition-colors duration-200 hover:bg-loss/15 disabled:opacity-60"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>
          ) : null}

          {products.length === 0 && !loadError ? (
            <EmptyState
              icon={Database}
              title="Henüz ürün eklemediniz"
              description="Ürün ekleyin veya katalog içe aktarın. Sonra kârlılık ve tahmin modülleri aktif hale gelir."
              className="mx-auto max-w-md"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                    Ürün Ekle
                  </button>
                  <button
                    type="button"
                    onClick={handleCatalogImport}
                    disabled={catalogImporting || submitting || bulkSyncing || loading}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container disabled:opacity-60"
                  >
                    <CloudDownload className={cn("h-4 w-4", catalogImporting && "animate-bounce")} />
                    Katalog Al
                  </button>
                </div>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70 bg-panel/55 shadow-[var(--shadow-card)]">
              <ProductDataTable
                products={products}
                onDelete={handleDeleteProduct}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setIsProductFormOpen(true);
                }}
                selectedIds={selectedIds}
                onToggleSelectAll={(ids, checked) => {
                  setSelectedIds((current) => {
                    if (checked) {
                      return Array.from(new Set([...current, ...ids]));
                    }

                    return current.filter((id) => !ids.includes(id));
                  });
                }}
                onToggleSelect={(id) => {
                  setSelectedIds((current) =>
                    current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
                  );
                }}
                onNotify={showMessage}
                onRefresh={() => {
                  void refreshData();
                }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "sales" && (
        <SalesHistorySection
          products={products}
          onOpenProductsTab={() => {
            setActiveTab("products");
          }}
        />
      )}

      {activeTab === "settings" && (
        <StoreSettingsSection />
      )}

      <ProductDataForm
        isOpen={isProductFormOpen}
        product={editingProduct}
        onClose={() => {
          setIsProductFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSubmitProduct}
        onImagePersisted={async () => {
          await refreshData();
        }}
        isSubmitting={submitting}
      />

      {loading && (
        <div className="fixed bottom-6 left-6 z-[100] rounded-lg border border-border bg-panel/95 px-4 py-3 text-sm text-muted shadow-[var(--shadow-card)] backdrop-blur-2xl">
          Veri merkezi yükleniyor...
        </div>
      )}
    </div>
  );
}
