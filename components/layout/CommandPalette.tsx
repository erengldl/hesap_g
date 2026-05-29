"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { advancedNavigationItems, primaryNavigationItems } from "./navigation";

type SearchResult = {
  type: "page" | "product";
  label: string;
  sublabel?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PAGES: SearchResult[] = primaryNavigationItems.map((item) => ({
  type: "page",
  label: item.name,
  sublabel: item.description,
  href: item.href,
  icon: item.icon,
}));

const MORE_PAGES: SearchResult[] = advancedNavigationItems.map((item) => ({
  type: "page",
  label: item.name,
  sublabel: item.description,
  href: item.href,
  icon: item.icon,
}));

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchResult[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open || productsLoaded || productsLoading) return;

    const controller = new AbortController();

    void (async () => {
      setProductsLoading(true);
      try {
        const res = await fetch("/api/products?limit=100", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (data?.products) {
          setProducts(data.products.map((p: { id: number; name: string; sku: string }) => ({
            type: "product" as const,
            label: p.name,
            sublabel: `Kod: ${p.sku ?? "Belirtilmedi"}`,
            href: `/products/${p.id}`,
            icon: Package,
          })));
          setProductsLoaded(true);
        }
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          // Silent by design.
        }
      } finally {
        setProductsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, productsLoaded, productsLoading]);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const allResults = useMemo(() => [...PAGES, ...MORE_PAGES, ...products], [products]);

  const filtered = useMemo(() => (
    query.trim()
      ? allResults.filter((r) =>
        `${r.label} ${r.sublabel ?? ""}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
      : [...PAGES, ...products].slice(0, 6)
  ), [allResults, query, products]);

  const navigate = useCallback((result: SearchResult) => {
    onOpenChange(false);
    if (result.href) router.push(result.href);
  }, [onOpenChange, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-panel/50 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />

      <div className="relative z-10 mx-3 w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-border bg-panel/96 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Ara: sayfa veya ürün"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted">
              {productsLoading && query.trim() ? "Arama sonuçları hazırlanıyor..." : "Sonuç bulunamadı."}
            </div>
          ) : (
            filtered.map((result, i) => (
              <button
                key={`${result.type}-${result.label}`}
                onClick={() => navigate(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200",
                  i === selectedIndex
                    ? "border-border bg-surface-container"
                    : "border-transparent hover:border-border hover:bg-surface-container"
                )}
              >
                <result.icon className={cn("h-4 w-4 shrink-0", i === selectedIndex ? "text-primary" : "text-muted")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{result.label}</p>
                  {result.sublabel && (
                    <p className="truncate text-[10px] text-muted">{result.sublabel}</p>
                  )}
                </div>
                <span className={cn(
                  "rounded-md border px-2 py-0.5 text-[8px] uppercase tracking-[0.12em]",
                  result.type === "page" ? "border-border bg-surface-container text-muted" :
                  "border-primary/20 bg-primary/5 text-primary"
                )}>
                  {result.type === "page" ? "Sayfa" : "Ürün"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
