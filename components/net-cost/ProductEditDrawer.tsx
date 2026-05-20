"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Save, AlertCircle, Loader2, Package, Tag, Info, Truck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import CategorySelector from "../data-center/CategorySelector";
import type { Product, ProductUpsertInput } from "@/lib/types";

interface ProductEditDrawerProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedProduct: Product) => void;
}

export default function ProductEditDrawer({
  product,
  isOpen,
  onClose,
  onUpdate
}: ProductEditDrawerProps) {
  const [formData, setFormData] = useState<Partial<ProductUpsertInput>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category_id: product.category_id,
        category_path: product.category_path,
        cost: product.cost,
        packaging_cost: product.packaging_cost,
        desi: product.desi,
        sale_price: product.sale_price,
        active_channels: product.active_channels,
        status: (product.status as any) || 'active',
      });
    }
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    if (!formData.name?.trim()) {
      setError("Ürün adı boş olamaz.");
      setLoading(false);
      return;
    }
    if (!formData.category_path?.trim()) {
      setError("Kategori seçimi zorunludur.");
      setLoading(false);
      return;
    }
    if (Number(formData.cost) <= 0) {
      setError("Ürün maliyeti 0'dan büyük olmalıdır.");
      setLoading(false);
      return;
    }
    if (Number(formData.sale_price) <= 0) {
      setError("Satış fiyatı 0'dan büyük olmalıdır.");
      setLoading(false);
      return;
    }
    if (!formData.active_channels?.length) {
      setError("En az bir satış kanalı seçilmelidir.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        onUpdate({
          ...product,
          ...formData,
          name: formData.name!,
          category_id: formData.category_id ?? undefined,
          category_path: formData.category_path!,
          cost: Number(formData.cost!),
          packaging_cost: Number(formData.packaging_cost!),
          desi: Number(formData.desi!),
          sale_price: Number(formData.sale_price!),
          active_channels: formData.active_channels!,
          status: formData.status!,
        } as Product);
        onClose();
      } else {
        setError(data.error || "Güncelleme başarısız.");
      }
    } catch (err) {
      setError("Bir hata oluştu. Veriler geçici olarak yerel oturumda tutuluyor olabilir.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (channel: string) => {
    const current = formData.active_channels || [];
    if (current.includes(channel)) {
      setFormData({ ...formData, active_channels: current.filter(c => c !== channel) });
    } else {
      setFormData({ ...formData, active_channels: [...current, channel] });
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div className="fixed inset-0 z-[100] flex justify-end sm:items-stretch">
          <motion.div
            className="absolute inset-0 bg-panel/55 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          <motion.div
            className="relative flex h-[100dvh] w-full max-w-none flex-col border-l border-border/80 bg-panel shadow-[var(--shadow-card)] sm:max-w-xl"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
        <div className="border-b border-border/80 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted/60">
                Ürün düzenleme
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted/60">
                    Ürün bilgilerini güncelleyin. Değişiklikler tamamlandığında maliyet motoru yeni verilerle otomatik yenilenir.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface-container text-muted/60 transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:space-y-6 sm:px-8 sm:py-7">
          {error && (
            <div className="flex gap-3 rounded-2xl border border-danger/20 bg-danger/8 p-4 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <p>{error}</p>
            </div>
          )}

          <section className="rounded-xl border border-border/80 bg-surface-container p-5">
            <div className="mb-4 flex items-center gap-3">
              <Info className="h-4 w-4 text-primary/75" />
              <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-muted/60">
                Temel bilgiler
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                  Ürün adı
                </label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                  Kategori
                </label>
                <CategorySelector
                  initialValue={formData.category_path}
                  onSelect={(cat) => setFormData({ ...formData, category_id: cat.id, category_path: cat.path })}
                />
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border/80 bg-surface-container p-5">
              <div className="mb-4 flex items-center gap-3">
                <Truck className="h-4 w-4 text-primary/75" />
                <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-muted/60">
                  Maliyet ve lojistik
                </h3>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    Alış maliyeti (TL)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                    value={formData.cost || ""}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    Paketleme (TL)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                    value={formData.packaging_cost ?? ""}
                    onChange={(e) => setFormData({ ...formData, packaging_cost: Number(e.target.value) })}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    Desi
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                    value={formData.desi ?? ""}
                    onChange={(e) => setFormData({ ...formData, desi: Number(e.target.value) })}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    Hedef satış (TL)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                    value={formData.sale_price ?? ""}
                    onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border/80 bg-surface-container p-5">
              <div className="mb-4 flex items-center gap-3">
                <Tag className="h-4 w-4 text-primary/75" />
                <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-muted/60">
                  Durum
                </h3>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-2xl border border-border/80 bg-surface-container px-4 py-3.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
                    value={formData.status || "active"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="active" className="bg-panel text-foreground">
                      Aktif
                    </option>
                    <option value="passive" className="bg-panel text-foreground">
                      Pasif
                    </option>
                    <option value="draft" className="bg-panel text-foreground">
                      Taslak
                    </option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted/60">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-primary/70">
                    Satış kanalları
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      { id: "trendyol", name: "Trendyol" },
                      { id: "hepsiburada", name: "Hepsiburada" },
                      { id: "my_website", name: "Kendi web sitem" },
                    ].map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => toggleChannel(channel.id)}
                        className={cn(
                          "w-full rounded-2xl border px-3 py-2.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98]",
                          formData.active_channels?.includes(channel.id)
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border/80 bg-surface-container text-muted/60 hover:border-border hover:bg-surface-container"
                        )}
                      >
                        {channel.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-primary/15 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
                Sistem notu
              </h4>
            </div>
            <p className="text-sm leading-relaxed text-muted/60">
              Veriler güncellendiğinde aktif kampanya ve fiyatlandırma motorları yeni parametrelerle otomatik olarak
              senkronize edilir.
            </p>
          </section>
        </div>

          <div className="border-t border-border/80 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={onClose}
              className="btn-secondary w-full py-3.5 text-sm font-medium sm:flex-1"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium disabled:opacity-50 sm:flex-[2]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Değişiklikleri kaydet
                </>
              )}
            </button>
          </div>
        </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
