"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check, Search, X, ArrowLeft, Loader2, FolderOpen } from "lucide-react";

/* ─── Types ─── */
export type CategoryNode = {
  id: string;
  name: string;
  children?: CategoryNode[];
  kategoriId?: number;
};

export type SelectedCategory = {
  id: string;
  name: string;
  path: string;
  numericId?: number | null;
};

type CategorySelectorProps = {
  categories?: CategoryNode[];
  value?: SelectedCategory | null;
  onChange?: (category: SelectedCategory | null) => void;
  initialValue?: string;
  onSelect?: (category: { id: number | null; path: string }) => void;
};

/* ─── Fallback Tree ─── */
const fallbackCategories: CategoryNode[] = [
  {
    id: "aksesuar", name: "Aksesuar", children: [
      { id: "aksesuar-saat", name: "Saat", children: [
        { id: "aksesuar-saat-erkek", name: "Erkek Saatleri" },
        { id: "aksesuar-saat-kadin", name: "Kadın Saatleri" },
        { id: "aksesuar-saat-cocuk", name: "Çocuk Saatleri" },
        { id: "aksesuar-saat-seti", name: "Saat Seti" },
        { id: "aksesuar-saat-kordonu", name: "Saat Kordonu" },
      ]},
      { id: "aksesuar-taki", name: "Takı", children: [
        { id: "aksesuar-taki-kolye", name: "Kolye" },
        { id: "aksesuar-taki-bileklik", name: "Bileklik" },
        { id: "aksesuar-taki-yuzuk", name: "Yüzük" },
      ]},
      { id: "aksesuar-gozluk", name: "Gözlük", children: [
        { id: "aksesuar-gozluk-gunes", name: "Güneş Gözlüğü" },
        { id: "aksesuar-gozluk-optik", name: "Optik Gözlük" },
      ]},
      { id: "aksesuar-kemer", name: "Kemer" },
      { id: "aksesuar-canta", name: "Çanta" },
    ],
  },
  {
    id: "elektronik", name: "Elektronik", children: [
      { id: "elektronik-giyilebilir", name: "Giyilebilir Teknoloji", children: [
        { id: "elektronik-akilli-saat", name: "Akıllı Saat" },
        { id: "elektronik-akilli-cocuk-saati", name: "Akıllı Çocuk Saati" },
        { id: "elektronik-akilli-bileklik", name: "Akıllı Bileklik" },
      ]},
      { id: "elektronik-telefon-aksesuar", name: "Telefon Aksesuarları" },
      { id: "elektronik-kulaklik", name: "Kulaklık" },
    ],
  },
  {
    id: "giyim", name: "Giyim", children: [
      { id: "giyim-erkek", name: "Erkek Giyim" },
      { id: "giyim-kadin", name: "Kadın Giyim" },
      { id: "giyim-cocuk", name: "Çocuk Giyim" },
    ],
  },
  {
    id: "ayakkabi", name: "Ayakkabı", children: [
      { id: "ayakkabi-erkek", name: "Erkek Ayakkabı" },
      { id: "ayakkabi-kadin", name: "Kadın Ayakkabı" },
      { id: "ayakkabi-spor", name: "Spor Ayakkabı" },
    ],
  },
  {
    id: "ev-mobilya", name: "Ev & Mobilya", children: [
      { id: "ev-mobilya-mobilya", name: "Mobilya" },
      { id: "ev-mobilya-dekorasyon", name: "Dekorasyon" },
      { id: "ev-mobilya-mutfak", name: "Mutfak" },
    ],
  },
  {
    id: "kozmetik", name: "Kozmetik & Kişisel Bakım", children: [
      { id: "kozmetik-parfum", name: "Parfüm" },
      { id: "kozmetik-cilt-bakimi", name: "Cilt Bakımı" },
      { id: "kozmetik-sac-bakimi", name: "Saç Bakımı" },
    ],
  },
];

/* ─── Helpers ─── */
function flattenCategories(nodes: CategoryNode[], parentPath: string[] = []): SelectedCategory[] {
  const result: SelectedCategory[] = [];
  for (const node of nodes) {
    const currentPath = [...parentPath, node.name];
    const hasChildren = Boolean(node.children?.length);
    const numericId = resolveCategoryId(node.id, node.kategoriId);
    // Only include leaf nodes in search results
    if (!hasChildren) {
      result.push({ id: node.id, name: node.name, path: currentPath.join(" > "), numericId });
    }
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, currentPath));
    }
  }
  return result;
}

function resolveCategoryId(id: string, kategoriId?: number | null) {
  if (typeof kategoriId === "number" && Number.isFinite(kategoriId) && kategoriId > 0) {
    return kategoriId;
  }

  const numericId = Number(id);
  if (Number.isFinite(numericId) && numericId > 0) {
    return numericId;
  }

  return null;
}

/* ─── Component ─── */
export default function CategorySelector({
  categories: initialCategories,
  value,
  onChange,
  initialValue,
  onSelect,
}: CategorySelectorProps) {
  /* API categories */
  const [apiCategories, setApiCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>("fallback");

  useEffect(() => {
    setLoading(true);
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.categories?.length > 0) {
          setApiCategories(data.categories);
          setDataSource(data.source || "database");
        }
      })
      .catch(() => setDataSource("fallback"))
      .finally(() => setLoading(false));
  }, []);

  const tree = initialCategories?.length
    ? initialCategories
    : apiCategories.length > 0
    ? apiCategories
    : fallbackCategories;

  /* Refs */
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* State */
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [navigationPath, setNavigationPath] = useState<CategoryNode[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState<SelectedCategory | null>(
    value ?? (initialValue ? { id: "0", name: initialValue, path: initialValue } : null)
  );

  const selectedCategory = value ?? internalValue;

  useEffect(() => {
    if (value) {
      setInternalValue(value);
      return;
    }

    setInternalValue(initialValue ? { id: "0", name: initialValue, path: initialValue } : null);
  }, [initialValue, value]);

  /* Derived */
  const currentItems = navigationPath.length === 0
    ? tree
    : navigationPath[navigationPath.length - 1].children ?? [];

  const flatList = useMemo(() => flattenCategories(tree), [tree]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return flatList.filter((c) => c.path.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
  }, [searchTerm, flatList]);

  const breadcrumb = navigationPath.map((n) => n.name);

  const visibleItems = searchTerm ? searchResults : currentItems;

  /* Actions */
  const selectCategory = useCallback(
    (category: SelectedCategory) => {
      setInternalValue(category);
      onChange?.(category);
      onSelect?.({ id: category.numericId ?? resolveCategoryId(category.id), path: category.path });
      setIsOpen(false);
      setSearchTerm("");
      setNavigationPath([]);
      setHighlightIndex(-1);
    },
    [onChange, onSelect]
  );

  const handleCategoryClick = useCallback(
    (category: CategoryNode) => {
      const hasChildren = Boolean(category.children?.length);
      if (hasChildren) {
        setNavigationPath((prev) => [...prev, category]);
        setSearchTerm("");
        setHighlightIndex(-1);
        return;
      }
      const fullPath = [...navigationPath.map((n) => n.name), category.name];
      selectCategory({
        id: category.id,
        name: category.name,
        path: fullPath.join(" > "),
        numericId: resolveCategoryId(category.id, category.kategoriId),
      });
    },
    [navigationPath, selectCategory]
  );

  const clearSelection = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setInternalValue(null);
      onChange?.(null);
      onSelect?.({ id: null, path: "" });
      setSearchTerm("");
      setNavigationPath([]);
      setHighlightIndex(-1);
    },
    [onChange, onSelect]
  );

  const goBack = useCallback(() => {
    setNavigationPath((prev) => prev.slice(0, -1));
    setHighlightIndex(-1);
  }, []);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
    setHighlightIndex(-1);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm("");
    setNavigationPath([]);
    setHighlightIndex(-1);
  }, []);

  /* Click outside & Escape */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) closeDropdown();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") closeDropdown();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeDropdown]);

  /* Keyboard nav inside dropdown */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      const items = visibleItems;
      const max = items.length;
      if (max === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % max);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev <= 0 ? max - 1 : prev - 1));
      } else if (e.key === "Enter" && highlightIndex >= 0 && highlightIndex < max) {
        e.preventDefault();
        const item = items[highlightIndex];
        if (searchTerm) {
          // search result → direct select
          selectCategory(item as SelectedCategory);
        } else {
          handleCategoryClick(item as CategoryNode);
        }
      } else if (e.key === "Backspace" && searchTerm === "" && navigationPath.length > 0) {
        e.preventDefault();
        goBack();
      }
    },
    [isOpen, visibleItems, highlightIndex, searchTerm, navigationPath, selectCategory, handleCategoryClick, goBack]
  );

  /* Scroll highlighted into view */
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  /* ─── Render ─── */
  return (
    <div ref={wrapperRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className={[
          "flex min-h-[58px] w-full items-center justify-between rounded-xl border px-4 text-left transition-colors duration-200",
          "border-border bg-surface-container text-foreground backdrop-blur-xl",
          "hover:border-success/50 hover:bg-surface-container",
          isOpen ? "border-success/70 shadow-[var(--shadow-card)]" : "",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Seçili Kategori
          </span>
          <span className={["truncate text-sm", selectedCategory ? "text-foreground" : "text-muted"].join(" ")}>
            {selectedCategory?.path || "Kategori seçin..."}
          </span>
        </div>

        <div className="ml-3 flex items-center gap-2">
          {selectedCategory && (
            <span
              onClick={clearSelection}
              className="rounded-xl p-1 text-muted transition-colors duration-200 hover:bg-surface-container hover:text-soft active:scale-[0.98]"
            >
              <X size={16} />
            </span>
          )}
          <ChevronDown
            size={18}
            className={["text-muted transition-colors duration-200", isOpen ? "rotate-180 text-success" : ""].join(" ")}
          />
        </div>
      </button>

      {/* Selected Badge */}
      {selectedCategory && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs text-success">
          <Check size={12} />
          Seçili kategori: {selectedCategory.path}
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute z-50 mt-3 w-full overflow-hidden rounded-2xl border border-border bg-panel/98 shadow-[var(--shadow-card)] shadow-[var(--shadow-card)] backdrop-blur-2xl"
          style={{ animation: "categoryDropdownIn 0.18s ease-out" }}
        >
          {/* Search */}
          <div className="border-b border-border/80 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-container px-3 py-2.5 transition-colors duration-200 focus-within:border-success/40">
              <Search size={15} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightIndex(-1);
                }}
                placeholder="Tüm kategorilerde ara..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              {searchTerm && (
                <button type="button" onClick={() => { setSearchTerm(""); setHighlightIndex(-1); }} className="text-muted transition-colors duration-200 hover:text-soft active:scale-[0.98]">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Breadcrumb & Back Button */}
            {!searchTerm && navigationPath.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-container px-3 py-1.5 text-xs text-soft transition-colors duration-200 hover:border-success/40 hover:bg-success/5 hover:text-success"
                >
                  <ArrowLeft size={13} />
                  Geri
                </button>
                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  {breadcrumb.map((crumb, i) => (
                    <span key={i} className="flex shrink-0 items-center gap-1">
                      {i > 0 && <ChevronRight size={12} className="text-muted" />}
                      <span
                        className={[
                          "truncate text-xs",
                          i === breadcrumb.length - 1 ? "font-medium text-success" : "text-muted",
                        ].join(" ")}
                      >
                        {crumb}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category count */}
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {searchTerm
                ? `${searchResults.length} sonuç`
                : navigationPath.length > 0
                ? `${currentItems.length} alt kategori`
                : `${currentItems.length} ana kategori`}
            </span>
            {dataSource === "database" && (
              <span className="text-[9px] text-success">● Veritabanı</span>
            )}
          </div>

          {/* List */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1.5 custom-scrollbar">
            {loading && apiCategories.length === 0 && (
              <div className="flex items-center justify-center gap-2 p-10 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Kategoriler hazırlanıyor...</span>
              </div>
            )}

            {searchTerm ? (
              searchResults.length > 0 ? (
                searchResults.map((cat, idx) => (
                  <button
                    type="button"
                    key={cat.id + "-" + cat.path}
                    onClick={() => selectCategory(cat)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors duration-200",
                      highlightIndex === idx
                        ? "bg-success/15 text-success"
                        : "text-soft hover:bg-success/10 hover:text-success",
                    ].join(" ")}
                  >
                    <span className="mr-3 min-w-0 truncate">{cat.path}</span>
                    <Check size={15} className="shrink-0 text-success/70" />
                  </button>
                ))
              ) : (
                <div className="px-3 py-10 text-center text-sm text-muted">
                  Kategori bulunamadı.
                </div>
              )
            ) : currentItems.length > 0 ? (
              currentItems.map((category, idx) => {
                const cat = category as CategoryNode;
                const hasChildren = Boolean(cat.children?.length);
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat)}
                    className={[
                      "group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors duration-200",
                      highlightIndex === idx
                        ? "bg-success/15 text-success"
                        : "text-soft hover:bg-success/10 hover:text-success",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2.5">
                      {hasChildren && (
                        <FolderOpen size={15} className="shrink-0 text-muted transition-colors duration-200 group-hover:text-success/60" />
                      )}
                      <span>{cat.name}</span>
                      {hasChildren && (
                        <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] text-muted">
                          {cat.children!.length}
                        </span>
                      )}
                    </div>
                    {hasChildren ? (
                      <ChevronRight size={16} className="shrink-0 text-muted transition-colors duration-200 group-hover:translate-x-0.5 group-hover:text-success/60" />
                    ) : (
                      <Check size={15} className="shrink-0 text-success/50" />
                    )}
                  </button>
                );
              })
            ) : (
              !loading && (
                <div className="px-3 py-10 text-center text-sm text-muted">
                  Alt kategori bulunamadı.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Dropdown animation */}
      <style jsx>{`
        @keyframes categoryDropdownIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--surface-strong);
          border-radius: var(--radius-sm);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--border-strong);
        }
      `}</style>
    </div>
  );
}
