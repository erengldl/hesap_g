"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Edit2,
  Eye,
  Globe,
  Search,
  SlidersHorizontal,
  Smartphone,
  Store,
  Target,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ToastLike {
  text: string;
  type: "success" | "warning" | "error";
}

type ChannelFilter = "all" | "trendyol" | "hepsiburada" | "my_website";
type StatusFilter = "all" | "active" | "draft" | "passive" | "critical";
type SortOption = "updated-desc" | "margin-desc" | "price-desc" | "price-asc" | "stock-asc" | "name-asc";

interface ProductDataTableProps {
  products: Product[];
  onDelete?: (id: number) => void;
  onEdit?: (product: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: (ids: number[], checked: boolean) => void;
  onNotify?: (message: ToastLike) => void;
  onRefresh?: () => Promise<void> | void;
}

const CONTROL_CLASS =
  "h-10 rounded-md border border-border/70 bg-surface-container/75 px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/30 focus:bg-surface-container";

const QUICK_ACTION_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-surface-container/80 px-2.5 text-[11px] font-semibold text-muted transition-colors duration-200 hover:border-primary/25 hover:bg-card hover:text-foreground";

const QUICK_ACTION_DANGER_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-loss/20 bg-loss/10 px-2.5 text-[11px] font-semibold text-loss transition-colors duration-200 hover:bg-loss/15";

const CHANNEL_META = {
  trendyol: {
    label: "Trendyol",
    shortLabel: "TY",
    icon: Smartphone,
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  hepsiburada: {
    label: "Hepsiburada",
    shortLabel: "HB",
    icon: Store,
    className: "border-info/20 bg-info/10 text-info",
  },
  my_website: {
    label: "Kendi Websitem",
    shortLabel: "Site",
    icon: Globe,
    className: "border-profit/20 bg-profit/10 text-profit",
  },
} as const;

function getChannelMeta(channel: string) {
  if (channel === "trendyol" || channel === "hepsiburada" || channel === "my_website") {
    return CHANNEL_META[channel];
  }

  return null;
}

function getProductStock(product: Product) {
  return Math.max(0, Number(product.stock ?? 0));
}

function getProductMargin(product: Product) {
  const value = Number(product.profit_margin_percent ?? Number.NaN);
  return Number.isFinite(value) ? value : null;
}

function getBaseCost(product: Product) {
  return Number(product.cost ?? 0) + Number(product.packaging_cost ?? 0);
}

function isCriticalStock(product: Product) {
  return (product.status ?? "draft") !== "passive" && getProductStock(product) > 0 && getProductStock(product) <= 5;
}

function isProductComplete(product: Product) {
  return Boolean(
    product.name?.trim() &&
      product.category_path?.trim() &&
      Number(product.cost ?? 0) > 0 &&
      Number(product.sale_price ?? 0) > 0 &&
      product.active_channels.length > 0
  );
}

function getDisplayStatus(product: Product) {
  if (isCriticalStock(product)) {
    return {
      key: "critical" as const,
      label: "Kritik stok",
      className: "border-[#ff8b6b]/30 bg-[#ff8b6b]/12 text-[#ff9c84]",
    };
  }

  const status = product.status ?? "draft";
  if (status === "active") {
    return {
      key: "active" as const,
      label: product.status_label ?? "Aktif",
      className: "border-profit/20 bg-profit/10 text-profit",
    };
  }

  if (status === "passive") {
    return {
      key: "passive" as const,
      label: product.status_label ?? "Pasif",
      className: "border-[#b8a179]/20 bg-[#b8a179]/10 text-[#d7bf93]",
    };
  }

  return {
    key: "draft" as const,
    label: product.status_label ?? "Taslak",
    className: "border-border/80 bg-surface-container/75 text-muted",
  };
}

function getMarginClasses(margin: number | null) {
  if (margin == null) return "text-muted";
  if (margin >= 25) return "text-profit";
  if (margin >= 10) return "text-foreground";
  if (margin >= 0) return "text-warning";
  return "text-loss";
}

function parseDate(value?: string) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLastUpdated(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return { relative: "Henüz yok", absolute: "Güncelleme bekleniyor" };
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  const relative =
    diffMinutes < 1
      ? "Şimdi"
      : diffMinutes < 60
        ? `${diffMinutes} dk önce`
        : diffMinutes < 24 * 60
          ? `${Math.round(diffMinutes / 60)} sa önce`
          : `${Math.round(diffMinutes / (60 * 24))} gün önce`;

  return {
    relative,
    absolute: formatDate(date),
  };
}

function ProductImage({ product }: { product: Product }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-surface-container/70">
      {product.image_url ? (
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${product.image_url})` }}
          role="img"
          aria-label={product.name}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-surface-soft to-profit/20 text-[11px] font-extrabold uppercase tracking-[0.12em] text-foreground">
          {product.name.slice(0, 2)}
        </div>
      )}
    </div>
  );
}

function ProductChannels({ channels }: { channels: string[] }) {
  if (channels.length === 0) {
    return <span className="text-xs text-muted">Kanal yok</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {channels.map((channel) => {
        const meta = getChannelMeta(channel);
        if (!meta) return null;
        const Icon = meta.icon;

        return (
          <span
            key={channel}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
              meta.className
            )}
            title={meta.label}
          >
            <Icon className="h-3 w-3" />
            {meta.shortLabel}
          </span>
        );
      })}
    </div>
  );
}

function TableActions({
  product,
  onEdit,
  onDelete,
  compact = false,
}: {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "" : "justify-end")}>
      <button
        type="button"
        onClick={() => onEdit?.(product)}
        className={QUICK_ACTION_CLASS}
        aria-label={`${product.name} düzenle`}
      >
        <Edit2 className="h-3.5 w-3.5" />
        Düzenle
      </button>
      <Link href={`/products/${product.id}`} className={QUICK_ACTION_CLASS} aria-label={`${product.name} detayını görüntüle`}>
        <Eye className="h-3.5 w-3.5" />
        Detay
      </Link>
      <Link
        href={`/profit-pricing?productId=${product.id}`}
        className={QUICK_ACTION_CLASS}
        aria-label={`${product.name} için optimizasyon aç`}
      >
        <Target className="h-3.5 w-3.5" />
        Optimize
      </Link>
      <button
        type="button"
        onClick={() => onDelete?.(product.id)}
        className={QUICK_ACTION_DANGER_CLASS}
        aria-label={`${product.name} sil`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Sil
      </button>
    </div>
  );
}

function ProductMobileCard({
  product,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  product: Product;
  selected: boolean;
  onToggleSelect?: (id: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: number) => void;
}) {
  const margin = getProductMargin(product);
  const displayStatus = getDisplayStatus(product);
  const lastUpdated = formatLastUpdated(product.last_updated);
  const complete = isProductComplete(product);

  return (
    <article className="rounded-xl border border-border/70 bg-panel/62 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        {onToggleSelect ? (
          <input
            type="checkbox"
            aria-label={`${product.name} seç`}
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
            className="mt-1 h-4 w-4 rounded border-border/70 bg-surface-container/70 text-primary focus:ring-primary/30"
          />
        ) : null}

        <ProductImage product={product} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="font-semibold uppercase tracking-[0.12em]">{product.sku ?? "SKU yok"}</span>
                {!complete ? (
                  <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    Eksik veri
                  </span>
                ) : null}
              </div>
            </div>
            <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", displayStatus.className)}>
              {displayStatus.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Satış Fiyatı</p>
              <p className="mt-1 font-semibold text-foreground tabular-nums">{formatCurrency(product.sale_price)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Maliyet</p>
              <p className="mt-1 font-semibold text-foreground tabular-nums">{formatCurrency(getBaseCost(product))}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Marj</p>
              <p className={cn("mt-1 font-semibold tabular-nums", getMarginClasses(margin))}>
                {margin == null ? "—" : `%${margin.toFixed(1)}`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Stok</p>
              <p className="mt-1 font-semibold text-foreground tabular-nums">{formatNumber(getProductStock(product))}</p>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Kanallar</p>
            <div className="mt-2">
              <ProductChannels channels={product.active_channels} />
            </div>
          </div>

          <div className="mt-3 text-[11px] text-muted">
            <span className="font-medium text-foreground">{lastUpdated.relative}</span>
            <span className="ml-2">{lastUpdated.absolute}</span>
          </div>

          <div className="mt-4">
            <TableActions product={product} onEdit={onEdit} onDelete={onDelete} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ProductDataTable(props: ProductDataTableProps) {
  const {
    products,
    onDelete,
    onEdit,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
  } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    const nextProducts = products.filter((product) => {
      const displayStatus = getDisplayStatus(product);
      const searchable = [
        product.name,
        product.sku ?? "",
        product.category_path ?? product.category_name ?? "",
        product.active_channels.join(" "),
        displayStatus.label,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = query.length === 0 || searchable.includes(query);
      const matchesChannel = channelFilter === "all" || product.active_channels.includes(channelFilter);
      const matchesStatus = statusFilter === "all" || displayStatus.key === statusFilter;

      return matchesSearch && matchesChannel && matchesStatus;
    });

    nextProducts.sort((left, right) => {
      if (sortBy === "name-asc") {
        return left.name.localeCompare(right.name, "tr");
      }

      if (sortBy === "price-asc") {
        return Number(left.sale_price ?? 0) - Number(right.sale_price ?? 0);
      }

      if (sortBy === "price-desc") {
        return Number(right.sale_price ?? 0) - Number(left.sale_price ?? 0);
      }

      if (sortBy === "stock-asc") {
        return getProductStock(left) - getProductStock(right);
      }

      if (sortBy === "margin-desc") {
        return Number(getProductMargin(right) ?? -999) - Number(getProductMargin(left) ?? -999);
      }

      const leftDate = parseDate(left.last_updated)?.getTime() ?? 0;
      const rightDate = parseDate(right.last_updated)?.getTime() ?? 0;
      return rightDate - leftDate;
    });

    return nextProducts;
  }, [channelFilter, deferredSearchQuery, products, sortBy, statusFilter]);

  const visibleIds = filteredProducts.map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const hasActiveFilters = searchQuery.trim().length > 0 || channelFilter !== "all" || statusFilter !== "all" || sortBy !== "updated-desc";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-panel/62 p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
              <input
                type="text"
                placeholder="Ürün, SKU veya kanal ara"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={cn(CONTROL_CLASS, "w-full pl-9")}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border/70 bg-surface-container/75 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtre
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className={cn(CONTROL_CLASS, "min-w-[138px]")}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="active">Aktif</option>
                <option value="draft">Taslak</option>
                <option value="passive">Pasif</option>
                <option value="critical">Kritik stok</option>
              </select>

              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)}
                className={cn(CONTROL_CLASS, "min-w-[138px]")}
              >
                <option value="all">Tüm Kanallar</option>
                <option value="trendyol">Trendyol</option>
                <option value="hepsiburada">Hepsiburada</option>
                <option value="my_website">Kendi Websitem</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className={cn(CONTROL_CLASS, "min-w-[170px]")}
              >
                <option value="updated-desc">Son güncellenen</option>
                <option value="margin-desc">Marj yüksekten</option>
                <option value="price-desc">Fiyat yüksekten</option>
                <option value="price-asc">Fiyat düşükten</option>
                <option value="stock-asc">Stok düşükten</option>
                <option value="name-asc">Ada göre</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="tabular-nums">{filteredProducts.length} ürün</span>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setChannelFilter("all");
                  setStatusFilter("all");
                  setSortBy("updated-desc");
                }}
                className="font-semibold text-foreground transition-colors duration-200 hover:text-primary"
              >
                Filtreleri Temizle
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:hidden">
            {filteredProducts.map((product) => (
              <ProductMobileCard
                key={product.id}
                product={product}
                selected={selectedIdSet.has(product.id)}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-panel/58 shadow-[var(--shadow-card)] md:block">
            <div className="custom-scrollbar overflow-x-auto">
              <table className="min-w-[1180px] w-full table-fixed border-collapse">
                <thead className="bg-surface-container/55">
                  <tr className="border-b border-border/70 text-left text-[10px] uppercase tracking-[0.18em] text-muted">
                    <th className="w-[46px] px-3 py-3.5">
                      {onToggleSelectAll ? (
                        <input
                          type="checkbox"
                          aria-label="Görünen ürünleri seç"
                          checked={allVisibleSelected}
                          onChange={(event) => onToggleSelectAll(visibleIds, event.target.checked)}
                          className="h-4 w-4 rounded border-border/70 bg-surface-container/70 text-primary focus:ring-primary/30"
                        />
                      ) : null}
                    </th>
                    <th className="w-[300px] px-3 py-3.5">Ürün</th>
                    <th className="w-[112px] px-3 py-3.5">Durum</th>
                    <th className="w-[156px] px-3 py-3.5">Kanallar</th>
                    <th className="w-[118px] px-3 py-3.5 text-right">Satış Fiyatı</th>
                    <th className="w-[132px] px-3 py-3.5 text-right">Maliyet</th>
                    <th className="w-[118px] px-3 py-3.5 text-right">Marj</th>
                    <th className="w-[96px] px-3 py-3.5 text-right">Stok</th>
                    <th className="w-[146px] px-3 py-3.5">Son Güncelleme</th>
                    <th className="w-[220px] px-3 py-3.5 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filteredProducts.map((product) => {
                    const selected = selectedIdSet.has(product.id);
                    const margin = getProductMargin(product);
                    const displayStatus = getDisplayStatus(product);
                    const complete = isProductComplete(product);
                    const lastUpdated = formatLastUpdated(product.last_updated);

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "group transition-colors duration-200 hover:bg-surface-container/30",
                          selected && "bg-primary/[0.04]"
                        )}
                      >
                        <td className="px-3 py-3 align-middle">
                          {onToggleSelect ? (
                            <input
                              type="checkbox"
                              aria-label={`${product.name} seç`}
                              checked={selected}
                              onChange={() => onToggleSelect(product.id)}
                              className="h-4 w-4 rounded border-border/70 bg-surface-container/70 text-primary focus:ring-primary/30"
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductImage product={product} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/products/${product.id}`}
                                  className="truncate text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
                                >
                                  {product.name}
                                </Link>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                                <span className="font-semibold uppercase tracking-[0.12em] text-muted/90">{product.sku ?? "SKU yok"}</span>
                                {!complete ? (
                                  <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                                    Eksik veri
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", displayStatus.className)}>
                            {displayStatus.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <ProductChannels channels={product.active_channels} />
                        </td>
                        <td className="px-3 py-3 align-middle text-right">
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(product.sale_price)}</p>
                          <p className="mt-1 text-[11px] text-muted">Liste fiyatı</p>
                        </td>
                        <td className="px-3 py-3 align-middle text-right">
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(getBaseCost(product))}</p>
                          <p className="mt-1 text-[11px] text-muted tabular-nums">Ürün {formatCurrency(product.cost)}</p>
                        </td>
                        <td className="px-3 py-3 align-middle text-right">
                          <p className={cn("text-sm font-semibold tabular-nums", getMarginClasses(margin))}>
                            {margin == null ? "—" : `%${margin.toFixed(1)}`}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">En iyi kanal</p>
                        </td>
                        <td className="px-3 py-3 align-middle text-right">
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatNumber(getProductStock(product))}</p>
                          <p className={cn("mt-1 text-[11px]", isCriticalStock(product) ? "text-[#ff9c84]" : "text-muted")}>
                            {isCriticalStock(product) ? "Kritik seviye" : "Hazır stok"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <p className="text-sm font-semibold text-foreground">{lastUpdated.relative}</p>
                          <p className="mt-1 text-[11px] text-muted">{lastUpdated.absolute}</p>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex justify-end">
                            <div className="pointer-events-none flex flex-wrap items-center justify-end gap-1.5 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                              <TableActions product={product} onEdit={onEdit} onDelete={onDelete} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Eşleşen ürün bulunamadı"
          description="Aramayı daraltabilir ya da filtreleri temizleyerek ürün listesini yeniden görüntüleyebilirsiniz."
          action={
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setChannelFilter("all");
                setStatusFilter("all");
                setSortBy("updated-desc");
              }}
              className="btn-primary h-10 px-4 text-sm"
            >
              Filtreleri Temizle
            </button>
          }
        />
      )}
    </div>
  );
}
