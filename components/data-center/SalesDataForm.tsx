"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { Product } from "@/lib/types";

type SalesUpsertInput = {
  order_date: string;
  product_id: number;
  marketplace_id: number;
  quantity: number;
  unit_price: number;
  status: string;
  external_order_number?: string;
  external_package_number?: string;
  merchant_sku?: string;
};

type SalesDataFormProps = {
  isOpen: boolean;
  sale: any | null; // Pass sale item for editing
  onClose: () => void;
  onSubmit: (payload: SalesUpsertInput) => Promise<void> | void;
  isSubmitting: boolean;
};

export default function SalesDataForm({
  isOpen,
  sale,
  onClose,
  onSubmit,
  isSubmitting,
}: SalesDataFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [orderDate, setOrderDate] = useState("");
  const [productId, setProductId] = useState<number>(0);
  const [marketplaceId, setMarketplaceId] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [status, setStatus] = useState("completed");
  const [orderNumber, setOrderNumber] = useState("");
  const [packageNumber, setPackageNumber] = useState("");
  const [sku, setSku] = useState("");

  // Load products list on open
  useEffect(() => {
    if (isOpen) {
      setLoadingProducts(true);
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && Array.isArray(data.products)) {
            setProducts(data.products);
            if (data.products.length > 0 && !sale) {
              setProductId(data.products[0].id);
              setSku(data.products[0].sku || "");
            }
          }
        })
        .catch((err) => console.error("Failed to load products", err))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, sale]);

  // Load editing sale if present
  useEffect(() => {
    if (sale) {
      setOrderDate(sale.order_date || "");
      setProductId(sale.product_id || 0);
      setMarketplaceId(sale.marketplace_id || 1);
      setQuantity(sale.quantity || 1);
      setUnitPrice(sale.unit_price || 0);
      setStatus(sale.status || "completed");
      setOrderNumber(sale.external_order_number || "");
      setPackageNumber(sale.external_package_number || "");
      setSku(sale.product_sku || "");
    } else {
      // Default new form values
      const today = new Date().toISOString().slice(0, 10);
      setOrderDate(today);
      setMarketplaceId(1);
      setQuantity(1);
      setUnitPrice(0);
      setStatus("completed");
      setOrderNumber("");
      setPackageNumber("");
    }
    setError(null);
  }, [sale, isOpen]);

  const handleProductChange = (pId: number) => {
    setProductId(pId);
    const selected = products.find((p) => p.id === pId);
    if (selected) {
      setSku(selected.sku || "");
      // Pre-populate price with product default sale price if new record
      if (!sale && selected.sale_price) {
        setUnitPrice(selected.sale_price);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDate || !productId || !marketplaceId || quantity <= 0 || unitPrice < 0) {
      setError("Lütfen gerekli tüm alanları doldurun.");
      return;
    }

    try {
      await onSubmit({
        order_date: orderDate,
        product_id: productId,
        marketplace_id: marketplaceId,
        quantity,
        unit_price: unitPrice,
        status,
        external_order_number: orderNumber || undefined,
        external_package_number: packageNumber || undefined,
        merchant_sku: sku || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Kayıt sırasında hata oluştu.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-panel/60 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-panel shadow-[var(--shadow-card)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Satış yönetimi</p>
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {sale ? "Satış kaydını düzenle" : "Manuel satış ekle"}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-container text-muted transition-colors duration-200 hover:text-foreground disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error ? (
                <div className="flex gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Tarih</span>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Satış Kanalı</span>
                  <select
                    value={marketplaceId}
                    onChange={(e) => setMarketplaceId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  >
                    <option value={1}>Trendyol</option>
                    <option value={2}>Hepsiburada</option>
                    <option value={3}>Kendi Websitem</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Ürün Seçimi</span>
                {loadingProducts ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Ürün listesi yükleniyor...
                  </div>
                ) : (
                  <select
                    value={productId}
                    onChange={(e) => handleProductChange(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(SKU: ${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Adet</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Birim Fiyat (₺)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Sipariş Durumu</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  >
                    <option value="completed">Tamamlandı</option>
                    <option value="returned">İade</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">SKU / Kod</span>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="İsteğe bağlı ürün kodu"
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Sipariş No</span>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Dış sipariş no (örn. Trendyol no)"
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Paket No</span>
                  <input
                    type="text"
                    value={packageNumber}
                    onChange={(e) => setPackageNumber(e.target.value)}
                    placeholder="Kargo/Paket numarası"
                    className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/80">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card transition-colors duration-200 disabled:opacity-40"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || loadingProducts || products.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 transition-colors duration-200 disabled:opacity-55"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {sale ? "Güncelle" : "Ekle"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
