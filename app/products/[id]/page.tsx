"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Barcode,
  CircleOff,
  Package,
  ReceiptText,
} from "lucide-react";
import { PageHeader, GlassCard, SkeletonCard, EmptyState } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDecimal, formatNumber } from "@/lib/formatters";

type ProductDetailTrendPoint = {
  date: string;
  label: string;
  units: number;
  revenue: number;
  order_count: number;
};

type ProductDetailOrderRow = {
  order_id: number;
  order_date: string;
  marketplace_name: string;
  external_order_number: string | null;
  external_package_number: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string | null;
  merchant_sku: string | null;
  barcode: string | null;
};

type ProductDetailResponse = {
  success: boolean;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    categoryPath?: string | null;
    categoryName?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    cost: number;
    packagingCost: number;
    desi: number;
    status?: string | null;
  };
  channels?: Array<{
    channelName: string;
    slug: string;
    salePrice: number;
    shipping: number | null;
    mode: string | null;
    totalCost: number;
    netProfit: number;
    margin: number;
    warningNotes?: string | null;
  }>;
  marginSnapshots?: Array<{
    marketplace_id: number;
    marketplace_name: string | null;
    marketplace_slug: string | null;
    list_price: number | null;
    total_unit_cost: number | null;
    net_profit: number | null;
    profit_margin_percent: number | null;
    warning_notes: string | null;
  }>;
  marginStatus?: "healthy" | "watch" | "risk";
  salesTrend30?: ProductDetailTrendPoint[];
  salesTrend90?: ProductDetailTrendPoint[];
  salesSummary30?: {
    totalUnits: number;
    totalRevenue: number;
    activeDays: number;
    avgDailyUnits: number;
    peakDay: { date: string; units: number } | null;
  };
  salesSummary90?: {
    totalUnits: number;
    totalRevenue: number;
    activeDays: number;
    avgDailyUnits: number;
    peakDay: { date: string; units: number } | null;
  };
  orderHistory?: ProductDetailOrderRow[];
};

function parseId(value: string | string[] | undefined) {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function statusCopy(status?: string | null) {
  switch (status) {
    case "active":
      return { label: "Aktif", className: "bg-primary/10 text-primary border-primary/20" };
    case "passive":
      return { label: "Pasif", className: "bg-zinc-500/10 text-muted border-zinc-500/20" };
    case "draft":
      return { label: "Taslak", className: "bg-info/10 text-info border-info/20" };
    default:
      return { label: "Bilinmiyor", className: "bg-surface-container text-soft border-border" };
  }
}

function orderStatusCopy(status?: string | null) {
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

function marginStatusCopy(status?: string | null) {
  switch (status) {
    case "healthy":
      return {
        label: "Sağlıklı",
        description: "Marj iyi, fiyat için alan var.",
        className: "border-primary/20 bg-primary/10 text-primary",
      };
    case "watch":
      return {
        label: "Takip Edilmeli",
        description: "Marj daralıyor; maliyeti izle.",
        className: "border-warning/20 bg-warning/10 text-warning",
      };
    default:
      return {
        label: "Riskli",
        description: "En az bir kanalda marj düşük.",
        className: "border-danger/20 bg-danger/10 text-danger",
      };
  }
}

function trendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ProductDetailTrendPoint }>;
  label?: string | number;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-panel/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {point.date ? formatDate(point.date) : label ?? point.label}
      </p>
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-primary">{formatNumber(point.units)} adet</p>
        <p className="text-muted">{formatCurrency(point.revenue)} ciro</p>
        <p className="text-muted">{formatNumber(point.order_count)} sipariş</p>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = parseId(params?.id);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<30 | 90>(30);
  const [activeTab, setActiveTab] = useState<"description" | "margin" | "orders">("description");

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setError("Geçersiz ürün.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        const json = (await response.json()) as ProductDetailResponse;
        if (!cancelled) {
          if (!response.ok || !json.success) {
            throw new Error("Ürün yüklenemedi.");
          }
          setData(json);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Ürün yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const product = data?.product ?? null;
  const chartData = selectedRange === 90 ? data?.salesTrend90 ?? [] : data?.salesTrend30 ?? [];
  const summary = selectedRange === 90 ? data?.salesSummary90 ?? null : data?.salesSummary30 ?? null;
  const status = statusCopy(product?.status ?? null);
  const marginStatus = marginStatusCopy(data?.marginStatus ?? null);
  const topChannel = data?.marginSnapshots?.[0] ?? null;
  const orderHistory = data?.orderHistory ?? [];

  const marginSnapshots = useMemo(() => data?.marginSnapshots ?? [], [data]);

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader title="Ürün" description="Ürün detayları yükleniyor..." />
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] gap-6">
          <SkeletonCard className="h-[520px]" />
          <SkeletonCard className="h-[520px]" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-shell">
        <PageHeader title="Ürün" description={error ?? "Ürün bulunamadı."}>
          <Link
            href="/veri-merkezi"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-sm text-foreground transition-colors duration-200 hover:bg-surface-container"
          >
            <ArrowLeft className="h-4 w-4" />
            Ürünler
          </Link>
        </PageHeader>
        <EmptyState
          icon={Package}
          title="Ürün açılamadı"
          description={error ?? "Bu ürün bulunamadı."}
          action={
            <Link href="/veri-merkezi" className="btn-primary">
              Veri Merkezine Dön
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={product.name}
        description={`Kod: ${product.sku ?? "Belirtilmedi"} · ${product.categoryPath ?? product.categoryName ?? "Kategorisiz"}`}
      >
        <Link
          href="/veri-merkezi"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-sm text-foreground transition-colors duration-200 hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Ürünler
        </Link>
      </PageHeader>

      <div className="space-y-6 pb-12">
        <GlassCard className="border-border bg-surface-container">
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-container">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-container">
                    <Package className="h-14 w-14 text-primary/60" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-surface-container p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kod</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{product.sku ?? "Belirtilmedi"}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-container p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Barkod</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{product.barcode ?? "Belirtilmedi"}</p>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", status.className)}>
                    {status.label}
                  </span>
                  <span className="inline-flex rounded-md border border-border bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-soft">
                    {product.categoryName ?? product.categoryPath ?? "Kategorisiz"}
                  </span>
                  <span className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Satış trendi
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="max-w-4xl text-3xl font-semibold text-foreground sm:text-4xl">
                    {product.name}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-soft">
                    {product.description ?? "Açıklama yok. Ayrıntılar için açıklama sekmesini aç."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Kpi label="Maliyet" value={formatCurrency(product.cost)} />
                  <Kpi label="Paketleme" value={formatCurrency(product.packagingCost)} />
                  <Kpi label="Desi" value={formatNumber(product.desi)} />
                  <Kpi label="Durum" value={marginStatus.label} accent />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {topChannel && (
                  <GlassCard className="border-primary/20 bg-primary/5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">En iyi kanal</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {topChannel.marketplace_name ?? topChannel.marketplace_slug ?? "Kanal"}
                    </p>
                    <p className="text-sm font-medium text-primary">%{Number(topChannel.profit_margin_percent ?? 0).toFixed(1)} marj</p>
                  </GlassCard>
                )}

                {summary && (
                  <GlassCard className="border-border bg-surface-container">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Özet</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatNumber(summary.totalUnits)} adet</p>
                    <p className="text-sm text-muted">{formatCurrency(summary.totalRevenue)} ciro</p>
                  </GlassCard>
                )}

                <GlassCard className={cn("border-border bg-surface-container", marginStatus.className)}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Marj</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{marginStatus.label}</p>
                  <p className="text-sm text-soft/90">{marginStatus.description}</p>
                </GlassCard>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <GlassCard className="border-border bg-surface-container">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Satış trendi</h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  30 / 90 gün görünümü
                </p>
              </div>

              <div className="inline-flex rounded-md border border-border bg-surface-container p-1">
                {[30, 90].map((windowDays) => (
                  <button
                    key={windowDays}
                    type="button"
                    onClick={() => setSelectedRange(windowDays as 30 | 90)}
                    className={cn(
                      "rounded-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                      selectedRange === windowDays
                        ? "bg-primary text-primary-foreground"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {windowDays} Gün
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[360px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="productTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(Number(value))}
                  />
                  <Tooltip content={trendTooltip} />
                  <Area
                    type="monotone"
                    dataKey="units"
                    stroke="var(--success)"
                    strokeWidth={2.5}
                    fill="url(#productTrendFill)"
                    activeDot={{ r: 6, fill: "var(--success)", stroke: "var(--panel-bg)", strokeWidth: 2 }}
                    dot={false}
                    name="Satış Adedi"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {summary && (
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniStat label="Toplam" value={formatNumber(summary.totalUnits)} />
                <MiniStat label="Aktif gün" value={formatNumber(summary.activeDays)} />
                <MiniStat label="Günlük ort." value={formatDecimal(summary.avgDailyUnits, 1)} />
                <MiniStat
                  label="En yüksek gün"
                  value={summary.peakDay ? formatNumber(summary.peakDay.units) : "-"}
                  caption={summary.peakDay ? formatDate(summary.peakDay.date) : "Belirtilmedi"}
                />
              </div>
            )}
          </GlassCard>

          <GlassCard className="border-border bg-surface-container">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Detaylar</h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Özet, marj ve siparişler</p>
              </div>
              <div className="inline-flex rounded-md border border-border bg-surface-container p-1">
                {[
                  { id: "description", label: "Açıklama" },
                  { id: "margin", label: "Marj" },
                  { id: "orders", label: "Siparişler" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      "rounded-sm px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                      activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "description" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-container p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Açıklama</h3>
                  </div>
                  <p className="text-sm leading-6 text-soft">
                    {product.description ?? "Açıklama henüz eklenmemiş. Buradan düzenleyebilirsin."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MetaCard label="Kategori" value={product.categoryPath ?? product.categoryName ?? "Kategorisiz"} />
                  <MetaCard label="Barkod" value={product.barcode ?? "Belirtilmedi"} icon={Barcode} />
                  <MetaCard label="Kod" value={product.sku ?? "Belirtilmedi"} icon={ReceiptText} />
                  <MetaCard label="Durum" value={status.label} icon={CircleOff} />
                </div>
              </div>
            )}

            {activeTab === "margin" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-container p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Güncel durum</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{marginStatus.label}</p>
                  <p className="mt-2 text-sm leading-6 text-soft">{marginStatus.description}</p>
                </div>

                <div className="space-y-3">
                  {marginSnapshots.length > 0 ? (
                    marginSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.marketplace_id}
                        className="rounded-lg border border-border bg-surface-container p-4 transition-colors duration-200 hover:border-primary/20 hover:bg-primary/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {snapshot.marketplace_name ?? snapshot.marketplace_slug ?? "Kanal"}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                              {snapshot.marketplace_slug ?? "market"} · {formatCurrency(Number(snapshot.list_price ?? 0))}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                              Number(snapshot.profit_margin_percent ?? 0) >= 30
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-warning/20 bg-warning/10 text-warning"
                            )}
                          >
                            %{Number(snapshot.profit_margin_percent ?? 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                          <StatPair label="Maliyet" value={formatCurrency(Number(snapshot.total_unit_cost ?? 0))} />
                          <StatPair label="Kâr" value={formatCurrency(Number(snapshot.net_profit ?? 0))} accent />
                          <StatPair label="Not" value={snapshot.warning_notes ?? "Belirtilmedi"} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-border bg-surface-container p-5 text-sm text-muted">
                      Bu ürün için henüz kanal verisi yok.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-container p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Siparişler</p>
                  <p className="mt-1 text-sm text-muted">
                    {formatNumber(orderHistory.length)} kayıt · geçmiş sipariş kayıtları
                  </p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container text-[10px] uppercase tracking-[0.18em] text-muted">
                        <th className="px-4 py-3 font-semibold">Tarih</th>
                        <th className="px-4 py-3 font-semibold">Kanal</th>
                        <th className="px-4 py-3 font-semibold">Sipariş</th>
                        <th className="px-4 py-3 font-semibold text-right">Adet</th>
                        <th className="px-4 py-3 font-semibold text-right">Birim</th>
                        <th className="px-4 py-3 font-semibold text-right">Tutar</th>
                        <th className="px-4 py-3 font-semibold text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {orderHistory.length > 0 ? (
                        orderHistory.map((row) => {
                          const orderStatus = orderStatusCopy(row.status);

                          return (
                            <tr key={`${row.order_id}-${row.external_order_number ?? row.order_id}`} className="hover:bg-surface-container transition-colors duration-200">
                              <td className="px-4 py-3 text-xs text-soft">{formatDate(row.order_date)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-foreground">{row.marketplace_name}</td>
                              <td className="px-4 py-3 text-xs text-muted">
                                <div className="flex flex-col gap-1">
                                  <span>{row.external_order_number ?? `#${row.order_id}`}</span>
                                  <span className="text-[10px] text-muted">{row.external_package_number ?? "Paket numarası yok"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-soft">{formatNumber(row.quantity)}</td>
                              <td className="px-4 py-3 text-right text-sm text-soft">{formatCurrency(row.unit_price)}</td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-primary">{formatCurrency(row.line_total)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", orderStatus.className)}>
                                  {orderStatus.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                            Bu tarih aralığında sipariş kaydı yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4", accent ? "border-primary/20 bg-primary/5" : "border-border bg-surface-container")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={cn("mt-2 text-lg font-semibold", accent ? "text-primary" : "text-foreground")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-container p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {caption && <p className="text-[10px] text-muted">{caption}</p>}
    </div>
  );
}

function MetaCard({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-surface-container p-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatPair({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-md border p-3", accent ? "border-primary/20 bg-primary/5" : "border-border bg-surface-container")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold", accent ? "text-primary" : "text-foreground")}>{value}</p>
    </div>
  );
}
