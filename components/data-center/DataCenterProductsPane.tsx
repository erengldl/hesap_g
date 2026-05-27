"use client";

import { SeedDemoButton } from "@/components/demo/SeedDemoButton";
import { EmptyState, KpiCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import type { SeedDemoResponse } from "@/lib/seed-demo-contract";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BadgePercent,
  CircleCheckBig,
  CloudDownload,
  Database,
  DollarSign,
  FileSpreadsheet,
  Plus,
  Upload,
} from "lucide-react";
import ProductDataTable from "./ProductDataTable";

type ToastMessage = {
  text: string;
  type: "success" | "warning" | "error";
};

type BulkStatus = "active" | "passive" | "draft";

type DataCenterProductsPaneProps = {
  productCount: number;
  activeProductCount: number;
  averagePrice: number;
  averageProfitMargin: number;
  lastBulkSyncSummary: string;
  lastBulkSyncScope: string;
  lastBulkSyncMessage?: string | null;
  demoConfirmMessage: string;
  products: Product[];
  selectedIds: number[];
  submitting: boolean;
  bulkSyncing: boolean;
  catalogImporting: boolean;
  loading: boolean;
  hasLoadError: boolean;
  onSeeded: (result: SeedDemoResponse) => void | Promise<void>;
  onSeedError: (text: string) => void;
  onOpenExcelImport: () => void;
  onExportProducts: () => void;
  onCatalogImport: () => void;
  onBulkUpload: () => void;
  onOpenProductForm: () => void;
  onBulkStatusChange: (status: BulkStatus) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onDeleteProduct: (id: number) => void;
  onEditProduct: (product: Product) => void;
  onToggleSelect: (id: number) => void;
  onNotify: (message: ToastMessage) => void;
  onRefresh: () => Promise<void> | void;
};

export function DataCenterProductsPane({
  productCount,
  activeProductCount,
  averagePrice,
  averageProfitMargin,
  lastBulkSyncSummary,
  lastBulkSyncScope,
  lastBulkSyncMessage,
  demoConfirmMessage,
  products,
  selectedIds,
  submitting,
  bulkSyncing,
  catalogImporting,
  loading,
  hasLoadError,
  onSeeded,
  onSeedError,
  onOpenExcelImport,
  onExportProducts,
  onCatalogImport,
  onBulkUpload,
  onOpenProductForm,
  onBulkStatusChange,
  onBulkDelete,
  onClearSelection,
  onDeleteProduct,
  onEditProduct,
  onToggleSelect,
  onNotify,
  onRefresh,
}: DataCenterProductsPaneProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Ürün Sayısı" value={String(productCount)} subValue="Toplam katalog" icon={Database} />
        <KpiCard title="Aktif Ürün Sayısı" value={String(activeProductCount)} subValue="Satışa açık" icon={CircleCheckBig} tone="success" />
        <KpiCard title="Ortalama Fiyat" value={formatCurrency(averagePrice)} subValue="Liste ortalaması" icon={DollarSign} tone="primary" />
        <KpiCard title="Ortalama Kâr Marjı" value={`%${Number(averageProfitMargin).toFixed(1)}`} subValue="Kanal sonuçlarına göre" icon={BadgePercent} tone="warning" />
      </div>

      <div className="rounded-lg border border-border/70 bg-panel/70 p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/60">Son toplu yükleme</span>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-semibold text-foreground">{lastBulkSyncSummary}</span>
              <span>· {lastBulkSyncScope}</span>
              {lastBulkSyncMessage ? <span>· {lastBulkSyncMessage}</span> : null}
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold text-foreground">Ürünler</h3>
              <p className="mt-1 text-sm text-soft">Ürünleri seç, düzenle ve satış kanallarını tek yerden yönet.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <SeedDemoButton
              confirmMessage={demoConfirmMessage}
              onSeeded={onSeeded}
              onError={onSeedError}
              className="px-3.5 py-2.5"
            />
            <button
              type="button"
              onClick={onOpenExcelImport}
              disabled={submitting || bulkSyncing || loading}
              className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-card disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Excel İçe Aktar
            </button>
            <button
              type="button"
              onClick={onExportProducts}
              disabled={products.length === 0 || submitting || bulkSyncing || loading}
              className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3.5 py-2.5 text-sm font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel Dışa Aktar
            </button>
            <button
              type="button"
              onClick={onCatalogImport}
              disabled={catalogImporting || submitting || bulkSyncing || loading}
              className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-container/70 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-card disabled:opacity-60"
            >
              <CloudDownload className={cn("h-4 w-4", catalogImporting && "animate-bounce")} />
              {catalogImporting ? "Katalog alınıyor..." : "Kataloğu İçe Al"}
            </button>
            <button
              type="button"
              onClick={onBulkUpload}
              disabled={bulkSyncing || submitting || loading}
              className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary/35 hover:bg-primary/15 disabled:opacity-60"
            >
              <Database className={cn("h-4 w-4", bulkSyncing && "animate-pulse")} />
              {bulkSyncing ? "Yeniden hesaplanıyor..." : "Yeniden Hesapla"}
            </button>
            <button type="button" onClick={onOpenProductForm} className="btn-primary px-3.5 py-2.5 text-sm">
              <Plus className="h-4 w-4" />
              Ürün Ekle
            </button>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-surface-container/60 px-3 py-2.5">
            <span className="text-xs font-semibold text-muted">{selectedIds.length} ürün seçili</span>
            <button
              type="button"
              onClick={onExportProducts}
              disabled={submitting}
              className="rounded-md border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
            >
              Excel'e Aktar
            </button>
            <button
              type="button"
              onClick={() => onBulkStatusChange("active")}
              disabled={submitting}
              className="rounded-md bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors duration-200 hover:bg-success/15 disabled:opacity-60"
            >
              Aktif Yap
            </button>
            <button
              type="button"
              onClick={() => onBulkStatusChange("passive")}
              disabled={submitting}
              className="rounded-md border border-border/70 bg-surface-container/70 px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:border-primary/20 hover:bg-card hover:text-foreground disabled:opacity-60"
            >
              Pasif Yap
            </button>
            <button
              type="button"
              onClick={() => onBulkStatusChange("draft")}
              disabled={submitting}
              className="rounded-md bg-info/10 px-3 py-1.5 text-xs font-semibold text-info transition-colors duration-200 hover:bg-info/15 disabled:opacity-60"
            >
              Taslağa Al
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={submitting}
              className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors duration-200 hover:bg-danger/15 disabled:opacity-60"
            >
              Sil
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-soft hover:text-foreground disabled:opacity-60"
            >
              Temizle
            </button>
          </div>
        ) : null}
      </div>

      {products.length === 0 && !hasLoadError ? (
        <EmptyState
          icon={Database}
          title="Henüz ürün eklemediniz"
          description="Ürünleri Veri Merkezi'ne ekleyin ya da kataloğu içe aktarın. Ürünler olmadan kârlılık ve tahmin hesapları başlamaz."
          className="mx-auto max-w-md"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <SeedDemoButton confirmMessage={demoConfirmMessage} onSeeded={onSeeded} onError={onSeedError} />
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
              >
                <Upload className="h-4 w-4" />
                Excel İçe Aktar
              </button>
              <button type="button" onClick={onOpenProductForm} className="btn-primary px-4 py-2.5 text-sm">
                <Plus className="h-4 w-4" />
                Ürün Ekle
              </button>
              <button
                type="button"
                onClick={onCatalogImport}
                disabled={catalogImporting || submitting || bulkSyncing || loading}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container disabled:opacity-60"
              >
                <CloudDownload className={cn("h-4 w-4", catalogImporting && "animate-bounce")} />
                Kataloğu İçe Al
              </button>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-panel/55 shadow-[var(--shadow-card)]">
          <ProductDataTable
            products={products}
            onDelete={onDeleteProduct}
            onEdit={onEditProduct}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onNotify={onNotify}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}
