"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Image as ImageIcon, Info, Loader2, Package, ShoppingBag, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import CategorySelector from "./CategorySelector";
import type { Product, ProductUpsertInput } from "@/lib/types";

interface ProductDataFormProps {
  isOpen: boolean;
  product?: Product | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (product: ProductUpsertInput) => Promise<void> | void;
  onImagePersisted?: (productId: number, imageUrl: string) => Promise<void> | void;
}

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  image_url: string;
  category_id: number | null;
  category_path: string;
  description: string;
  cost: string;
  packaging_cost: string;
  desi: string;
  sale_price: string;
  active_channels: string[];
  status: "active" | "passive" | "draft";
};

const DEFAULT_FORM_STATE: FormState = {
  name: "",
  sku: "",
  barcode: "",
  image_url: "",
  category_id: null,
  category_path: "",
  description: "",
  cost: "",
  packaging_cost: "",
  desi: "",
  sale_price: "",
  active_channels: [],
  status: "active",
};

function getFormState(product?: Product | null): FormState {
  if (!product) return DEFAULT_FORM_STATE;

  return {
    name: product.name ?? "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? product.sku ?? "",
    image_url: product.image_url ?? "",
    category_id: product.category_id ?? null,
    category_path: product.category_path ?? product.category_name ?? "",
    description: product.description ?? "",
    cost: String(product.cost ?? ""),
    packaging_cost: String(product.packaging_cost ?? ""),
    desi: String(product.desi ?? ""),
    sale_price: String(product.sale_price ?? ""),
    active_channels: product.active_channels ?? [],
    status: (product.status === "passive" || product.status === "draft" ? product.status : "active"),
  };
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Görsel okunamadı."));
    };
    image.src = imageUrl;
  });
}

async function cropImageToSquare(file: File) {
  const image = await loadImageElement(file);
  const squareSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (!squareSize || squareSize <= 0) {
    throw new Error("Görsel boyutu okunamadı.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = squareSize;
  canvas.height = squareSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Kırpma işlemi başlatılamadı.");
  }

  const sourceX = Math.floor(((image.naturalWidth || image.width) - squareSize) / 2);
  const sourceY = Math.floor(((image.naturalHeight || image.height) - squareSize) / 2);
  context.drawImage(image, sourceX, sourceY, squareSize, squareSize, 0, 0, squareSize, squareSize);

  const mimeType =
    file.type === "image/png"
      ? "image/png"
      : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, mimeType === "image/jpeg" ? 0.92 : undefined);
  });

  if (!blob) {
    throw new Error("Kırpılmış görsel oluşturulamadı.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";

  return new File([blob], `${baseName}-square${extension}`, { type: mimeType });
}

export default function ProductDataForm({
  isOpen,
  product,
  isSubmitting = false,
  onClose,
  onSubmit,
  onImagePersisted,
}: ProductDataFormProps) {
  const [formData, setFormData] = useState<FormState>(getFormState(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(product?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const updateImagePreviewUrl = (nextUrl: string | null) => {
    const previousUrl = previewUrlRef.current;
    if (previousUrl?.startsWith("blob:") && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    previewUrlRef.current = nextUrl;
    setImagePreviewUrl(nextUrl);
  };

  useEffect(() => {
    if (isOpen) {
      setFormData(getFormState(product));
      setErrors({});
      setIsUploadingImage(false);
      setIsDeletingImage(false);
      setImageUploadError("");
      updateImagePreviewUrl(product?.image_url ?? null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, product]);

  useEffect(() => {
    return () => {
      const currentUrl = previewUrlRef.current;
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, []);

  const channels = [
    { id: "trendyol", label: "Trendyol" },
    { id: "hepsiburada", label: "Hepsiburada" },
    { id: "my_website", label: "Kendi Websitem" },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Ürün adı boş olamaz.";
    if (!formData.category_path) newErrors.category = "Kategori seçilmeden ürün eklenemez.";
    if (!formData.cost || Number(formData.cost) <= 0) newErrors.cost = "Ürün maliyeti 0’dan büyük olmalı.";
    if (!formData.sale_price || Number(formData.sale_price) <= 0) newErrors.sale_price = "Satış fiyatı 0’dan büyük olmalı.";
    if (formData.desi && Number(formData.desi) < 0) newErrors.desi = "Desi 0’dan küçük olamaz.";
    if (formData.active_channels.length === 0) newErrors.channels = "En az bir satış kanalı seçilmeli.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      active_channels: prev.active_channels.includes(channelId)
        ? prev.active_channels.filter((id) => id !== channelId)
        : [...prev.active_channels, channelId],
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageUploadError("Sadece görsel dosyaları yüklenebilir.");
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setImageUploadError("Görsel boyutu 5 MB sınırını aşmamalı.");
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError("");

    try {
      const squareFile = await cropImageToSquare(file);
      updateImagePreviewUrl(URL.createObjectURL(squareFile));
      const uploadData = new FormData();
      uploadData.append("file", squareFile, squareFile.name);

      const response = await fetch("/api/v1/products/upload-image", {
        method: "POST",
        body: uploadData,
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; url?: string; error?: string }
        | null;

      if (!response.ok || !data?.success || !data.url) {
        throw new Error(data?.error || "Görsel yüklenemedi.");
      }

      updateImagePreviewUrl(data.url ?? null);
      setFormData((prev) => ({
        ...prev,
        image_url: data.url ?? "",
      }));

      if (product?.id) {
        const persistResponse = await fetch(`/api/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: data.url,
          }),
        });

        const persistData = (await persistResponse.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!persistResponse.ok || !persistData?.success) {
          if (data.url) {
            await fetch(`/api/v1/products/upload-image?url=${encodeURIComponent(data.url)}`, {
              method: "DELETE",
            }).catch(() => null);
          }
          throw new Error(persistData?.error || "Görsel kaydedilemedi.");
        }

        await onImagePersisted?.(product.id, data.url);
      }

      setImageUploadError("");
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (isUploadingImage || isDeletingImage) {
      return;
    }

    const currentImageUrl = formData.image_url.trim() || imagePreviewUrl || "";
    if (!currentImageUrl) {
      return;
    }

    setImageUploadError("");

    if (!product?.id) {
      if (currentImageUrl.startsWith("/uploads/products/")) {
        setIsDeletingImage(true);
        try {
          const response = await fetch(`/api/v1/products/upload-image?url=${encodeURIComponent(currentImageUrl)}`, {
            method: "DELETE",
          });

          const data = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || "Görsel silinemedi.");
          }
        } catch (error) {
          setImageUploadError(error instanceof Error ? error.message : "Görsel silinemedi.");
          return;
        } finally {
          setIsDeletingImage(false);
        }
      }

      setFormData((prev) => ({ ...prev, image_url: "" }));
      updateImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsDeletingImage(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "",
        }),
      });

      const data = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Görsel silinemedi.");
      }

      setFormData((prev) => ({ ...prev, image_url: "" }));
      updateImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await onImagePersisted?.(product.id, "");
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Görsel silinemedi.");
    } finally {
      setIsDeletingImage(false);
    }
  };

  const resetAndClose = () => {
    setFormData(DEFAULT_FORM_STATE);
    setErrors({});
    setIsUploadingImage(false);
    setIsDeletingImage(false);
    setImageUploadError("");
    updateImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingImage || isDeletingImage) {
      setImageUploadError("Görsel işlemi sürerken ürünü kaydedemezsin.");
      return;
    }
    if (!validate()) return;

    await onSubmit({
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      image_url: formData.image_url.trim() || undefined,
      category_id: formData.category_id,
      category_path: formData.category_path,
      cost: Number(formData.cost),
      packaging_cost: Number(formData.packaging_cost || "0"),
      desi: Number(formData.desi || "0"),
      sale_price: Number(formData.sale_price),
    active_channels: formData.active_channels,
    status: formData.status,
    barcode: formData.barcode.trim() || undefined,
    description: formData.description.trim() || undefined,
  });

    resetAndClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-panel/60 backdrop-blur-sm z-[60] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={resetAndClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-full max-w-none flex-col border-l border-border bg-panel shadow-[var(--shadow-card)] transition-transform duration-500 ease-out sm:max-w-lg",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex-none border-b border-border/80 bg-panel/95 px-5 py-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{product ? "Ürünü Düzenle" : "Yeni Ürün"}</h2>
                <p className="text-xs text-muted">Ürünün temel maliyet ve satış bilgilerini girin.</p>
              </div>
            </div>
            <button
              onClick={resetAndClose}
              className="p-2 hover:bg-surface-container rounded-xl text-muted hover:text-foreground transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form id="product-data-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 custom-scrollbar sm:px-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Adı</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Siyah Erkek Kol Saati"
                  className={cn("form-input", errors.name && "border-danger/50")}
                />
                {errors.name && <p className="text-[10px] text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.name}</p>}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kod</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="WTCH-001"
                    className="form-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="869100000001"
                    className="form-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Görseli</label>
                  <div className="min-w-0 rounded-xl border border-border bg-surface-container p-4 space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageUpload}
                    />

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <div className="aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-container">
                          {imagePreviewUrl ? (
                            <div
                              className="h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url(${imagePreviewUrl})` }}
                              role="img"
                              aria-label={formData.name || "Ürün görseli"}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-surface-container/60 to-cyan-500/20 text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground/70">
                              Kare
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-foreground">
                            <ImageIcon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold">Bilgisayardan görsel yükle</span>
                          </div>
                          <p className="text-xs text-muted">JPG, PNG, WebP veya GIF. Görsel istemci tarafında kare kırpılır. En fazla 5 MB.</p>
                          {imageUploadError && (
                            <p className="text-[10px] text-danger flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {imageUploadError}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage || isDeletingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:opacity-60 sm:ml-auto sm:w-auto"
                      >
                        {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploadingImage ? "Görsel yükleniyor..." : "Dosya Seç"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                        URL gerekmez. Dosya seçildiğinde kare kırpılır ve otomatik olarak depolamaya kaydedilir.
                      </p>

                      {(imagePreviewUrl || formData.image_url) && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage || isDeletingImage}
                          className="action-inline-button-danger disabled:opacity-60"
                        >
                          {isDeletingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {isDeletingImage ? "Siliniyor..." : "Görseli Kaldır"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Açıklaması</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ürün hakkında kısa açıklama"
                    rows={4}
                    className="form-input min-h-[104px] resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kategori</label>
                <CategorySelector
                  onSelect={(cat) => setFormData((prev) => ({ ...prev, category_id: cat.id, category_path: cat.path }))}
                  initialValue={formData.category_path}
                />
                {errors.category && <p className="text-[10px] text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.category}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Üretim / Alış Maliyeti (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="0.00"
                  className={cn("form-input", errors.cost && "border-danger/50")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Paketleme Maliyeti (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.packaging_cost}
                  onChange={(e) => setFormData({ ...formData, packaging_cost: e.target.value })}
                  placeholder="0.00"
                  className="form-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Desi</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.desi}
                  onChange={(e) => setFormData({ ...formData, desi: e.target.value })}
                  placeholder="0.0"
                  className="form-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Satış Fiyatı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  placeholder="0.00"
                  className={cn("form-input border-primary/20", errors.sale_price && "border-danger/50")}
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Aktif Satış Kanalları</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleToggleChannel(channel.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-colors duration-200 text-left group",
                      formData.active_channels.includes(channel.id)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-surface-container border-border/80 text-muted hover:border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingBag className={cn("w-4 h-4", formData.active_channels.includes(channel.id) ? "text-primary" : "text-muted")} />
                      <span className="text-sm font-medium">{channel.label}</span>
                    </div>
                    {formData.active_channels.includes(channel.id) && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
              {errors.channels && <p className="text-[10px] text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.channels}</p>}
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Durumu</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { id: "active", label: "Aktif" },
                  { id: "passive", label: "Pasif" },
                  { id: "draft", label: "Taslak" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: item.id as FormState["status"] })}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-colors duration-200",
                      formData.status === item.id
                        ? "bg-surface-container border-border-strong text-foreground"
                        : "bg-transparent border-border/80 text-muted hover:text-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-info/20 bg-info/5 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info shrink-0" />
              <p className="text-[10px] text-info/70 leading-relaxed">
                Ürün kaydedildiğinde maliyet motoru tüm satış kanalları için yeniden hesaplanır.
              </p>
            </div>
          </div>
          <div className="flex-none border-t border-border/80 bg-panel/95 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={resetAndClose}
                className="btn-secondary w-full flex-1 py-3 text-sm font-bold"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                form="product-data-form"
                disabled={isSubmitting || isUploadingImage}
                className="btn-primary w-full flex-1 py-3 text-sm font-bold disabled:opacity-60"
              >
                {isSubmitting ? "Kaydediliyor..." : isUploadingImage ? "Görsel yükleniyor..." : product ? "Güncelle" : "Ürünü Ekle"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          background: var(--surface-container);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius);
          padding: 10px 14px;
          color: white;
          font-size: 14px;
          transition: all 0.2s;
        }
        .form-input:focus {
          outline: none;
          border-color: color-mix(in_srgb,var(--success) 30%, transparent);
          background: var(--surface-strong);
        }
      `}</style>
    </>
  );
}
