import type {
  ChannelSeoBulkRequest,
  ChannelSeoContent,
  ChannelSeoOptimizationInput,
  ChannelSeoStatus,
  ChannelSeoTone,
  SalesChannel,
} from "./types";
import { isSalesChannel } from "./channel-rules";

type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: Record<string, string[]> };

const VALID_STATUSES: ChannelSeoStatus[] = [
  "not_optimized",
  "draft",
  "optimized",
  "needs_update",
  "error",
];

const VALID_TONES: ChannelSeoTone[] = ["professional", "friendly", "premium", "persuasive", "simple"];

function addError(errors: Record<string, string[]>, field: string, message: string) {
  const current = errors[field] ?? [];
  current.push(message);
  errors[field] = current;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | null {
  const trimmed = readTrimmedString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeArray(values?: string[] | null) {
  return Array.from(new Set((values ?? []).map((item) => item.trim()).filter((item) => item.length > 0)));
}

function isValidTone(value: unknown): value is ChannelSeoTone {
  return typeof value === "string" && VALID_TONES.includes(value as ChannelSeoTone);
}

function isValidStatus(value: unknown): value is ChannelSeoStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ChannelSeoStatus);
}

function validateProductLike(input: unknown, errors: Record<string, string[]>) {
  const product = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!product) {
    addError(errors, "product", "Ürün bilgisi zorunludur.");
    return null;
  }

  const id = readTrimmedString(product.id);
  if (!id) {
    addError(errors, "product.id", "productId boş olamaz.");
  }

  const name = readTrimmedString(product.name);
  if (!name) {
    addError(errors, "product.name", "Ürün adı zorunludur.");
  }

  return {
    id,
    name,
    category: readOptionalString(product.category),
    brand: readOptionalString(product.brand),
    sku: readOptionalString(product.sku),
    barcode: readOptionalString(product.barcode),
    imageUrl: readOptionalString(product.imageUrl),
    baseDescription: readOptionalString(product.baseDescription),
    features: Array.isArray(product.features) ? readStringArray(product.features) : null,
    attributes: product.attributes && typeof product.attributes === "object" ? (product.attributes as Record<string, string | number | boolean | null>) : null,
    price: typeof product.price === "number" && Number.isFinite(product.price) ? product.price : null,
    stock: typeof product.stock === "number" && Number.isFinite(product.stock) ? product.stock : null,
    variants: Array.isArray(product.variants) ? readStringArray(product.variants) : null,
  };
}

function buildQualityWarnings(product: ChannelSeoOptimizationInput["product"]) {
  const warnings: string[] = [];

  if (!product.category) {
    warnings.push("Kategori bilgisi eksik.");
  }
  if (!product.baseDescription) {
    warnings.push("Ürün açıklaması eksik.");
  }
  if (!product.price || product.price <= 0) {
    warnings.push("Satış fiyatı eksik veya sıfır.");
  }
  if (!product.sku && !product.barcode) {
    warnings.push("SKU veya barkod eksik.");
  }
  if (!product.stock && product.stock !== 0) {
    warnings.push("Stok bilgisi eksik.");
  }
  if (!product.brand) {
    warnings.push("Marka bilgisi eksik.");
  }

  return warnings;
}

export function validateChannelSeoOptimizationInput(input: unknown): ValidationResult<ChannelSeoOptimizationInput> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string[]> = {};
  const product = validateProductLike(body.product, errors);
  const channel = body.channel;

  if (!isSalesChannel(channel)) {
    addError(errors, "channel", "Satış kanalı geçerli olmalıdır.");
  }

  const tone = body.tone;
  if (tone !== undefined && tone !== null && !isValidTone(tone)) {
    addError(errors, "tone", "Ton geçerli olmalıdır.");
  }

  const existingTitle = readOptionalString(body.existingTitle);
  const existingDescription = readOptionalString(body.existingDescription);
  const userInstructions = readOptionalString(body.userInstructions);
  const keywords = normalizeArray(Array.isArray(body.keywords) ? readStringArray(body.keywords) : []);
  const forbiddenWords = normalizeArray(Array.isArray(body.forbiddenWords) ? readStringArray(body.forbiddenWords) : []);

  if (Object.keys(errors).length > 0 || !product || !isSalesChannel(channel)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      product,
      channel,
      existingTitle,
      existingDescription,
      userInstructions,
      tone: isValidTone(tone) ? tone : undefined,
      keywords,
      forbiddenWords,
    },
    warnings: buildQualityWarnings(product),
  };
}

export function validateChannelSeoContentInput(input: unknown): ValidationResult<ChannelSeoContent> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string[]> = {};

  const productId = readTrimmedString(body.productId);
  if (!productId) {
    addError(errors, "productId", "productId boş olamaz.");
  }

  if (!isSalesChannel(body.channel)) {
    addError(errors, "channel", "Satış kanalı geçerli olmalıdır.");
  }

  const title = readTrimmedString(body.title);
  if (!title) {
    addError(errors, "title", "Başlık boş olamaz.");
  }

  const description = readTrimmedString(body.description);
  if (!description) {
    addError(errors, "description", "Açıklama boş olamaz.");
  }

  const status = body.status;
  if (!isValidStatus(status)) {
    addError(errors, "status", "Durum geçerli olmalıdır.");
  }

  const generatedBy = readOptionalString(body.generatedBy);
  if (generatedBy && generatedBy !== "manual" && generatedBy !== "gemini" && generatedBy !== "fallback") {
    addError(errors, "generatedBy", "Üretim kaynağı geçerli olmalıdır.");
  }

  const seoScore = typeof body.seoScore === "number" && Number.isFinite(body.seoScore) ? body.seoScore : null;
  const keywords = readStringArray(body.keywords);
  const warnings = readStringArray(body.warnings);
  const notes = readStringArray(body.notes);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const normalizedStatus = status as ChannelSeoStatus;

  return {
    ok: true,
    warnings: [],
    value: {
      productId,
      channel: body.channel as SalesChannel,
      title,
      description,
      status: normalizedStatus,
      seoScore,
      keywords: keywords.length > 0 ? keywords : null,
      warnings: warnings.length > 0 ? warnings : null,
      notes: notes.length > 0 ? notes : null,
      generatedBy: generatedBy as ChannelSeoContent["generatedBy"] | undefined,
      model: readOptionalString(body.model),
      createdAt: readOptionalString(body.createdAt) ?? undefined,
      updatedAt: readOptionalString(body.updatedAt) ?? undefined,
      optimizedAt: readOptionalString(body.optimizedAt),
    },
  };
}

export function validateChannelSeoSavePayload(input: unknown): ValidationResult<ChannelSeoContent[]> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string[]> = {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    addError(errors, "items", "Kaydedilecek içerik bulunamadı.");
    return { ok: false, errors };
  }

  const parsed: ChannelSeoContent[] = [];

  items.forEach((item, index) => {
    const result = validateChannelSeoContentInput(item);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.errors)) {
        addError(errors, `items[${index}].${field}`, messages[0] ?? "Geçersiz değer.");
      }
      return;
    }

    parsed.push(result.value);
  });

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: parsed,
    warnings: [],
  };
}

export function validateChannelSeoBulkRequest(input: unknown): ValidationResult<ChannelSeoBulkRequest> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string[]> = {};

  const productIds = normalizeArray(readStringArray(body.productIds));
  if (productIds.length === 0) {
    addError(errors, "productIds", "En az bir ürün seçilmelidir.");
  }

  const channels = normalizeArray(readStringArray(body.channels)).filter(isSalesChannel);
  if (channels.length === 0) {
    addError(errors, "channels", "En az bir satış kanalı seçilmelidir.");
  }

  if (productIds.length > 20) {
    addError(errors, "productIds", "Tek istekte en fazla 20 ürün işlenebilir.");
  }

  if (channels.length > 3) {
    addError(errors, "channels", "Tek istekte en fazla 3 kanal işlenebilir.");
  }

  const tone = body.tone;
  if (tone !== undefined && tone !== null && !isValidTone(tone)) {
    addError(errors, "tone", "Ton geçerli olmalıdır.");
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      productIds,
      channels: channels as SalesChannel[],
      overwriteExisting: Boolean(body.overwriteExisting),
      userInstructions: readOptionalString(body.userInstructions),
      tone: isValidTone(tone) ? tone : undefined,
    },
    warnings: [],
  };
}

export function validateChannelSeoStatus(value: unknown): value is ChannelSeoStatus {
  return isValidStatus(value);
}

export function validateChannelSeoTone(value: unknown): value is ChannelSeoTone {
  return isValidTone(value);
}

export function calculateChannelSeoLocalScore(input: {
  product: Pick<ChannelSeoOptimizationInput["product"], "name" | "category" | "brand" | "baseDescription" | "sku" | "barcode">;
  channel: SalesChannel;
  title: string;
  description: string;
  keywords?: string[];
  forbiddenWords?: string[];
}) {
  const title = readTrimmedString(input.title);
  const description = readTrimmedString(input.description);
  const normalizedKeywords = normalizeArray(input.keywords ?? []);
  const forbiddenWords = normalizeArray(input.forbiddenWords ?? []);
  const productName = input.product.name.toLowerCase();
  const category = (input.product.category ?? "").toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerDescription = description.toLowerCase();

  let score = 0;

  if (title.length > 0) {
    score += 18;
  }
  if (description.length >= 80) {
    score += 18;
  } else if (description.length >= 40) {
    score += 10;
  }
  if (lowerTitle.includes(productName) || lowerTitle.includes(category)) {
    score += 18;
  }
  if (lowerDescription.includes(productName) || lowerDescription.includes(category)) {
    score += 12;
  }
  if (normalizedKeywords.length > 0) {
    score += Math.min(12, normalizedKeywords.length * 3);
  }
  if (forbiddenWords.every((word) => !lowerTitle.includes(word.toLowerCase()) && !lowerDescription.includes(word.toLowerCase()))) {
    score += 12;
  }
  if (input.channel === "my_website" && description.length >= 120) {
    score += 6;
  }
  if (input.product.brand) {
    score += 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
