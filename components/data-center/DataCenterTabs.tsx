"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgePercent, CircleCheckBig, CircleX, CloudDownload, Database, DollarSign, FileSpreadsheet, Plus, RotateCw, TriangleAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMMAND_ACTION_EVENT,
  type CommandActionEventDetail,
  type CommandActionKey,
  popQueuedCommandAction,
} from "@/lib/command-actions";
import { exportProductsToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/formatters";
import { SeedDemoButton, triggerSeedDemo } from "@/components/demo/SeedDemoButton";
import type { Product, ProductUpsertInput } from "@/lib/types";
import { DEMO_PRODUCTS } from "@/lib/demo-data";
import type { SeedDemoResponse } from "@/lib/seed-demo-contract";
import { EmptyState, ErrorStateCard, KpiCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";

import ProductDataTable from "./ProductDataTable";
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

function formatRelativeTime(value?: string | null) {
  if (!value) return "HenÃ¼z iÅŸlem yapÄ±lmadÄ±";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "HenÃ¼z iÅŸlem yapÄ±lmadÄ±";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "ÅŸimdi";
  if (diffMinutes < 60) return `${diffMinutes} dk Ã¶nce`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa Ã¶nce`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gÃ¼n Ã¶nce`;
}

export function DataCenterTabs() {
  const useDemoData = process.env.NODE_ENV !== "production";
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
      setLoadError("Veri merkezi yÃ¼klenemedi. Sunucu baÄŸlantÄ±sÄ± kesildi. Ä°nternet baÄŸlantÄ±nÄ±zÄ± kontrol edip tekrar deneyin.");
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
      showMessage({ text: "DÄ±ÅŸa aktarÄ±lacak Ã¼rÃ¼n bulunamadÄ±.", type: "warning" });
      return;
    }

    exportProductsToExcel(exportProducts);
    showMessage({
      text:
        selectedIds.length > 0
          ? `${selectedIds.length} seÃ§ili Ã¼rÃ¼n Excel olarak indirildi.`
          : `${exportProducts.length} Ã¼rÃ¼n Excel olarak indirildi.`,
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
        throw new Error(data?.error || "ÃœrÃ¼n kaydedilemedi");
      }

      await refreshData();
      setIsProductFormOpen(false);
      setEditingProduct(null);
      showMessage({
        text: isEdit ? "ÃœrÃ¼n gÃ¼ncellendi ve maliyet sonuÃ§larÄ± yenilendi." : "ÃœrÃ¼n eklendi ve maliyet sonuÃ§larÄ± Ã¼retildi.",
        type: "success",
      });
    } catch (error) {
      console.error("Product save error:", error);
      showMessage({ text: "ÃœrÃ¼n kaydedilemedi.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    const product = products.find((item) => item.id === productId);
    const confirmed = window.confirm(`${product?.name ?? "Bu Ã¼rÃ¼n"} silinsin mi? Bu iÅŸlem geri alÄ±namaz.`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "ÃœrÃ¼n silinemedi");
      }

      await refreshData();
      showMessage({ text: "ÃœrÃ¼n silindi.", type: "success" });
    } catch (error) {
      console.error("Product delete error:", error);
      showMessage({ text: "ÃœrÃ¼n silinemedi.", type: "error" });
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
            throw new Error(data?.error || `ÃœrÃ¼n ${id} gÃ¼ncellenemedi`);
          }
        })
      );

      await refreshData();
      setSelectedIds([]);
      showMessage({ text: "SeÃ§ili Ã¼rÃ¼nler gÃ¼ncellendi.", type: "success" });
    } catch (error) {
      console.error("Bulk status update error:", error);
      showMessage({ text: "Toplu gÃ¼ncelleme yapÄ±lamadÄ±.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`${selectedIds.length} Ã¼rÃ¼n silinsin mi? Bu iÅŸlem geri alÄ±namaz.`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || `ÃœrÃ¼n ${id} silinemedi`);
          }
        })
      );
      await refreshData();
      setSelectedIds([]);
      showMessage({ text: "SeÃ§ili Ã¼rÃ¼nler silindi.", type: "success" });
    } catch (error) {
      console.error("Bulk delete error:", error);
      showMessage({ text: "Toplu silme yapÄ±lamadÄ±.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const productCount = stats?.product_count ?? products.length;
  const activeProductCount = stats?.active_product_count ?? products.filter((item) => item.status === "active").length;
  const averagePrice = stats?.average_price ?? (products.reduce((sum, item) => sum + Number(item.sale_price ?? 0), 0) / Math.max(1, products.length));
  const averageProfitMargin = stats?.average_profit_margin ?? 0;
  const lastBulkSyncSummary = stats?.last_bulk_sync_time
    ? `${formatRelativeTime(stats.last_bulk_sync_time)} Â· ${Number(stats.last_bulk_sync_count ?? 0)} Ã¼rÃ¼n`
    : "HenÃ¼z toplu iÅŸlem yapÄ±lmadÄ±";
  const lastBulkSyncScope = stats?.last_bulk_sync_scope === "marketplace_catalog_import"
    ? "Pazaryeri katalog iÃ§e aktarma"
    : stats?.last_bulk_sync_scope === "all_products"
      ? "Veri merkezi yeniden hesaplama"
      : stats?.last_bulk_sync_scope ?? "Ä°ÅŸlem yok";

  const handleBulkUpload = async () => {
    setBulkSyncing(true);
    try {
      const response = await fetch("/api/data-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Veri merkezi yÃ¼klemesi baÅŸarÄ±sÄ±z oldu");
      }

      await refreshData();
      showMessage({
        text: data?.message || `${Number(data?.processed_products ?? data?.product_count ?? 0)} Ã¼rÃ¼n veri merkezine yÃ¼klendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Data center bulk sync error:", error);
      showMessage({ text: "TÃ¼m Ã¼rÃ¼nler veri merkezine yÃ¼klenemedi.", type: "error" });
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
        throw new Error(data?.error || "Pazaryeri kataloglarÄ± iÃ§e aktarÄ±lamadÄ±");
      }

      await refreshData();
      const importedCount = Number(data?.products_created ?? 0) + Number(data?.products_updated ?? 0);
      showMessage({
        text: data?.message || `${importedCount} Ã¼rÃ¼n pazaryerlerinden iÃ§e aktarÄ±ldÄ± ve veri merkezi yenilendi.`,
        type: "success",
      });
    } catch (error) {
      console.error("Marketplace catalog import error:", error);
      showMessage({ text: "Pazaryeri kataloglarÄ± iÃ§e aktarÄ±lamadÄ±.", type: "error" });
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
        confirmMessage: "Demo veriler yuklenecek. Mevcut veriler silinecek. Devam edilsin mi?",
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
          ÃœrÃ¼nler
        </button>
        <button
          onClick={() => activateTab("sales")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "sales" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          SatÄ±ÅŸ GeÃ§miÅŸi
        </button>
        <button
          onClick={() => activateTab("settings")}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
            activeTab === "settings" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          )}
        >
          MaÄŸaza Bilgileri
        </button>
      </div>

      {loadError ? (
        <ErrorStateCard
          title="Veri merkezi gÃ¼ncellenemedi"
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="ÃœrÃ¼n SayÄ±sÄ±" value={String(productCount)} subValue="Toplam katalog" icon={Database} />
            <KpiCard title="Aktif ÃœrÃ¼n SayÄ±sÄ±" value={String(activeProductCount)} subValue="SatÄ±ÅŸa aÃ§Ä±k" icon={CircleCheckBig} tone="success" />
            <KpiCard title="Ortalama Fiyat" value={formatCurrency(averagePrice)} subValue="Liste ortalamasÄ±" icon={DollarSign} tone="primary" />
            <KpiCard title="Ortalama KÃ¢r MarjÄ±" value={`%${Number(averageProfitMargin).toFixed(1)}`} subValue="Kanal sonuÃ§larÄ±na gÃ¶re" icon={BadgePercent} tone="warning" />
          </div>

          <div className="rounded-lg border border-border/70 bg-panel/70 p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Son toplu yÃ¼kleme</span>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="font-semibold text-foreground">{lastBulkSyncSummary}</span>
                  <span>Â· {lastBulkSyncScope}</span>
                  {stats?.last_bulk_sync_message && (
                    <span>Â· {stats.last_bulk_sync_message}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">ÃœrÃ¼nler</h3>
                  <p className="mt-1 text-sm text-muted-foreground">ÃœrÃ¼nleri seÃ§, dÃ¼zenle ve satÄ±ÅŸ kanallarÄ±nÄ± tek yerden yÃ¶net.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <SeedDemoButton
                  confirmMessage="Demo veriler yÃ¼klenecek. Mevcut veriler silinecek. Devam edilsin mi?"
                  onSeeded={handleSeedDemoSuccess}
                  onError={(text) => showMessage({ text, type: "error" })}
                  className="px-3.5 py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setIsExcelImportOpen(true)}
                  disabled={submitting || bulkSyncing || loading}
                  className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-card disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  Excel Ä°Ã§e Aktar
                </button>
                <button
                  type="button"
                  onClick={handleProductExcelExport}
                  disabled={products.length === 0 || submitting || bulkSyncing || loading}
                  className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3.5 py-2.5 text-sm font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel DÄ±ÅŸa Aktar
                </button>
                <button
                  type="button"
                  onClick={handleCatalogImport}
                  disabled={catalogImporting || submitting || bulkSyncing || loading}
                  className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-card disabled:opacity-60"
                >
                  <CloudDownload className={cn("h-4 w-4", catalogImporting && "animate-bounce")} />
                  {catalogImporting ? "Katalog alÄ±nÄ±yor..." : "Katalog Al"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={bulkSyncing || submitting || loading}
                  className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary/35 hover:bg-primary/15 disabled:opacity-60"
                >
                  <Database className={cn("h-4 w-4", bulkSyncing && "animate-pulse")} />
                  {bulkSyncing ? "Yeniden hesaplanÄ±yor..." : "Yeniden Hesapla"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductFormOpen(true);
                  }}
                  className="btn-primary px-3.5 py-2.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  ÃœrÃ¼n Ekle
                </button>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-surface-container/60 px-3 py-2.5">
                <span className="text-xs font-semibold text-muted">{selectedIds.length} Ã¼rÃ¼n seÃ§ili</span>
                <button
                  type="button"
                  onClick={handleProductExcelExport}
                  disabled={submitting}
                  className="rounded-md border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
                >
                  Excel'e Aktar
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange("active")}
                  disabled={submitting}
                  className="rounded-md bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
                >
                  Aktif Yap
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange("passive")}
                  disabled={submitting}
                  className="rounded-md border border-border/70 bg-surface-container/70 px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-primary/20 hover:bg-card hover:text-foreground disabled:opacity-60"
                >
                  Pasif Yap
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange("draft")}
                  disabled={submitting}
                  className="rounded-md bg-info/10 px-3 py-1.5 text-xs font-semibold text-info transition-colors duration-200 hover:bg-info/15 disabled:opacity-60"
                >
                  TaslaÄŸa Al
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={submitting}
                  className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors duration-200 hover:bg-danger/15 disabled:opacity-60"
                >
                  Sil
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={submitting}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-soft hover:text-foreground disabled:opacity-60"
                >
                  Temizle
                </button>
              </div>
            )}
          </div>

          {products.length === 0 && !loadError ? (
            <EmptyState
              icon={Database}
              title="HenÃ¼z Ã¼rÃ¼n eklemediniz"
              description="ÃœrÃ¼nleri Veri Merkezi'ne ekleyin ya da katalogu iÃ§e aktarÄ±n. ÃœrÃ¼nler olmadan kÃ¢rlÄ±lÄ±k ve tahmin hesaplarÄ± baÅŸlamaz."
              className="mx-auto max-w-md"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <SeedDemoButton
                    onSeeded={handleSeedDemoSuccess}
                    onError={(text) => showMessage({ text, type: "error" })}
                  />
                  <button
                    type="button"
                    onClick={() => setIsExcelImportOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
                  >
                    <Upload className="h-4 w-4" />
                    Excel Ä°Ã§e Aktar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductFormOpen(true);
                    }}
                    className="btn-primary px-4 py-2.5 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    ÃœrÃ¼n Ekle
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
          Veri merkezi yÃ¼kleniyor...
        </div>
      )}
    </div>
  );
}
