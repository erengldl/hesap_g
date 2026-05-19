"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Search, Sparkles } from "lucide-react";

import { GlassCard, SkeletonCard, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { calculateManualAdMetrics } from "@/lib/manual-ads/metrics";
import { MANUAL_AD_CREATIVE_FORMAT_LABELS, MANUAL_AD_PLATFORM_LABELS, type ManualAdCampaign, type ManualAdCampaignInput, type ManualAdCreativeFormat, type ManualAdPlatform } from "@/lib/manual-ads/types";
import { validateManualAdCampaignInput } from "@/lib/manual-ads/validation";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ManualAdMetricPreview } from "./ManualAdMetricPreview";

type ManualAdFormState = {
  name: string;
  selectedProductId: string;
  platform: ManualAdPlatform;
  creativeFormat: ManualAdCreativeFormat;
  startDate: string;
  endDate: string;
  totalSpend: string;
  ordersFromAds: string;
  revenueFromAds: string;
};

type ManualAdCreateFormProps = {
  className?: string;
};

const PLATFORM_OPTIONS: Array<{ value: ManualAdPlatform; label: string }> = [
  { value: "meta", label: MANUAL_AD_PLATFORM_LABELS.meta },
  { value: "google", label: MANUAL_AD_PLATFORM_LABELS.google },
  { value: "tiktok", label: MANUAL_AD_PLATFORM_LABELS.tiktok },
  { value: "other", label: MANUAL_AD_PLATFORM_LABELS.other },
];

const CREATIVE_FORMAT_OPTIONS: Array<{ value: ManualAdCreativeFormat; label: string }> = [
  { value: "video", label: MANUAL_AD_CREATIVE_FORMAT_LABELS.video },
  { value: "image", label: MANUAL_AD_CREATIVE_FORMAT_LABELS.image },
  { value: "carousel", label: MANUAL_AD_CREATIVE_FORMAT_LABELS.carousel },
  { value: "unknown", label: MANUAL_AD_CREATIVE_FORMAT_LABELS.unknown },
];

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function flattenErrors(errors: Record<string, string[]>) {
  return Object.values(errors).flat();
}

function buildCampaignInput(state: ManualAdFormState, selectedProduct: Product | null): ManualAdCampaignInput {
  return {
    name: state.name.trim(),
    platform: state.platform,
    startDate: state.startDate,
    endDate: state.endDate,
    totalSpend: toNumber(state.totalSpend) ?? 0,
    ordersFromAds: Math.max(0, Math.round(toNumber(state.ordersFromAds) ?? 0)),
    creativeFormat: state.creativeFormat,
    revenueFromAds: toNumber(state.revenueFromAds),
    productName: selectedProduct?.name.trim() || null,
    productSalePrice: selectedProduct ? selectedProduct.sale_price : null,
    estimatedProductCost: null,
    estimatedProductProfit: null,
    notes: null,
  };
}

function buildDraftCampaign(state: ManualAdFormState, selectedProduct: Product | null): ManualAdCampaign | null {
  const totalSpend = toNumber(state.totalSpend);
  const ordersFromAds = toNumber(state.ordersFromAds);

  if (!selectedProduct || totalSpend === null || ordersFromAds === null || totalSpend <= 0 || ordersFromAds < 0) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: "preview",
    name: state.name.trim() || "Önizleme",
    platform: state.platform,
    startDate: state.startDate,
    endDate: state.endDate,
    totalSpend,
    ordersFromAds: Math.max(0, Math.round(ordersFromAds)),
    revenueFromAds: toNumber(state.revenueFromAds),
    productName: selectedProduct.name,
    productSalePrice: selectedProduct.sale_price,
    estimatedProductCost: null,
    estimatedProductProfit: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  type?: "text" | "number" | "date";
}) {
  const baseClassName =
    "form-input";

  return (
    <label className="space-y-2">
      <span className="form-label !mb-0 flex items-center gap-1">
        {label}
        {required ? <span className="text-primary">*</span> : null}
      </span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={baseClassName} required={required} />
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
}) {
  const baseClassName =
    "form-select appearance-none";

  return (
    <label className="space-y-2">
      <span className="form-label !mb-0 flex items-center gap-1">
        {label}
        {required ? <span className="text-primary">*</span> : null}
      </span>
      <select value={value} onChange={onChange} className={baseClassName} required={required}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

function ProductPicker({
  products,
  loading,
  search,
  selectedProductId,
  onSearchChange,
  onSelectProduct,
  error,
}: {
  products: Product[];
  loading: boolean;
  search: string;
  selectedProductId: string;
  onSearchChange: (value: string) => void;
  onSelectProduct: (product: Product) => void;
  error?: string;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = normalizedSearch.length === 0
    ? products
    : products.filter((product) => {
        const name = product.name.toLowerCase();
        const sku = product.sku?.toLowerCase() ?? "";
        const category = product.category_path?.toLowerCase() ?? "";
        return name.includes(normalizedSearch) || sku.includes(normalizedSearch) || category.includes(normalizedSearch);
      });

  const selectedProduct = products.find((product) => String(product.id) === selectedProductId) ?? null;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-container p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="block text-sm font-medium text-foreground">
            İlgili ürün <span className="text-primary">*</span>
          </span>
          <p className="mt-1 text-xs text-muted">
            Veri merkezindeki ürünlerden birini seç. Ciro boşsa ürün fiyatı üzerinden tahmin edilir.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "Ürünler yükleniyor" : `${formatNumber(products.length)} ürün`}
        </span>
      </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={loading ? "Ürünler yükleniyor..." : "Ürün veya SKU ara"}
            className="form-input pl-9"
          />
        </div>

      {selectedProduct ? (
        <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Seçili ürün</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedProduct.name}</p>
              <p className="mt-1 text-xs text-soft">
                {selectedProduct.category_path?.trim() || selectedProduct.category_name?.trim() || "Kategori yok"}
                {selectedProduct.sku ? ` · SKU ${selectedProduct.sku}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Satış fiyatı</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedProduct.sale_price)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-container p-4 text-sm text-muted">
          Önizleme için ürün seç.
        </div>
      )}

      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} variant="card" height={72} delayIndex={index} className="w-full" />
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-container p-4 text-sm text-muted">
            Bu aramaya uygun ürün bulunamadı. Farklı bir ad veya SKU dene.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isSelected = selectedProductId === String(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelectProduct(product)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors duration-200",
                  isSelected
                    ? "border-primary/30 bg-primary/10"
                    : "border-border bg-surface-container hover:border-primary/20 hover:bg-surface-container"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {product.category_path?.trim() || product.category_name?.trim() || "Kategori yok"}
                      {product.sku ? ` · SKU ${product.sku}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {isSelected ? "Seçildi" : "Seç"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(product.sale_price)}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function ManualAdCreateForm({ className }: ManualAdCreateFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [form, setForm] = useState<ManualAdFormState>({
    name: "",
    selectedProductId: "",
    platform: "meta",
    creativeFormat: "unknown",
    startDate: todayKey(),
    endDate: todayKey(),
    totalSpend: "",
    ordersFromAds: "",
    revenueFromAds: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setProductLoading(true);
      setProductError(null);

      try {
        const response = await fetch("/api/products?limit=200", { cache: "no-store" });
        const data = (await response.json()) as { success?: boolean; products?: Product[]; error?: string };

        if (!cancelled && response.ok && data?.success && Array.isArray(data.products)) {
          setProducts(data.products);
          return;
        }

        if (!cancelled) {
          setProductError(data?.error || "Ürünler yüklenemedi.");
        }
      } catch (error) {
        if (!cancelled) {
          setProductError(error instanceof Error ? error.message : "Ürünler yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setProductLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = products.find((product) => String(product.id) === form.selectedProductId) ?? null;
  const candidate = buildCampaignInput(form, selectedProduct);
  const validation = validateManualAdCampaignInput(candidate);
  const validationFieldErrors = validation.ok ? null : validation.errors;
  const validationErrors = validation.ok ? [] : flattenErrors(validation.errors);
  const previewCampaign = buildDraftCampaign(form, selectedProduct);
  const previewMetrics = previewCampaign ? calculateManualAdMetrics(previewCampaign) : null;

  const updateField = <K extends keyof ManualAdFormState>(key: K, value: ManualAdFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  function handleSelectProduct(product: Product) {
    setForm((current) => ({
      ...current,
      selectedProductId: String(product.id),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!validation.ok) {
      setSubmitError("Formu göndermeden önce zorunlu alanları tamamla.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/manual-ads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.value),
      });

      const payload = (await response.json()) as
        | { success: true; campaign: ManualAdCampaign }
        | { success: false; error?: string };

      if (!response.ok || !("success" in payload) || !payload.success) {
        throw new Error(payload && "error" in payload ? payload.error || "Analiz oluşturulamadı." : "Analiz oluşturulamadı.");
      }

      router.push(`/reklam-analizi/${payload.campaign.id}/chat`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Analiz oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("grid gap-6 xl:grid-cols-[1.1fr_0.9fr]", className)}>
      <GlassCard className="border border-border bg-surface-container">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Yeni manuel analiz</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Kampanya verisini kısa gir</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Sadece gerekli alanları alıyoruz. Ürün seçimi veri merkezinden yapılır, ciro boşsa ürün fiyatı ile tahmin edilir.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <WarningBadge>API bağlantısı yok</WarningBadge>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Manuel akış
              </span>
            </div>
          </div>

          {submitError ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Kampanya adı"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              error={validationFieldErrors?.name?.[0]}
              placeholder="Örn. Yaz kampanyası - 1"
              required
            />

            <SelectField
              label="Platform"
              value={form.platform}
              onChange={(event) => updateField("platform", event.target.value as ManualAdPlatform)}
              options={PLATFORM_OPTIONS}
              required
            />

            <SelectField
              label="Reklam türü"
              value={form.creativeFormat}
              onChange={(event) => updateField("creativeFormat", event.target.value as ManualAdCreativeFormat)}
              options={CREATIVE_FORMAT_OPTIONS}
              required
              error={validationFieldErrors?.creativeFormat?.[0]}
            />

            <TextField
              label="Toplam reklam harcaması"
              value={form.totalSpend}
              onChange={(event) => updateField("totalSpend", event.target.value)}
              error={validationFieldErrors?.totalSpend?.[0]}
              placeholder="Örn. 12500"
              type="number"
              required
            />

            <TextField
              label="Reklamdan gelen sipariş sayısı"
              value={form.ordersFromAds}
              onChange={(event) => updateField("ordersFromAds", event.target.value)}
              error={validationFieldErrors?.ordersFromAds?.[0]}
              placeholder="Örn. 43"
              type="number"
              required
            />

            <TextField
              label="Reklamdan gelen ciro"
              value={form.revenueFromAds}
              onChange={(event) => updateField("revenueFromAds", event.target.value)}
              error={validationFieldErrors?.revenueFromAds?.[0]}
              placeholder="İsteğe bağlı"
              type="number"
            />
          </div>

          <ProductPicker
            products={products}
            loading={productLoading}
            search={productSearch}
            selectedProductId={form.selectedProductId}
            onSearchChange={setProductSearch}
            onSelectProduct={handleSelectProduct}
            error={validationFieldErrors?.productName?.[0] || validationFieldErrors?.productSalePrice?.[0] || productError || undefined}
          />

          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Gelir notu</p>
                <p className="mt-1 text-sm text-soft">
                  Ciro boş bırakılırsa seçili ürünün satış fiyatı ile sipariş sayısı çarpılır ve tahmini ciro kullanılır.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-1.5 text-xs font-semibold text-soft">
                {selectedProduct ? formatCurrency(selectedProduct.sale_price) : "Ürün seç"}
              </span>
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4">
              <p className="text-sm font-semibold text-warning">Doğrulama notları</p>
              <div className="mt-2 space-y-1 text-sm text-warning/90">
                {validationErrors.map((error) => (
                  <p key={error}>• {error}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/reklam-analizi"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
            >
              <ArrowLeft className="h-4 w-4" />
              Listeye dön
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !validation.ok}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Manuel analizi oluştur
            </button>
          </div>
        </form>
      </GlassCard>

      <div className="xl:sticky xl:top-6">
        <ManualAdMetricPreview metrics={previewMetrics} validationErrors={validationErrors} />
      </div>
    </div>
  );
}
