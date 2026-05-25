"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, Image as ImageIcon, Info, Loader2, Package, ShoppingBag, Trash2, Upload, X } from "lucide-react";

import { FormField, FormTextarea } from "@/components/ui-custom/FormComponents";
import { parseLocaleNumberValue, productSchema, type ProductSchemaInput } from "@/lib/validation-schemas";
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

const DEFAULT_FORM_STATE: ProductSchemaInput = {
  name: "",
  sku: "",
  barcode: "",
  image_url: "",
  category_id: null,
  category_path: "",
  description: "",
  cost: "",
  packaging_cost: "0",
  desi: "0",
  sale_price: "",
  active_channels: [],
  status: "active",
};

function getFormState(product?: Product | null): ProductSchemaInput {
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
    packaging_cost: String(product.packaging_cost ?? 0),
    desi: String(product.desi ?? 0),
    sale_price: String(product.sale_price ?? ""),
    active_channels: product.active_channels ?? [],
    status: product.status === "passive" || product.status === "draft" ? product.status : "active",
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
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductSchemaInput>({
    resolver: zodResolver(productSchema),
    mode: "onChange",
    defaultValues: getFormState(product),
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(product?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const productName = useWatch({ control, name: "name" }) ?? "";
  const categoryPath = useWatch({ control, name: "category_path" }) ?? "";
  const activeChannels = useWatch({ control, name: "active_channels" }) ?? [];
  const selectedStatus = useWatch({ control, name: "status" }) ?? "active";
  const imageUrlValue = useWatch({ control, name: "image_url" }) ?? "";

  const channels = [
    { id: "trendyol", label: "Trendyol" },
    { id: "hepsiburada", label: "Hepsiburada" },
    { id: "my_website", label: "Kendi Websitem" },
  ] as const;

  const statuses = [
    { id: "active", label: "Aktif" },
    { id: "passive", label: "Pasif" },
    { id: "draft", label: "Taslak" },
  ] as const;

  const updateImagePreviewUrl = (nextUrl: string | null) => {
    const previousUrl = previewUrlRef.current;
    if (previousUrl?.startsWith("blob:") && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    previewUrlRef.current = nextUrl;
    setImagePreviewUrl(nextUrl);
  };

  useEffect(() => {
    register("category_id");
    register("category_path");
    register("active_channels");
    register("status");
    register("image_url");
  }, [register]);

  useEffect(() => {
    if (isOpen) {
      reset(getFormState(product));
      setIsUploadingImage(false);
      setIsDeletingImage(false);
      setImageUploadError("");
      updateImagePreviewUrl(product?.image_url ?? null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, product, reset]);

  useEffect(() => {
    return () => {
      const currentUrl = previewUrlRef.current;
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, []);

  const handleToggleChannel = (channelId: (typeof channels)[number]["id"]) => {
    const currentChannels = getValues("active_channels") ?? [];
    const nextChannels = currentChannels.includes(channelId)
      ? currentChannels.filter((id) => id !== channelId)
      : [...currentChannels, channelId];

    setValue("active_channels", nextChannels, { shouldDirty: true, shouldValidate: true });
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

      updateImagePreviewUrl(data.url);
      setValue("image_url", data.url, { shouldDirty: true, shouldValidate: true });

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

    const currentImageUrl = (getValues("image_url") ?? "").trim() || imagePreviewUrl || "";
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

      setValue("image_url", "", { shouldDirty: true, shouldValidate: true });
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

      setValue("image_url", "", { shouldDirty: true, shouldValidate: true });
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
    reset(DEFAULT_FORM_STATE);
    setIsUploadingImage(false);
    setIsDeletingImage(false);
    setImageUploadError("");
    updateImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const onValidSubmit = async (values: ProductSchemaInput) => {
    if (isUploadingImage || isDeletingImage) {
      setImageUploadError("Görsel işlemi sürerken ürünü kaydedemezsiniz.");
      return;
    }

    await onSubmit({
      name: values.name.trim(),
      sku: values.sku?.trim() || undefined,
      barcode: values.barcode?.trim() || undefined,
      image_url: values.image_url?.trim() || undefined,
      category_id: values.category_id,
      category_path: values.category_path,
      description: values.description?.trim() || undefined,
      cost: parseLocaleNumberValue(values.cost),
      packaging_cost: parseLocaleNumberValue(values.packaging_cost),
      desi: parseLocaleNumberValue(values.desi),
      sale_price: parseLocaleNumberValue(values.sale_price),
      active_channels: values.active_channels,
      status: values.status as ProductUpsertInput["status"],
    });

    resetAndClose();
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit(onValidSubmit)(event);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-panel/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{product ? "Ürünü Düzenle" : "Yeni Ürün"}</h2>
                <p className="text-xs text-muted">Ürünün temel maliyet ve satış bilgilerini girin.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form id="product-data-form" onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
            <div className="space-y-6">
              <FormField
                id="product_name"
                label="Ürün Adı"
                placeholder="Örn: Siyah Erkek Kol Saati"
                error={errors.name?.message}
                {...register("name")}
              />

              <div className="space-y-4">
                <FormField
                  id="product_sku"
                  label="Kod"
                  placeholder="WTCH-001"
                  error={errors.sku?.message}
                  {...register("sku")}
                />

                <FormField
                  id="product_barcode"
                  label="Barkod"
                  placeholder="869100000001"
                  error={errors.barcode?.message}
                  {...register("barcode")}
                />

                <div className="space-y-2">
                  <label className="form-label">Ürün Görseli</label>
                  <div className="min-w-0 space-y-4 rounded-xl border border-border bg-surface-container p-4">
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
                              aria-label={productName || "Ürün görseli"}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-surface-container/60 to-cyan-500/20 text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground/70">
                              Kare
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-foreground">
                            <ImageIcon className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Bilgisayardan görsel yükle</span>
                          </div>
                          <p className="text-xs text-muted">
                            JPG, PNG, WebP veya GIF. Görsel istemci tarafında kare kırpılır. En fazla 5 MB.
                          </p>
                          {imageUploadError ? (
                            <p className="flex items-center gap-1 text-[10px] text-danger">
                              <AlertCircle className="h-3 w-3" />
                              {imageUploadError}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage || isDeletingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:opacity-60 sm:ml-auto sm:w-auto"
                      >
                        {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {isUploadingImage ? "Görsel yükleniyor..." : "Dosya Seç"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                        URL gerekmez. Dosya seçildiğinde kare kırpılır ve otomatik olarak depolamaya kaydedilir.
                      </p>

                      {(imagePreviewUrl || imageUrlValue) && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage || isDeletingImage}
                          className="action-inline-button-danger disabled:opacity-60"
                        >
                          {isDeletingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {isDeletingImage ? "Siliniyor..." : "Görseli Kaldır"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <FormTextarea
                  id="product_description"
                  label="Ürün Açıklaması"
                  rows={4}
                  placeholder="Ürün hakkında kısa açıklama"
                  error={errors.description?.message}
                  textareaClassName="min-h-[104px] resize-none"
                  {...register("description")}
                />
              </div>

              <div className="space-y-2">
                <label className="form-label">Kategori</label>
                <CategorySelector
                  onSelect={(category) => {
                    setValue("category_id", category.id, { shouldDirty: true });
                    setValue("category_path", category.path, { shouldDirty: true, shouldValidate: true });
                  }}
                  initialValue={categoryPath}
                />
                {errors.category_path?.message ? (
                  <p className="flex items-center gap-1 text-[10px] text-danger">
                    <AlertCircle className="h-3 w-3" />
                    {errors.category_path.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="product_cost"
                type="number"
                step="0.01"
                label="Üretim / Alış Maliyeti (TL)"
                placeholder="0.00"
                error={errors.cost?.message}
                {...register("cost")}
              />
              <FormField
                id="product_packaging_cost"
                type="number"
                step="0.01"
                label="Paketleme Maliyeti (TL)"
                placeholder="0.00"
                error={errors.packaging_cost?.message}
                {...register("packaging_cost")}
              />
              <FormField
                id="product_desi"
                type="number"
                step="0.1"
                label="Desi"
                placeholder="0.0"
                error={errors.desi?.message}
                {...register("desi")}
              />
              <FormField
                id="product_sale_price"
                type="number"
                step="0.01"
                label="Satış Fiyatı (TL)"
                placeholder="0.00"
                error={errors.sale_price?.message}
                inputClassName="border-primary/20"
                {...register("sale_price")}
              />
            </div>

            <div className="space-y-4">
              <label className="form-label">Aktif Satış Kanalları</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {channels.map((channel) => {
                  const isSelected = activeChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => handleToggleChannel(channel.id)}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border p-4 text-left transition-colors duration-200",
                        isSelected
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/80 bg-surface-container text-muted hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted")} />
                        <span className="text-sm font-medium">{channel.label}</span>
                      </div>
                      {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
              {errors.active_channels?.message ? (
                <p className="flex items-center gap-1 text-[10px] text-danger">
                  <AlertCircle className="h-3 w-3" />
                  {errors.active_channels.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <label className="form-label">Ürün Durumu</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {statuses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setValue("status", item.id, { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      "flex-1 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase transition-colors duration-200",
                      selectedStatus === item.id
                        ? "border-border-strong bg-surface-container text-foreground"
                        : "border-border/80 bg-transparent text-muted hover:text-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-info/20 bg-info/5 p-4">
              <Info className="h-5 w-5 shrink-0 text-info" />
              <p className="text-[10px] leading-relaxed text-info/70">
                Ürün kaydedildiğinde maliyet motoru tüm satış kanalları için yeniden hesaplanır.
              </p>
            </div>
          </div>

          <div className="flex-none border-t border-border/80 bg-panel/95 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={resetAndClose} className="btn-secondary w-full flex-1 py-3 text-sm font-bold">
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
    </>
  );
}
