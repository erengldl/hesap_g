import type { ManualAdCampaignInput, ManualAdCreativeFormat, ManualAdPlatform } from "./types";

export type ManualAdCampaignValidationResult =
  | { ok: true; value: ManualAdCampaignInput }
  | { ok: false; errors: Record<string, string[]> };

const PLATFORM_VALUES: ManualAdPlatform[] = ["meta", "google", "tiktok", "other"];
const CREATIVE_FORMAT_VALUES: ManualAdCreativeFormat[] = ["image", "video", "carousel", "unknown"];

function addError(errors: Record<string, string[]>, field: string, message: string) {
  const items = errors[field] ?? [];
  items.push(message);
  errors[field] = items;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | null {
  const trimmed = readTrimmedString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readDateKey(value: unknown): string | null {
  const trimmed = readTrimmedString(value);
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return trimmed.slice(0, 10);
}

function isValidPlatform(value: string): value is ManualAdPlatform {
  return PLATFORM_VALUES.includes(value as ManualAdPlatform);
}

function isValidCreativeFormat(value: string): value is ManualAdCreativeFormat {
  return CREATIVE_FORMAT_VALUES.includes(value as ManualAdCreativeFormat);
}

export function validateManualAdCampaignInput(input: unknown): ManualAdCampaignValidationResult {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string[]> = {};

  const name = readTrimmedString(body.name);
  if (!name) {
    addError(errors, "name", "Kampanya adı zorunludur.");
  }

  const platformInput = readTrimmedString(body.platform);
  if (!isValidPlatform(platformInput)) {
    addError(errors, "platform", "Platform geçerli olmalıdır.");
  }
  const platform: ManualAdPlatform = isValidPlatform(platformInput) ? platformInput : "other";

  const startDate = readDateKey(body.startDate);
  if (!startDate) {
    addError(errors, "startDate", "Başlangıç tarihi geçerli olmalıdır.");
  }

  const endDate = readDateKey(body.endDate);
  if (!endDate) {
    addError(errors, "endDate", "Bitiş tarihi geçerli olmalıdır.");
  }

  const totalSpend = readNumber(body.totalSpend);
  if (totalSpend === null) {
    addError(errors, "totalSpend", "Toplam harcama sayısal bir değer olmalıdır.");
  } else if (totalSpend <= 0) {
    addError(errors, "totalSpend", "Toplam harcama 0'dan büyük olmalıdır.");
  }

  const ordersFromAds = readNumber(body.ordersFromAds);
  if (ordersFromAds === null) {
    addError(errors, "ordersFromAds", "Sipariş sayısı sayısal bir değer olmalıdır.");
  } else if (ordersFromAds < 0) {
    addError(errors, "ordersFromAds", "Sipariş sayısı negatif olamaz.");
  } else if (!Number.isInteger(ordersFromAds)) {
    addError(errors, "ordersFromAds", "Sipariş sayısı tam sayı olmalıdır.");
  }

  const revenueFromAds = readNumber(body.revenueFromAds);
  if (revenueFromAds !== null && revenueFromAds < 0) {
    addError(errors, "revenueFromAds", "Ciro negatif olamaz.");
  }

  const creativeFormatInput = readTrimmedString(body.creativeFormat);
  if (creativeFormatInput && !isValidCreativeFormat(creativeFormatInput)) {
    addError(errors, "creativeFormat", "Reklam türü geçerli olmalıdır.");
  }

  const productName = readOptionalString(body.productName);
  if (!productName) {
    addError(errors, "productName", "İlgili ürün seçilmelidir.");
  }

  const productSalePrice = readNumber(body.productSalePrice);
  if (productSalePrice !== null && productSalePrice < 0) {
    addError(errors, "productSalePrice", "Ürün satış fiyatı negatif olamaz.");
  }

  if (productName && productSalePrice === null) {
    addError(errors, "productSalePrice", "İlgili ürünün satış fiyatı bulunamadı.");
  }

  const estimatedProductCost = readNumber(body.estimatedProductCost);
  if (estimatedProductCost !== null && estimatedProductCost < 0) {
    addError(errors, "estimatedProductCost", "Ürün başı tahmini maliyet negatif olamaz.");
  }

  const estimatedProductProfit = readNumber(body.estimatedProductProfit);
  if (estimatedProductProfit !== null && estimatedProductProfit < 0) {
    addError(errors, "estimatedProductProfit", "Ürün başı tahmini net kâr negatif olamaz.");
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end.getTime() < start.getTime()) {
      addError(errors, "endDate", "Bitiş tarihi başlangıç tarihinden önce olamaz.");
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      platform,
      startDate: startDate as string,
      endDate: endDate as string,
      totalSpend: Number(totalSpend),
      ordersFromAds: Number(ordersFromAds),
      creativeFormat: creativeFormatInput && isValidCreativeFormat(creativeFormatInput) ? creativeFormatInput : "unknown",
      revenueFromAds: revenueFromAds ?? null,
      productName,
      productSalePrice: productSalePrice ?? null,
      estimatedProductCost: estimatedProductCost ?? null,
      estimatedProductProfit: estimatedProductProfit ?? null,
      notes: readOptionalString(body.notes),
    },
  };
}
