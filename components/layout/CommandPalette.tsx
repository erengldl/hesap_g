"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CloudDownload,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  dispatchCommandAction,
  type CommandActionKey,
  queueCommandAction,
} from "@/lib/command-actions";
import { advancedNavigationItems, primaryNavigationItems } from "./navigation";

type SearchResultType = "page" | "product" | "order" | "action";
type SearchGroupKey = "pages" | "products" | "orders" | "actions";

type SearchResult = {
  id: string;
  type: SearchResultType;
  group: SearchGroupKey;
  label: string;
  sublabel: string;
  href?: string;
  icon: LucideIcon;
  actionKey?: CommandActionKey;
};

type SearchGroup = {
  key: SearchGroupKey;
  label: string;
  items: SearchResult[];
};

type ProductApiResult = {
  id: number;
  name: string;
  sku?: string | null;
  sale_price?: number | null;
};

type SalesHistoryRow = {
  order_id: number;
  external_order_number: string | null;
  marketplace_name: string | null;
  product_name: string | null;
  line_total: number;
};

type SalesHistoryResponse = {
  success?: boolean;
  sales_history?: SalesHistoryRow[];
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

const PAGE_RESULTS: SearchResult[] = [
  ...primaryNavigationItems,
  ...advancedNavigationItems,
].map((item) => ({
  id: `page:${item.href}`,
  type: "page",
  group: "pages",
  label: item.name,
  sublabel: item.description,
  href: item.href,
  icon: item.icon,
}));

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

function matchesSearch(result: SearchResult, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return `${result.label} ${result.sublabel}`.toLocaleLowerCase("tr").includes(normalizedQuery);
}

function limitGroups(groups: SearchGroup[]) {
  let remaining = MAX_RESULTS;
  const limited: SearchGroup[] = [];

  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }

    const items = group.items.slice(0, remaining);
    if (items.length === 0) {
      continue;
    }

    limited.push({
      ...group,
      items,
    });
    remaining -= items.length;
  }

  return limited;
}

function getResultBadge(type: SearchResultType) {
  switch (type) {
    case "product":
      return "Ürün";
    case "order":
      return "Sipariş";
    case "action":
      return "İşlem";
    default:
      return "Sayfa";
  }
}

function getResultStyles(type: SearchResultType, selected: boolean) {
  const styles = {
    page: {
      icon: selected ? "border-info/25 bg-info/10 text-info" : "border-border/70 bg-surface-container text-muted",
      badge: "border-border bg-surface-container text-muted",
    },
    product: {
      icon: selected ? "border-success/25 bg-success/10 text-success" : "border-success/15 bg-success/10 text-success",
      badge: "border-success/20 bg-success/10 text-success",
    },
    order: {
      icon: selected ? "border-warning/25 bg-warning/10 text-warning" : "border-warning/15 bg-warning/10 text-warning",
      badge: "border-warning/20 bg-warning/10 text-warning",
    },
    action: {
      icon: selected ? "border-primary/25 bg-primary/10 text-primary" : "border-primary/15 bg-primary/10 text-primary",
      badge: "border-primary/20 bg-primary/10 text-primary",
    },
  };

  return styles[type];
}

function buildActionResults(demoSeedAvailable: boolean): SearchResult[] {
  const actions: SearchResult[] = [
    {
      id: "action:open-product-form",
      type: "action",
      group: "actions",
      label: "Yeni Ürün Ekle",
      sublabel: "Veri Merkezi içinde yeni ürün formunu aç",
      href: "/veri-merkezi",
      icon: Plus,
      actionKey: "open-product-form",
    },
    {
      id: "action:open-excel-import",
      type: "action",
      group: "actions",
      label: "Excel İçe Aktar",
      sublabel: "Ürün listesini Excel dosyasından toplu yükle",
      href: "/veri-merkezi",
      icon: FileSpreadsheet,
      actionKey: "open-excel-import",
    },
    {
      id: "action:go-dashboard",
      type: "action",
      group: "actions",
      label: "Özete Git",
      sublabel: "Genel performans görünümünü aç",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  if (demoSeedAvailable) {
    actions.splice(2, 0, {
      id: "action:seed-demo-data",
      type: "action",
      group: "actions",
      label: "Demo Veri Yükle",
      sublabel: "Örnek katalog ve sipariş verilerini geri yükle",
      href: "/veri-merkezi",
      icon: CloudDownload,
      actionKey: "seed-demo-data",
    });
  }

  return actions;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const demoSeedAvailable = true;
  const inputRef = useRef<HTMLInputElement>(null);
  const productCacheRef = useRef(new Map<string, SearchResult[]>());
  const orderCacheRef = useRef(new Map<string, SearchResult[]>());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [productResults, setProductResults] = useState<SearchResult[]>([]);
  const [orderResults, setOrderResults] = useState<SearchResult[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);
  const normalizedDebouncedQuery = useMemo(() => normalizeSearch(debouncedQuery), [debouncedQuery]);
  const actionResults = useMemo(() => buildActionResults(demoSeedAvailable), [demoSeedAvailable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (normalizedDebouncedQuery.length < MIN_QUERY_LENGTH) {
      setProductResults([]);
      setOrderResults([]);
      setProductsLoading(false);
      setOrdersLoading(false);
      return;
    }

    const controller = new AbortController();
    const cachedProducts = productCacheRef.current.get(normalizedDebouncedQuery);
    const cachedOrders = orderCacheRef.current.get(normalizedDebouncedQuery);

    if (cachedProducts) {
      setProductResults(cachedProducts);
    } else {
      setProductsLoading(true);
    }

    if (cachedOrders) {
      setOrderResults(cachedOrders);
    } else {
      setOrdersLoading(true);
    }

    const fetchProducts = async () => {
      if (cachedProducts) {
        return cachedProducts;
      }

      const response = await fetch(
        `/api/products?limit=4&q=${encodeURIComponent(debouncedQuery)}`,
        { cache: "no-store", signal: controller.signal }
      );
      const data = (await response.json().catch(() => null)) as
        | { products?: ProductApiResult[] }
        | null;

      const nextResults = Array.isArray(data?.products)
        ? data.products.map((product) => ({
            id: `product:${product.id}`,
            type: "product" as const,
            group: "products" as const,
            label: product.name,
            sublabel: `${product.sku?.trim() || "SKU yok"} · ${
              product.sale_price != null ? formatCurrency(product.sale_price) : "Fiyat yok"
            }`,
            href: `/urun/${product.id}`,
            icon: Package,
          }))
        : [];

      productCacheRef.current.set(normalizedDebouncedQuery, nextResults);
      return nextResults;
    };

    const fetchOrders = async () => {
      if (cachedOrders) {
        return cachedOrders;
      }

      const response = await fetch(
        `/api/data-center/sales-history?view=sales&page=1&page_size=8&search=${encodeURIComponent(debouncedQuery)}`,
        { cache: "no-store", signal: controller.signal }
      );
      const data = (await response.json().catch(() => null)) as SalesHistoryResponse | null;
      const rows = Array.isArray(data?.sales_history) ? data.sales_history : [];
      const seen = new Set<string>();
      const nextResults: SearchResult[] = [];

      for (const row of rows) {
        const searchValue = row.external_order_number?.trim() || String(row.order_id);
        if (seen.has(searchValue)) {
          continue;
        }

        seen.add(searchValue);
        nextResults.push({
          id: `order:${row.order_id}:${searchValue}`,
          type: "order",
          group: "orders",
          label: row.external_order_number?.trim() || `#${row.order_id}`,
          sublabel: `${row.product_name || "Ürün"} · ${row.marketplace_name || "Kanal"} · ${formatCurrency(row.line_total ?? 0)}`,
          href: `/veri-merkezi?tab=sales&search=${encodeURIComponent(searchValue)}`,
          icon: ShoppingCart,
        });

        if (nextResults.length >= 4) {
          break;
        }
      }

      orderCacheRef.current.set(normalizedDebouncedQuery, nextResults);
      return nextResults;
    };

    void Promise.all([fetchProducts(), fetchOrders()])
      .then(([nextProducts, nextOrders]) => {
        setProductResults(nextProducts);
        setOrderResults(nextOrders);
      })
      .catch((error) => {
        if ((error as DOMException).name !== "AbortError") {
          setProductResults([]);
          setOrderResults([]);
        }
      })
      .finally(() => {
        setProductsLoading(false);
        setOrdersLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, normalizedDebouncedQuery, open]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
        return;
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
    setQuery("");
    setDebouncedQuery("");
    setSelectedIndex(0);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) {
      return limitGroups([
        {
          key: "actions",
          label: "Hızlı işlemler",
          items: actionResults,
        },
        {
          key: "pages",
          label: "Sayfalar",
          items: PAGE_RESULTS.slice(0, 4),
        },
      ]);
    }

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const groups: SearchGroup[] = [
      {
        key: "products",
        label: "Ürünler",
        items: productResults,
      },
      {
        key: "orders",
        label: "Siparişler",
        items: orderResults,
      },
      {
        key: "pages",
        label: "Sayfalar",
        items: PAGE_RESULTS.filter((result) => matchesSearch(result, normalizedQuery)),
      },
      {
        key: "actions",
        label: "İşlemler",
        items: actionResults.filter((result) => matchesSearch(result, normalizedQuery)),
      },
    ];

    return limitGroups(groups);
  }, [actionResults, normalizedQuery, orderResults, productResults]);

  const visibleResults = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups]
  );
  const visibleIndexById = useMemo(
    () => new Map(visibleResults.map((result, index) => [result.id, index])),
    [visibleResults]
  );

  useEffect(() => {
    setSelectedIndex((current) => {
      if (visibleResults.length === 0) {
        return 0;
      }

      return Math.min(current, visibleResults.length - 1);
    });
  }, [visibleResults]);

  const loading = productsLoading || ordersLoading;
  const isDebouncing =
    normalizedQuery.length >= MIN_QUERY_LENGTH &&
    normalizedQuery !== normalizedDebouncedQuery;

  const navigate = useCallback((result: SearchResult) => {
    onOpenChange(false);

    if (result.actionKey) {
      const targetPath = result.href?.split("?")[0];
      const shouldQueue = Boolean(targetPath && pathname !== targetPath);
      if (shouldQueue) {
        queueCommandAction(result.actionKey);
      }
      dispatchCommandAction(result.actionKey);
    }

    if (result.href) {
      router.push(result.href);
    }
  }, [onOpenChange, pathname, router]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (visibleResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % visibleResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      navigate(visibleResults[selectedIndex]);
    }
  }, [navigate, onOpenChange, selectedIndex, visibleResults]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]">
      <div
        className="absolute inset-0 bg-panel/50 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-10 mx-3 w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl border border-border bg-panel/96 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-surface-container text-muted">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ürün, sipariş, sayfa veya işlem ara"
              className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted/60"
            />
            <p className="mt-1 text-[11px] text-muted/70">
              ↑↓ seç · Enter git · Esc kapat
            </p>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-2 py-2">
          {!normalizedQuery ? (
            visibleGroups.map((group, groupIndex) => (
              <div
                key={group.key}
                className={cn(groupIndex > 0 && "mt-4 border-t border-border/70 pt-4")}
              >
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((result) => {
                    const index = visibleIndexById.get(result.id) ?? 0;
                    const selected = index === selectedIndex;
                    const styles = getResultStyles(result.type, selected);

                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200",
                          selected
                            ? "border-border bg-surface-container"
                            : "border-transparent hover:border-border/80 hover:bg-surface-container/80"
                        )}
                      >
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", styles.icon)}>
                          <result.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{result.label}</p>
                          <p className="truncate text-xs text-muted">{result.sublabel}</p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", styles.badge)}>
                          {getResultBadge(result.type)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : normalizedQuery.length < MIN_QUERY_LENGTH ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">En az 2 karakter yazın</p>
              <p className="mt-1 text-xs text-muted">Ürün, sipariş, sayfa ve hızlı işlemler bu eşiğin ardından listelenir.</p>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                {loading || isDebouncing ? "Arama sonuçları hazırlanıyor..." : "Sonuç bulunamadı."}
              </p>
              <p className="mt-1 text-xs text-muted">
                Farklı bir SKU, sipariş numarası veya sayfa adı deneyin.
              </p>
            </div>
          ) : (
            visibleGroups.map((group, groupIndex) => (
              <div
                key={group.key}
                className={cn(groupIndex > 0 && "mt-4 border-t border-border/70 pt-4")}
              >
                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                    {group.label}
                  </p>
                  <span className="text-[10px] text-muted/50">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.items.map((result) => {
                    const index = visibleIndexById.get(result.id) ?? 0;
                    const selected = index === selectedIndex;
                    const styles = getResultStyles(result.type, selected);

                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200",
                          selected
                            ? "border-border bg-surface-container"
                            : "border-transparent hover:border-border/80 hover:bg-surface-container/80"
                        )}
                      >
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", styles.icon)}>
                          <result.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{result.label}</p>
                          <p className="truncate text-xs text-muted">{result.sublabel}</p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", styles.badge)}>
                          {getResultBadge(result.type)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/80 px-4 py-3 text-[11px] text-muted/70">
          <span>Sonuçlar 8 kayıt ile sınırlıdır.</span>
          <span>Ctrl/Cmd + K</span>
        </div>
      </div>
    </div>
  );
}
