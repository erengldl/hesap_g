"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, DollarSign, Download, Package, RefreshCcw, Search, ShoppingCart, TrendingUp } from "lucide-react";
import { EmptyState, ErrorStateCard, GlassCard, KpiCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

type SalesHistoryRow = {
  order_id: number;
  order_date: string;
  status: string | null;
  external_order_number: string | null;
  external_package_number: string | null;
  marketplace_name: string | null;
  marketplace_slug: string | null;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type SalesHistorySummary = {
  total_orders: number;
  total_units: number;
  total_revenue: number;
  average_order_value: number;
  unique_products: number;
  active_marketplaces: number;
  top_marketplace_name: string | null;
  top_marketplace_slug: string | null;
  top_marketplace_revenue: number;
  top_product_id: number | null;
  top_product_name: string | null;
  top_product_sku: string | null;
  top_product_units: number;
  top_product_revenue: number;
};

type SalesHistoryResponse = {
  success: boolean;
  view?: string;
  range_days: number;
  applied_range?: {
    from: string;
    to: string;
  };
  pagination?: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
  summary: SalesHistorySummary;
  sales_history: SalesHistoryRow[];
  timestamp: string;
};

type HistoryRangeMode = "30" | "90" | "custom";
type HistoryViewMode = "sales" | "returns";
type HistoryPaginationItem = number | "ellipsis";

function buildPaginationItems(totalPages: number, currentPage: number): HistoryPaginationItem[] {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);

  if (currentPage <= 4) {
    [1, 2, 3, 4, 5].forEach((page) => pages.add(page));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages].forEach((page) => pages.add(page));
  } else {
    [currentPage - 1, currentPage, currentPage + 1].forEach((page) => pages.add(page));
  }

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)
    .flatMap((page, index, list) => {
      if (index === 0) {
        return [page];
      }

      const previous = list[index - 1];
      return page - previous > 1 ? ["ellipsis", page] : [page];
    });
}

function statusCopy(status?: string | null) {
  switch (status) {
    case "completed":
      return { label: "Tamamlandı", className: "border-primary/20 bg-primary/10 text-primary" };
    case "processing":
      return { label: "İşleniyor", className: "border-warning/20 bg-warning/10 text-warning" };
    case "pending":
      return { label: "Bekliyor", className: "border-info/20 bg-info/10 text-info" };
    case "returned":
      return { label: "İade", className: "border-danger/20 bg-danger/10 text-danger" };
    case "cancelled":
      return { label: "İptal", className: "border-zinc-500/20 bg-zinc-500/10 text-soft" };
    default:
      return { label: "Bilinmiyor", className: "border-border bg-surface-container text-soft" };
  }
}

export default function SalesHistorySection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesHistorySummary | null>(null);
  const [rows, setRows] = useState<SalesHistoryRow[]>([]);
  const [pagination, setPagination] = useState<SalesHistoryResponse["pagination"] | null>(null);
  const [viewMode, setViewMode] = useState<HistoryViewMode>("sales");
  const [rangeMode, setRangeMode] = useState<HistoryRangeMode>("90");
  const [page, setPage] = useState(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string; days: number } | null>(null);

  const buildQuery = useCallback((view: HistoryViewMode, mode: HistoryRangeMode, pageNumber: number, from?: string, to?: string) => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("page", String(pageNumber));

    if (mode === "custom" && from && to) {
      params.set("from", from);
      params.set("to", to);
      return params.toString();
    }

    params.set("days", mode === "30" ? "30" : "90");
    return params.toString();
  }, []);

  const loadSalesHistory = useCallback(async (view: HistoryViewMode, mode: HistoryRangeMode, pageNumber: number, from?: string, to?: string) => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQuery(view, mode, pageNumber, from, to);
      const response = await fetch(`/api/data-center/sales-history?${queryString}`, { cache: "no-store" });
      const json = (await response.json()) as Partial<SalesHistoryResponse> & { error?: string };

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Satış geçmişi yüklenemedi.");
      }

      setSummary(json.summary ?? null);
      setRows(Array.isArray(json.sales_history) ? json.sales_history : []);
      setPagination(json.pagination ?? null);
      setPage(json.pagination?.page ?? pageNumber);
      if (json.applied_range?.from && json.applied_range?.to) {
        setAppliedRange({
          from: json.applied_range.from,
          to: json.applied_range.to,
          days: Number(json.range_days ?? 0),
        });
      } else {
        setAppliedRange(null);
      }
    } catch (fetchError) {
      setSummary(null);
      setRows([]);
      setPagination(null);
      setAppliedRange(null);
      setError(fetchError instanceof Error ? fetchError.message : "Satış geçmişi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadSalesHistory("sales", "90", 1);
  }, [loadSalesHistory]);

  const isReturnsView = viewMode === "returns";

  const currentRangeLabel = (() => {
    if (rangeMode === "custom" && appliedRange?.from && appliedRange?.to) {
      return `${formatDate(appliedRange.from)} - ${formatDate(appliedRange.to)}`;
    }

    if (rangeMode === "custom") {
      return "Özel aralık";
    }

    return rangeMode === "30" ? "Son 30 gün" : "Son 90 gün";
  })();

  function downloadCsv() {
    if (rows.length === 0) return;

    const headers = [
      "Tarih",
      "Urun",
      "Kod",
      "Kanal",
      "Siparis",
      "Paket",
      "Adet",
      "Birim",
      "Tutar",
      "Durum",
    ];

    const escapeCsv = (value: string) => {
      if (/[",\n;]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const body = rows.map((row) => [
      formatDate(row.order_date),
      row.product_name ?? "Urun",
      row.product_sku ?? "",
      row.marketplace_name ?? "Kanal",
      row.external_order_number ?? `#${row.order_id}`,
      row.external_package_number ?? "",
      String(row.quantity),
      formatCurrency(row.unit_price),
      formatCurrency(row.line_total),
      row.status ?? "completed",
    ].map((value) => escapeCsv(String(value))).join(";"));

    const csv = ["\ufeff" + headers.join(";"), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileDate = new Date().toISOString().slice(0, 10);
    const filePrefix = isReturnsView ? "iadeler" : "satis-gecmisi";
    anchor.href = url;
    anchor.download = `${filePrefix}-${fileDate}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const from = String(formData.get("custom_from") ?? "");
    const to = String(formData.get("custom_to") ?? "");

    if (!from || !to) {
      setError("Özel aralık için başlangıç ve bitiş tarihi seçin.");
      return;
    }

    setRangeMode("custom");
    setCustomFrom(from);
    setCustomTo(to);
    setPage(1);
    void loadSalesHistory(viewMode, "custom", 1, from, to);
  }

  function setQuickRange(nextMode: Exclude<HistoryRangeMode, "custom">) {
    setRangeMode(nextMode);
    setPage(1);
    void loadSalesHistory(viewMode, nextMode, 1);
  }

  function setView(nextView: HistoryViewMode) {
    setViewMode(nextView);
    setPage(1);
    void loadSalesHistory(nextView, rangeMode, 1, customFrom, customTo);
  }

  function openCustomRange() {
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    if (!customFrom) setCustomFrom(start.toISOString().slice(0, 10));
    if (!customTo) setCustomTo(today);
    setRangeMode("custom");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-foreground">Satış geçmişi</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentRangeLabel} içindeki {isReturnsView ? "iade kayıtları" : "tamamlanan satışlar"}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSalesHistory(viewMode, rangeMode, page, customFrom, customTo)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-container"
          >
            <RefreshCcw className="h-4 w-4" />
            Yenile
          </button>
        </div>

        <ErrorStateCard
          title="Satış geçmişi yüklenemedi"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void loadSalesHistory(viewMode, rangeMode, page, customFrom, customTo)}
              className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </button>
          }
        />
      </div>
    );
  }

  const summaryData = summary ?? {
    total_orders: 0,
    total_units: 0,
    total_revenue: 0,
    average_order_value: 0,
    unique_products: 0,
    active_marketplaces: 0,
    top_marketplace_name: null,
    top_marketplace_slug: null,
    top_marketplace_revenue: 0,
    top_product_id: null,
    top_product_name: null,
    top_product_sku: null,
    top_product_units: 0,
    top_product_revenue: 0,
  };
  const totalRows = pagination?.total_rows ?? rows.length;
  const totalPages = pagination?.total_pages ?? 0;
  const currentPage = pagination?.page ?? page;
  const paginationItems = buildPaginationItems(totalPages, currentPage);

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage === currentPage) {
      return;
    }

    setPage(nextPage);
    void loadSalesHistory(viewMode, rangeMode, nextPage, customFrom, customTo);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-heading text-xl font-semibold text-foreground">Satış geçmişi</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentRangeLabel} içindeki {isReturnsView ? "iade kayıtları" : "tamamlanan satışlar"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView("sales")}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
              !isReturnsView
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
            )}
          >
            Satışlar
          </button>
          <button
            type="button"
            onClick={() => setView("returns")}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
              isReturnsView
                ? "border-danger/20 bg-danger/10 text-danger"
                : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
            )}
          >
            İadeler
          </button>
          <button
            type="button"
            onClick={() => setQuickRange("30")}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
              rangeMode === "30"
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
            )}
          >
            Son 30 gün
          </button>
          <button
            type="button"
            onClick={() => setQuickRange("90")}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
              rangeMode === "90"
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
            )}
          >
            Son 90 gün
          </button>
          <button
            type="button"
            onClick={openCustomRange}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
              rangeMode === "custom"
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
            )}
          >
            Özel aralık
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            CSV indir
          </button>
          <button
            type="button"
            onClick={() => void loadSalesHistory(viewMode, rangeMode, page, customFrom, customTo)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Yenile
          </button>
        </div>
      </div>

      {rangeMode === "custom" && (
        <GlassCard className="border-border bg-surface-container">
          <form onSubmit={applyCustomRange}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 lg:flex-1">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Başlangıç</span>
                <input
                  name="custom_from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted focus:border-primary/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Bitiş</span>
                <input
                  name="custom_to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted focus:border-primary/30"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors duration-200 hover:bg-primary/90"
              >
                <Search className="h-4 w-4" />
                Uygula
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeMode("90");
                  setPage(1);
                  void loadSalesHistory(viewMode, "90", 1);
                }}
                className="rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
              >
                Sıfırla
              </button>
            </div>
          </div>
          </form>
        </GlassCard>
      )}

      <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted">
        <span>{formatNumber(rows.length)} kayıt</span>
        <span className="h-3 w-px bg-border/80" />
        <span>{formatNumber(summaryData.unique_products)} ürün</span>
        <span className="h-3 w-px bg-border/80" />
        <span>{formatNumber(summaryData.active_marketplaces)} kanal</span>
        {pagination && (
          <>
            <span className="h-3 w-px bg-border/80" />
            <span>Toplam {formatNumber(totalRows)} satır</span>
            <span className="h-3 w-px bg-border/80" />
            <span>Sayfa {currentPage}/{Math.max(totalPages, 1)}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={isReturnsView ? "İade siparişi" : "Sipariş"}
          value={formatNumber(summaryData.total_orders)}
          subValue={isReturnsView ? "İade edilen siparişler" : "Tamamlanan siparişler"}
          icon={ShoppingCart}
        />
        <KpiCard
          title={isReturnsView ? "İade adet" : "Adet"}
          value={formatNumber(summaryData.total_units)}
          subValue={isReturnsView ? "İade edilen toplam adet" : "Satılan toplam adet"}
          icon={Package}
        />
        <KpiCard
          title="Ciro"
          value={formatCurrency(summaryData.total_revenue)}
          subValue={currentRangeLabel}
          icon={DollarSign}
          tone="primary"
        />
        <KpiCard
          title={isReturnsView ? "Ortalama iade" : "Ortalama sipariş"}
          value={formatCurrency(summaryData.average_order_value)}
          subValue={isReturnsView ? "İade başına" : "Sipariş başına"}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="border-border bg-surface-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {isReturnsView ? "En çok iade alan kanal" : "En yüksek ciro"}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {summaryData.top_marketplace_name ?? "Henüz öne çıkan kanal yok"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatCurrency(summaryData.top_marketplace_revenue)} {isReturnsView ? "iade tutarı" : "ciro"}
            {summaryData.top_marketplace_slug ? ` · ${summaryData.top_marketplace_slug}` : ""}
          </p>
        </GlassCard>

        <GlassCard className="border-border bg-surface-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {isReturnsView ? "En çok iade edilen ürün" : "En çok satılan ürün"}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {summaryData.top_product_name ?? "Henüz öne çıkan ürün yok"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(summaryData.top_product_units)} {isReturnsView ? "adet iade" : "adet"}
            {summaryData.top_product_sku ? ` · Kod: ${summaryData.top_product_sku}` : ""}
          </p>
        </GlassCard>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CircleAlert}
          title={isReturnsView ? "İade kaydı yok" : "Satış kaydı yok"}
          description={isReturnsView ? "Bu zaman aralığında iade bulunamadı." : "Bu zaman aralığında tamamlanan satış bulunamadı."}
          action={
            <button
              type="button"
              onClick={() => {
                const nextRange = rangeMode === "30" ? "90" : "30";
                setQuickRange(nextRange);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
            >
              <Search className="h-4 w-4" />
              {rangeMode === "30" ? "Son 90 Gün" : "Son 30 Gün"}
            </button>
          }
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden border-border bg-surface-container">
          <div className="flex flex-col gap-1 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-lg font-bold tracking-tight text-foreground">Son satışlar</h4>
              <p className="text-sm text-muted-foreground">Tarih, ürün, kanal ve sipariş bilgileri.</p>
            </div>
            <p className="text-xs font-semibold text-muted">{formatNumber(rows.length)} satır</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="bg-surface-container text-[10px] uppercase tracking-[0.18em] text-muted">
                  <th className="px-5 py-3 font-semibold">Tarih</th>
                  <th className="px-5 py-3 font-semibold">Ürün</th>
                  <th className="px-5 py-3 font-semibold">Kanal</th>
                  <th className="px-5 py-3 font-semibold">Sipariş</th>
                  <th className="px-5 py-3 font-semibold text-right">Adet</th>
                  <th className="px-5 py-3 font-semibold text-right">Birim</th>
                  <th className="px-5 py-3 font-semibold text-right">Tutar</th>
                  <th className="px-5 py-3 font-semibold text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.length > 0 ? (
                  rows.map((row) => {
                    const status = statusCopy(row.status);
                    return (
                      <tr key={`${row.order_id}-${row.external_order_number ?? row.product_id ?? row.order_id}`} className="transition-colors duration-200 hover:bg-surface-container">
                        <td className="px-5 py-4 text-xs text-soft">{formatDate(row.order_date)}</td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {row.product_id ? (
                              <Link href={`/products/${row.product_id}`} className="block text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary">
                                {row.product_name ?? "Ürün"}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">{row.product_name ?? "Ürün"}</p>
                            )}
                            <p className="text-[11px] text-muted">
                              {row.product_sku ? `Kod: ${row.product_sku}` : "Kod yok"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{row.marketplace_name ?? "Kanal"}</p>
                            <p className="text-[11px] text-muted">{row.marketplace_slug ?? "market"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{row.external_order_number ?? `#${row.order_id}`}</p>
                            <p className="text-[11px] text-muted">{row.external_package_number ?? "Paket numarası yok"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-soft">{formatNumber(row.quantity)}</td>
                        <td className="px-5 py-4 text-right text-sm text-soft">{formatCurrency(row.unit_price)}</td>
                        <td className="px-5 py-4 text-right text-sm font-bold text-primary">{formatCurrency(row.line_total)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", status.className)}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-8">
                      <EmptyState
                        icon={CircleAlert}
                        title="Satış kaydı bulunamadı"
                        description="Bu tarih aralığında kayıt görünmüyor. Farklı bir aralığı deneyin ya da satış görünümünü değiştirin."
                        variant="inline"
                        className="mx-auto max-w-md"
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              const nextRange = rangeMode === "30" ? "90" : "30";
                              setQuickRange(nextRange);
                            }}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
                          >
                            <Search className="h-4 w-4" />
                            {rangeMode === "30" ? "Son 90 Gün" : "Son 30 Gün"}
                          </button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.total_pages > 1 && (
            <div className="flex flex-col gap-3 border-t border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                {formatNumber(pagination.total_rows)} satır · Sayfa {pagination.page} / {pagination.total_pages}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded-full border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Önceki
                </button>

                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-xs font-semibold text-muted">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToPage(item)}
                      className={cn(
                        "min-w-10 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
                        item === pagination.page
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-border bg-surface-container text-muted hover:bg-surface-container hover:text-foreground"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className="rounded-full border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
