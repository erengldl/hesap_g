"use client";

import { useCallback, useDeferredValue, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarRange,
  CircleAlert,
  LineChart,
  Package,
  RefreshCcw,
  Search,
  ShoppingCart,
  Store,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartCard,
  EmptyState,
  ErrorStateCard,
  FinancialTooltip,
  GlassCard,
  KpiCard,
  SkeletonCard,
  SkeletonTable,
  StatusBadge,
} from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { Product } from "@/lib/types";
import type { SalesHistoryDataQuality, SalesHistoryTrendPoint } from "@/lib/sales-history-insights";
import { cn } from "@/lib/utils";

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
  active_sales_days: number;
  average_daily_units: number;
};

type MarketplaceOption = {
  marketplace_name: string | null;
  marketplace_slug: string | null;
  order_count: number;
};

type SalesHistoryResponse = {
  success: boolean;
  range_days: number;
  applied_range?: {
    from: string;
    to: string;
  };
  filters?: {
    marketplace_options?: MarketplaceOption[];
  };
  pagination?: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
  summary?: SalesHistorySummary;
  trend?: SalesHistoryTrendPoint[];
  data_quality?: SalesHistoryDataQuality;
  sales_history?: SalesHistoryRow[];
};

type HistoryRangeMode = "30" | "90" | "180" | "custom";
type TableStatusFilter = "all" | "completed" | "processing" | "returned" | "cancelled";

type QueryState = {
  rangeMode: HistoryRangeMode;
  page: number;
  productId: string;
  marketplace: string;
  from?: string;
  to?: string;
};

type SalesHistorySectionProps = {
  products?: Product[];
  onOpenProductsTab?: () => void;
};

const DEFAULT_QUERY_STATE: QueryState = {
  rangeMode: "90",
  page: 1,
  productId: "all",
  marketplace: "all",
};

const FALLBACK_SUMMARY: SalesHistorySummary = {
  total_orders: 0,
  total_units: 0,
  total_revenue: 0,
  average_order_value: 0,
  unique_products: 0,
  active_marketplaces: 0,
  active_sales_days: 0,
  average_daily_units: 0,
};

const FALLBACK_QUALITY: SalesHistoryDataQuality = {
  label: "Eksik Veri",
  tone: "loss",
  summary: "Satış geçmişi bulunmadığı için tahmin modeli güvenilir sinyal üretemez.",
  forecast_readiness: "Forecast kullanmadan önce satış verisi içe aktarın.",
  active_sales_days: 0,
  missing_days: 0,
  total_days: 0,
  completeness_ratio: 0,
  last_order_date: null,
  notes: ["Henüz satış hareketi görünmüyor."],
};

function buildPaginationItems(totalPages: number, currentPage: number) {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const;
}

function getTodayKey() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCompactDate(dateKey: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatAxisCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return `${Math.round(value)}₺`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function normalizeStatusLabel(status: string | null) {
  const key = (status ?? "completed").toLowerCase();

  if (key === "returned") return "İade";
  if (key === "cancelled") return "İptal";
  if (key === "processing" || key === "pending") return "İşleniyor";
  if (key === "shipped") return "Kargoda";
  return "Tamamlandı";
}

function statusTone(status: string | null) {
  const key = (status ?? "completed").toLowerCase();
  if (key === "returned" || key === "cancelled") return "loss" as const;
  if (key === "processing" || key === "pending") return "warning" as const;
  return "profit" as const;
}

function marketplacePillClass(slug: string | null) {
  if (slug === "trendyol") {
    return "border-[#f27a1a]/20 bg-[#f27a1a]/10 text-[#ffb273]";
  }
  if (slug === "hepsiburada") {
    return "border-info/20 bg-info/10 text-info";
  }
  if (slug === "own_website" || slug === "my_website") {
    return "border-profit/20 bg-profit/10 text-profit";
  }
  return "border-border/80 bg-surface-soft/80 text-muted";
}

function inferRangeLabel(queryState: QueryState, appliedRange?: { from: string; to: string }) {
  if (queryState.rangeMode === "custom" && appliedRange) {
    return `${formatDate(appliedRange.from)} - ${formatDate(appliedRange.to)}`;
  }
  if (queryState.rangeMode === "30") return "Son 30 gün";
  if (queryState.rangeMode === "180") return "Son 180 gün";
  return "Son 90 gün";
}

export default function SalesHistorySection({
  products = [],
  onOpenProductsTab,
}: SalesHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryState, setQueryState] = useState<QueryState>(DEFAULT_QUERY_STATE);
  const [summary, setSummary] = useState<SalesHistorySummary>(FALLBACK_SUMMARY);
  const [rows, setRows] = useState<SalesHistoryRow[]>([]);
  const [trend, setTrend] = useState<SalesHistoryTrendPoint[]>([]);
  const [quality, setQuality] = useState<SalesHistoryDataQuality>(FALLBACK_QUALITY);
  const [pagination, setPagination] = useState<SalesHistoryResponse["pagination"] | null>(null);
  const [marketplaceOptions, setMarketplaceOptions] = useState<MarketplaceOption[]>([]);
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const deferredTableSearch = useDeferredValue(tableSearch);
  const [tableStatusFilter, setTableStatusFilter] = useState<TableStatusFilter>("all");

  const fetchSalesHistory = useCallback(async (nextState: QueryState) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("view", "sales");
      params.set("page", String(nextState.page));

      if (nextState.rangeMode === "custom" && nextState.from && nextState.to) {
        params.set("from", nextState.from);
        params.set("to", nextState.to);
      } else {
        params.set("days", nextState.rangeMode);
      }

      if (nextState.productId !== "all") {
        params.set("productId", nextState.productId);
      }

      if (nextState.marketplace !== "all") {
        params.set("marketplace", nextState.marketplace);
      }

      const response = await fetch(`/api/data-center/sales-history?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as SalesHistoryResponse & { error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Satış geçmişi yüklenemedi.");
      }

      setQueryState(nextState);
      setSummary(payload.summary ?? FALLBACK_SUMMARY);
      setRows(Array.isArray(payload.sales_history) ? payload.sales_history : []);
      setTrend(Array.isArray(payload.trend) ? payload.trend : []);
      setQuality(payload.data_quality ?? FALLBACK_QUALITY);
      setPagination(payload.pagination ?? null);
      setMarketplaceOptions(Array.isArray(payload.filters?.marketplace_options) ? payload.filters?.marketplace_options ?? [] : []);
      setAppliedRange(payload.applied_range ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Satış geçmişi yüklenemedi.");
      setSummary(FALLBACK_SUMMARY);
      setRows([]);
      setTrend([]);
      setQuality(FALLBACK_QUALITY);
      setPagination(null);
      setMarketplaceOptions([]);
      setAppliedRange(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSalesHistory(DEFAULT_QUERY_STATE);
  }, [fetchSalesHistory]);

  function applyQuery(partial: Partial<QueryState>) {
    const nextState = {
      ...queryState,
      ...partial,
    };
    void fetchSalesHistory(nextState);
  }

  function ensureCustomRangeSeed() {
    const today = getTodayKey();
    const start = addDays(today, -29);
    if (!customFrom) setCustomFrom(start);
    if (!customTo) setCustomTo(today);
  }

  function handleRangeChange(nextRange: HistoryRangeMode) {
    if (nextRange === "custom") {
      ensureCustomRangeSeed();
      setQueryState((current) => ({ ...current, rangeMode: "custom", page: 1 }));
      return;
    }

    applyQuery({
      rangeMode: nextRange,
      page: 1,
      from: undefined,
      to: undefined,
    });
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customFrom || !customTo) return;

    applyQuery({
      rangeMode: "custom",
      page: 1,
      from: customFrom,
      to: customTo,
    });
  }

  function handlePageChange(nextPage: number) {
    if (!pagination || nextPage < 1 || nextPage > pagination.total_pages || nextPage === pagination.page) {
      return;
    }

    applyQuery({ page: nextPage });
  }

  const productOptions = [...products].sort((left, right) => left.name.localeCompare(right.name, "tr"));
  const hasSalesHistory = summary.total_orders > 0;
  const currentRangeLabel = inferRangeLabel(queryState, appliedRange ?? undefined);
  const filteredRows = rows.filter((row) => {
    const query = deferredTableSearch.trim().toLowerCase();
    const haystack = [
      row.external_order_number,
      row.external_package_number,
      row.product_name,
      row.product_sku,
      row.marketplace_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = query.length === 0 || haystack.includes(query);
    const matchesStatus = tableStatusFilter === "all" || (row.status ?? "completed").toLowerCase() === tableStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const paginationItems = buildPaginationItems(pagination?.total_pages ?? 0, pagination?.page ?? 1);

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-24" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
          <SkeletonCard className="h-[390px]" />
          <SkeletonCard className="h-[390px]" />
        </div>
        <SkeletonTable rows={7} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <GlassCard className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <StatusBadge tone="loss">Eksik Veri</StatusBadge>
              <h3 className="font-heading text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.2rem]">
                Satış geçmişi, tahmin modeli ve stok riski hesaplamalarının temelidir.
              </h3>
              <p className="text-sm leading-6 text-muted">{currentRangeLabel} için satış geçmişi yüklenemedi.</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchSalesHistory(queryState)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-surface-soft/80 px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
            >
              <RefreshCcw className="h-4 w-4" />
              Yenile
            </button>
          </div>
        </GlassCard>

        <ErrorStateCard
          title="Satış geçmişi yüklenemedi"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void fetchSalesHistory(queryState)}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Tekrar Dene
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={quality.tone}>{quality.label}</StatusBadge>
              <span className="text-xs font-medium text-muted">{currentRangeLabel}</span>
            </div>
            <h3 className="font-heading text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.2rem]">
              Satış geçmişi, tahmin modeli ve stok riski hesaplamalarının temelidir.
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              İçe aktarılan siparişleri ürün, kanal ve dönem bazında inceleyin. Veri kalitesini okuyup forecast sonuçlarının ne kadar güvenilir
              olduğunu bu sekmede görün.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Filtresi</span>
            <select
              value={queryState.productId}
              onChange={(event) => {
                applyQuery({
                  productId: event.target.value,
                  page: 1,
                });
              }}
              className="h-11 w-full rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
            >
              <option value="all">Tüm ürünler</option>
              {productOptions.map((product) => (
                <option key={product.id} value={String(product.id)}>
                  {product.name} {product.sku ? `· ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Pazaryeri / Kanal</span>
            <select
              value={queryState.marketplace}
              onChange={(event) => {
                applyQuery({
                  marketplace: event.target.value,
                  page: 1,
                });
              }}
              className="h-11 w-full rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
            >
              <option value="all">Tüm kanallar</option>
              {marketplaceOptions.map((option) => (
                <option key={option.marketplace_slug ?? option.marketplace_name ?? "marketplace"} value={option.marketplace_slug ?? "market"}>
                  {option.marketplace_name ?? "Kanal"}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Tarih Aralığı</span>
            <select
              value={queryState.rangeMode}
              onChange={(event) => handleRangeChange(event.target.value as HistoryRangeMode)}
              className="h-11 w-full rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
            >
              <option value="30">Son 30 gün</option>
              <option value="90">Son 90 gün</option>
              <option value="180">Son 180 gün</option>
              <option value="custom">Özel aralık</option>
            </select>
          </div>

          <div className="flex items-end">
            <Link
              href="/integrations"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface-soft/80 px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft xl:w-auto"
            >
              <RefreshCcw className="h-4 w-4" />
              Satış Verisi İçe Aktar
            </Link>
          </div>
        </div>

        {queryState.rangeMode === "custom" && (
          <form onSubmit={applyCustomRange} className="mt-3 grid gap-3 border-t border-border/70 pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Başlangıç</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Bitiş</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              <CalendarRange className="h-4 w-4" />
              Aralığı Uygula
            </button>
          </form>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Toplam Sipariş" value={formatNumber(summary.total_orders)} subValue="Filtrelenen kayıtlar" icon={ShoppingCart} tone="neutral" />
        <KpiCard title="Toplam Ciro" value={formatCurrency(summary.total_revenue)} subValue="Gerçekleşen gelir" icon={LineChart} tone="profit" />
        <KpiCard title="Aktif Satış Günü" value={formatNumber(summary.active_sales_days)} subValue={`${quality.total_days} günlük pencere`} icon={Activity} tone="warning" />
        <KpiCard
          title="Ort. Günlük Adet"
          value={formatDecimal(summary.average_daily_units)}
          subValue="Satış görülen günlerde"
          icon={Package}
          tone="neutral"
        />
      </div>

      {!hasSalesHistory ? (
        <EmptyState
          icon={CircleAlert}
          title="Henüz satış geçmişi yok"
          description="Talep tahmini ve stok riski hesapları için satış geçmişi gerekir. Satış verisini içe aktarın veya önce ürünlerinizi hazırlayın."
          className="mx-auto max-w-2xl"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/integrations"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Satış Verisi İçe Aktar
              </Link>
              <button
                type="button"
                onClick={onOpenProductsTab}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border/80 bg-surface-soft/80 px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
              >
                Ürünlere Git
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <ChartCard
              title="Satış Trendi"
              description="Ciro ve satılan adet zaman içinde nasıl akıyor, eksik günler nerede birikiyor buradan okuyun."
              aside={<StatusBadge tone={quality.tone}>{quality.label}</StatusBadge>}
              className="min-h-[390px]"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8b6cf7]" />
                  Ciro
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4aa3ff]" />
                  Satılan Adet
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f2b96d]" />
                  Eksik Gün
                </span>
              </div>

              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                  <ComposedChart data={trend} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b6cf7" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#8b6cf7" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" strokeOpacity={0.24} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatCompactDate}
                      tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      yAxisId="revenue"
                      tickFormatter={(value) => formatAxisCurrency(Number(value))}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <YAxis
                      yAxisId="units"
                      orientation="right"
                      tickFormatter={(value) => formatNumber(Number(value))}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)", strokeOpacity: 0.35 }}
                      content={({ active, payload, label }) => {
                        const point = trend.find((item) => item.date === label);
                        return (
                          <FinancialTooltip
                            active={active}
                            label={String(label ?? "")}
                            payload={(payload ?? []).map((entry) => ({
                              dataKey: typeof entry.dataKey === "string" ? entry.dataKey : String(entry.dataKey ?? ""),
                              value: typeof entry.value === "number" || typeof entry.value === "string" ? entry.value : undefined,
                              color: entry.color,
                            }))}
                            title="Günlük satış"
                            labelFormatter={(value) => formatDate(value)}
                            note={point?.marketplace ? `Kanal: ${point.marketplace}` : point?.missing ? "Bu gün için satış görünmüyor." : undefined}
                            series={[
                              {
                                key: "revenue",
                                label: "Ciro",
                                color: "#8b6cf7",
                                formatter: (value) => formatCurrency(Number(value ?? 0)),
                              },
                              {
                                key: "units",
                                label: "Satılan Adet",
                                color: "#4aa3ff",
                                formatter: (value) => formatNumber(Number(value ?? 0)),
                              },
                              {
                                key: "orders",
                                label: "Sipariş",
                                color: "var(--stable)",
                                formatter: (value) => formatNumber(Number(value ?? 0)),
                              },
                            ]}
                          />
                        );
                      }}
                    />
                    <Area
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8b6cf7"
                      strokeWidth={2}
                      fill="url(#salesRevenueFill)"
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      yAxisId="units"
                      type="monotone"
                      dataKey="units"
                      stroke="#4aa3ff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    {trend
                      .filter((point) => point.missing)
                      .map((point) => (
                        <ReferenceDot
                          key={`missing-${point.date}`}
                          x={point.date}
                          yAxisId="units"
                          y={0}
                          r={2.6}
                          fill="#f2b96d"
                          stroke="rgba(242, 185, 109, 0.45)"
                        />
                      ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Forecast Hazırlığı</p>
                  <h4 className="mt-2 font-heading text-lg font-semibold tracking-[-0.03em] text-foreground">Veri kalitesi ve güven seviyesi</h4>
                </div>
                <StatusBadge tone={quality.tone}>{quality.label}</StatusBadge>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted">{quality.summary}</p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>Veri kapsamı</span>
                  <span>%{Math.round(quality.completeness_ratio * 100)}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-soft/90">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      quality.tone === "profit" ? "bg-profit" : quality.tone === "warning" ? "bg-warning" : "bg-loss"
                    )}
                    style={{ width: `${Math.max(quality.completeness_ratio * 100, hasSalesHistory ? 6 : 0)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-surface-soft/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Aktif Gün</p>
                  <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">{formatNumber(quality.active_sales_days)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-soft/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Eksik Gün</p>
                  <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">{formatNumber(quality.missing_days)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-soft/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Son Sipariş</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{quality.last_order_date ? formatDate(quality.last_order_date) : "Yok"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-soft/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kanal Sayısı</p>
                  <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">{formatNumber(summary.active_marketplaces)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-surface-soft/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Tahmin Notu</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{quality.forecast_readiness}</p>
              </div>

              <div className="mt-4 space-y-2">
                {quality.notes.map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-muted">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-border-strong" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="overflow-hidden !p-0">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Satış Tablosu</p>
                <h4 className="mt-2 font-heading text-lg font-semibold tracking-[-0.03em] text-foreground">Ham sipariş hareketleri</h4>
                <p className="mt-1 text-sm text-muted">Ürün, kanal ve sipariş kalitesini sıkışık bir finans tablosunda kontrol edin.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Sipariş, ürün veya kanal ara"
                    className="h-10 w-full rounded-xl border border-border/70 bg-surface-soft/70 pl-9 pr-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50 sm:w-64"
                  />
                </label>

                <select
                  value={tableStatusFilter}
                  onChange={(event) => setTableStatusFilter(event.target.value as TableStatusFilter)}
                  className="h-10 rounded-xl border border-border/70 bg-surface-soft/70 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="processing">İşleniyor</option>
                  <option value="returned">İade</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted">
              <span>{formatNumber(filteredRows.length)} satır gösteriliyor</span>
              <span>{formatNumber(summary.unique_products)} ürün · {formatNumber(summary.active_marketplaces)} kanal</span>
            </div>

            <div className="custom-scrollbar overflow-x-auto">
              <table className="min-w-[1020px] w-full border-collapse">
                <thead className="bg-surface-soft/70">
                  <tr className="border-y border-border/70 text-left text-[10px] uppercase tracking-[0.18em] text-muted">
                    <th className="px-4 py-3 font-semibold">Tarih</th>
                    <th className="px-4 py-3 font-semibold">Sipariş No</th>
                    <th className="px-4 py-3 font-semibold">Ürün</th>
                    <th className="px-4 py-3 font-semibold">Pazaryeri</th>
                    <th className="px-4 py-3 text-right font-semibold">Adet</th>
                    <th className="px-4 py-3 text-right font-semibold">Birim Fiyat</th>
                    <th className="px-4 py-3 text-right font-semibold">Toplam</th>
                    <th className="px-4 py-3 text-right font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr key={`${row.order_id}-${row.product_id ?? row.product_sku ?? row.external_order_number ?? "row"}`} className="group hover:bg-surface-soft/45">
                        <td className="px-4 py-2.5 text-sm text-muted">{formatDate(row.order_date)}</td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{row.external_order_number ?? `#${row.order_id}`}</p>
                            {row.external_package_number ? <p className="text-[11px] text-muted">Paket: {row.external_package_number}</p> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-1">
                            {row.product_id ? (
                              <Link href={`/products/${row.product_id}`} className="block text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary">
                                {row.product_name ?? "Ürün"}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">{row.product_name ?? "Ürün"}</p>
                            )}
                            <p className="text-[11px] text-muted">{row.product_sku ?? "SKU yok"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", marketplacePillClass(row.marketplace_slug))}>
                            {row.marketplace_name ?? "Kanal"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">{formatNumber(row.quantity)}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">{formatCurrency(row.unit_price)}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">{formatCurrency(row.line_total)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge tone={statusTone(row.status)} className="ml-auto">
                            {normalizeStatusLabel(row.status)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10">
                        <EmptyState
                          icon={Search}
                          title="Filtreye uygun satış kaydı bulunamadı"
                          description="Arama kelimesini veya durum filtresini temizleyerek daha geniş bir görünüm deneyin."
                          variant="inline"
                          className="mx-auto max-w-md"
                          action={
                            <button
                              type="button"
                              onClick={() => {
                                setTableSearch("");
                                setTableStatusFilter("all");
                              }}
                              className="inline-flex h-10 items-center justify-center rounded-lg border border-border/80 bg-surface-soft/80 px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
                            >
                              Filtreleri Temizle
                            </button>
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination && pagination.total_pages > 1 ? (
              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  Sayfa {pagination.page} / {pagination.total_pages}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="rounded-full border border-border/70 bg-surface-soft/80 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Önceki
                  </button>
                  {paginationItems.map((item, index) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handlePageChange(item)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200",
                          item === pagination.page
                            ? "border-primary/30 bg-primary/12 text-primary"
                            : "border-border/70 bg-surface-soft/80 text-muted hover:bg-surface-soft hover:text-foreground"
                        )}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                    className="rounded-full border border-border/70 bg-surface-soft/80 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-surface-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            ) : null}
          </GlassCard>
        </>
      )}
    </div>
  );
}
