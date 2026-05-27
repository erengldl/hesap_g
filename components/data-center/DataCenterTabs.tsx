"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheckBig, CircleX, RotateCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMMAND_ACTION_EVENT,
  type CommandActionEventDetail,
  type CommandActionKey,
  popQueuedCommandAction,
} from "@/lib/command-actions";
import { exportProductsToExcel } from "@/lib/excel";
import { triggerSeedDemo } from "@/components/demo/SeedDemoButton";
import type { Product, ProductUpsertInput } from "@/lib/types";
import type { SeedDemoResponse } from "@/lib/seed-demo-contract";
import { ErrorStateCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";

import { DataCenterProductsPane } from "./DataCenterProductsPane";
import { ProductExcelImportModal } from "./ProductExcelImportModal";
import ProductDataForm from "./ProductDataForm";
import SalesHistorySection from "./SalesHistorySection";
import { SellerProfileForm } from "./SellerProfileForm";
import { StoreExpensesSection } from "./StoreExpensesSection";
import { OwnWebsiteSettingsForm } from "./OwnWebsiteSettingsForm";

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

type DataCenterTab = "products" | "sales" | "settings";

const DEMO_SEED_CONFIRM_MESSAGE =
  "Demo verisi çalışma alanınıza yüklenecek. Mevcut kişisel verileriniz yenilenecek. Devam edilsin mi?";

function formatRelativeTime(value?: string | null) {
  if (!value) return "Henüz işlem yapılmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz işlem yapılmadı";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Şimdi";
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gün önce`;
}

export function DataCenterTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DataCenterTab>("products");
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [catalogImporting, setCatalogImporting] = useState(false);
  const [demoSeeding, setDemoSeeding] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

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
        Array.isArray(productsData?.products) && productsData.products.length > 0
          ? (productsData.products as Product[])
          : [];
      setLoadError(null);
      setProducts(nextProducts);
      setSelectedIds((current) => current.filter((id) => nextProducts.some((product) => product.id === id)));
      return nextProducts;
    } catch (error) {
      console.error("Failed to refresh data", error);
      setStats(null);
      setLoadError("Veri Merkezi yüklenemedi. Sunucu bağlantısı kesildi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      setProducts([]);
      setSelectedIds([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const updateTabUrl = useCallback((nextTab: DataCenterTab) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextTab === "products") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }

    if (nextTab !== "sales") {
      params.delete("search");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const activateTab = useCallback((nextTab: DataCenterTab) => {
    setActiveTab(nextTab);
    updateTabUrl(nextTab);
  }, [updateTabUrl]);

  useEffect(() => {
    const nextTabParam = searchParams.get("tab");
    const nextTab: DataCenterTab =
      nextTabParam === "sales" || nextTabParam === "settings" ? nextTabParam : "products";
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const showMessage = useCallback((nextMessage: ToastMessage) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const handleProductExcelExport = () => {
    const exportProducts =
      selectedIds.length > 0
        ? products.filter((product) => selectedIds.includes(product.id))
        : products;

    if (exportProducts.length === 0) {
      showMessage({ text: "Dışa aktarılacak ürün bulunamadı.", type: "warning" });
      return;
    }

    exportProductsToExcel(exportProducts);
    showMessage({
      text:
        selectedIds.length > 0
          ? `${selectedIds.length} seçili ürün Excel olarak indirildi.`
          : `${exportProducts.length} ürün Excel olarak indirildi.`,
      type: "success",
    });
  };

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
    ? "Pazaryeri kataloğu içe aktarma"
    : stats?.last_bulk_sync_scope === "all_products"
      ? "Veri Merkezi yeniden hesaplama"
      : stats?.last_bulk_sync_scope ?? "İşlem yok";

  const handleBulkUpload = async () => {
    setBulkSyncing(true);
    try {
      const response = await fetch("/api/data-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Veri Merkezi yüklemesi başarısız oldu");
      }

      await refreshData();
      showMessage({
        text: data?.message || `${Number(data?.processed_products ?? data?.product_count ?? 0)} ürün Veri Merkezi'ne yüklendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Data center bulk sync error:", error);
      showMessage({ text: "Tüm ürünler Veri Merkezi'ne yüklenemedi.", type: "error" });
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
        text: data?.message || `${importedCount} ürün pazaryerlerinden içe aktarıldı ve Veri Merkezi yenilendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Marketplace catalog import error:", error);
      showMessage({ text: "Pazaryeri katalogları içe aktarılamadı.", type: "error" });
    } finally {
      setCatalogImporting(false);
    }
  };

  const handleSeedDemoSuccess = useCallback(async (result: SeedDemoResponse) => {
    await refreshData();
    showMessage({
      text: result.message,
      type: "warning",
    });
  }, [refreshData, showMessage]);

  const handleSeedDemoAction = useCallback(async () => {
    if (demoSeeding) {
      return;
    }

    setDemoSeeding(true);
    try {
      await triggerSeedDemo({
        confirmMessage: DEMO_SEED_CONFIRM_MESSAGE,
        onSeeded: handleSeedDemoSuccess,
        onError: (text) => showMessage({ text, type: "error" }),
      });
    } finally {
      setDemoSeeding(false);
    }
  }, [demoSeeding, handleSeedDemoSuccess, showMessage]);

  const runCommandAction = useCallback(async (action: CommandActionKey) => {
    activateTab("products");

    switch (action) {
      case "open-product-form":
        setEditingProduct(null);
        setIsProductFormOpen(true);
        return;
      case "open-excel-import":
        setIsExcelImportOpen(true);
        return;
      case "seed-demo-data":
        await handleSeedDemoAction();
        return;
      default:
        return;
    }
  }, [activateTab, handleSeedDemoAction]);

  useEffect(() => {
    const queuedAction = popQueuedCommandAction();
    if (queuedAction) {
      void runCommandAction(queuedAction);
    }

    const handleCommandAction = (event: Event) => {
      const action = (event as CustomEvent<CommandActionEventDetail>).detail?.action;
      if (!action) {
        return;
      }

      void runCommandAction(action);
    };

    window.addEventListener(COMMAND_ACTION_EVENT, handleCommandAction);
    return () => window.removeEventListener(COMMAND_ACTION_EVENT, handleCommandAction);
  }, [runCommandAction]);

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

  return (
    <div className="w-full space-y-6">
      <div className="custom-scrollbar flex w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-surface-container/55 p-1.5 shadow-[var(--shadow-card)]">
                <button
          onClick={() => activateTab("products")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "products" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          Ürünler
        </button>
                <button
          onClick={() => activateTab("sales")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "sales" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          Satış Geçmişi
        </button>
                <button
          onClick={() => activateTab("settings")}
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
          title="Veri Merkezi güncellenemedi"
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
        <DataCenterProductsPane
          productCount={productCount}
          activeProductCount={activeProductCount}
          averagePrice={averagePrice}
          averageProfitMargin={averageProfitMargin}
          lastBulkSyncSummary={lastBulkSyncSummary}
          lastBulkSyncScope={lastBulkSyncScope}
          lastBulkSyncMessage={stats?.last_bulk_sync_message}
          demoConfirmMessage={DEMO_SEED_CONFIRM_MESSAGE}
          products={products}
          selectedIds={selectedIds}
          submitting={submitting}
          bulkSyncing={bulkSyncing}
          catalogImporting={catalogImporting}
          loading={loading}
          hasLoadError={Boolean(loadError)}
          onSeeded={handleSeedDemoSuccess}
          onSeedError={(text) => showMessage({ text, type: "error" })}
          onOpenExcelImport={() => setIsExcelImportOpen(true)}
          onExportProducts={handleProductExcelExport}
          onCatalogImport={handleCatalogImport}
          onBulkUpload={handleBulkUpload}
          onOpenProductForm={() => {
            setEditingProduct(null);
            setIsProductFormOpen(true);
          }}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds([])}
          onDeleteProduct={handleDeleteProduct}
          onEditProduct={(product) => {
            setEditingProduct(product);
            setIsProductFormOpen(true);
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
      )}

      {activeTab === "sales" && (
        <SalesHistorySection
          key={`sales-${searchParams.get("search") ?? "default"}`}
        />
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <OwnWebsiteSettingsForm />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <StoreExpensesSection />
            <SellerProfileForm />
          </div>
        </div>
      )}

      <ProductExcelImportModal
        open={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImported={async () => {
          await refreshData();
        }}
        onNotify={showMessage}
      />

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
          Veri Merkezi yükleniyor...
        </div>
      )}
    </div>
  );
}
