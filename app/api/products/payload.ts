import type { ProductUpsertInput } from "@/lib/types";

export function normalizeCreateProductPayload(body: Partial<ProductUpsertInput>): ProductUpsertInput {
  const parsedCategoryId = Number(body.category_id ?? 0);

  return {
    name: String(body.name ?? "").trim(),
    sku: String(body.sku ?? "").trim() || undefined,
    barcode: String(body.barcode ?? body.sku ?? "").trim() || undefined,
    image_url: String(body.image_url ?? "").trim() || undefined,
    category_id: Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null,
    category_path: String(body.category_path ?? "").trim(),
    description: String(body.description ?? "").trim() || undefined,
    cost: Number(body.cost ?? 0),
    packaging_cost: Number(body.packaging_cost ?? 0),
    desi: Number(body.desi ?? 0),
    sale_price: Number(body.sale_price ?? 0),
    active_channels: Array.isArray(body.active_channels) ? body.active_channels.map(String) : [],
    status: body.status === "passive" || body.status === "draft" ? body.status : "active",
  };
}

export function validateCreateProductPayload(payload: ProductUpsertInput) {
  const errors: string[] = [];

  if (!payload.name) {
    errors.push("Ürün adı zorunludur.");
  }

  if (!payload.category_path) {
    errors.push("Kategori zorunludur.");
  }

  if (!Number.isFinite(payload.cost) || payload.cost <= 0) {
    errors.push("Maliyet 0'dan büyük olmalıdır.");
  }

  if (!Number.isFinite(payload.packaging_cost) || payload.packaging_cost < 0) {
    errors.push("Paketleme 0 veya daha büyük olmalıdır.");
  }

  if (!Number.isFinite(payload.desi) || payload.desi < 0) {
    errors.push("Desi 0 veya daha büyük olmalıdır.");
  }

  if (!Number.isFinite(payload.sale_price) || payload.sale_price <= 0) {
    errors.push("Satış fiyatı 0'dan büyük olmalıdır.");
  }

  if (!Array.isArray(payload.active_channels) || payload.active_channels.length === 0) {
    errors.push("En az bir satış kanalı seçilmelidir.");
  }

  return errors;
}
