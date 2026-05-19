import type {
  ChannelSeoContent,
  ChannelSeoGeneratedBy,
  ChannelSeoOptimizationInput,
  ChannelSeoOptimizationOutput,
  SalesChannel,
} from "./types";
import { calculateChannelSeoLocalScore } from "./validation";

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function joinSafe(values: Array<string | null | undefined>) {
  return values.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0);
}

function normalizeSummaryText(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

export function createFallbackChannelSeoContent(input: ChannelSeoOptimizationInput & { generatedBy?: ChannelSeoGeneratedBy }) {
  const product = input.product;
  const category = normalizeSummaryText(product.category);
  const brand = normalizeSummaryText(product.brand);
  const baseDescription = normalizeSummaryText(product.baseDescription);
  const features = joinSafe(product.features ?? []);
  const variants = joinSafe(product.variants ?? []);
  const titleParts = joinSafe([brand, product.name, category]);
  let title = titleParts.join(" - ");
  if (!title) {
    title = product.name;
  }

  const channelTail: Record<SalesChannel, string> = {
    trendyol: "Net, satış odaklı ve kısa cümlelerle fayda, kullanım alanı ve öne çıkan özellikleri birlikte anlatan güvenli ürün açıklaması.",
    hepsiburada: "Ürünün kullanım alanını, öne çıkan özelliklerini ve güven veren yönlerini düzenli biçimde açıklayan içerik.",
    my_website: "Kategori, fayda ve kullanım senaryosunu doğal akış içinde birleştiren detaylı SEO uyumlu açıklama.",
  };

  const descriptionPieces = [
    baseDescription,
    features.length > 0 ? features.join(", ") : null,
    variants.length > 0 ? `Varyantlar: ${variants.join(", ")}` : null,
    channelTail[input.channel],
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  let description = descriptionPieces.join(" ");
  if (!description) {
    description = `${product.name} için güvenli ürün açıklaması.`;
  }

  const titleLimit = input.channel === "my_website" ? 96 : input.channel === "hepsiburada" ? 90 : 84;
  const descriptionLimit = input.channel === "my_website" ? 360 : input.channel === "hepsiburada" ? 320 : 280;

  const seoScore = calculateChannelSeoLocalScore({
    product,
    channel: input.channel,
    title,
    description,
    keywords: input.keywords,
    forbiddenWords: input.forbiddenWords,
  });

  const warnings: string[] = [];
  if (!product.category) warnings.push("Kategori bilgisi eksik.");
  if (!product.baseDescription) warnings.push("Ürün açıklaması eksik.");
  if (!product.brand) warnings.push("Marka bilgisi eksik.");
  if (!product.price) warnings.push("Satış fiyatı eksik.");
  if (!product.stock && product.stock !== 0) warnings.push("Stok bilgisi eksik.");
  warnings.push("Güvenli fallback üretildi.");

  const notes = [
    `${input.channel} kanalı için ${input.channel === "my_website" ? "akıcı SEO dili" : "kısa ve güvenli ticari dil"} kullanıldı.`,
    "Eksik alanlar uydurulmadı.",
    "Başlık ve açıklama, verilen ürün bilgileriyle sınırlı tutuldu.",
  ];

  const fallback: ChannelSeoOptimizationOutput & { generatedBy: ChannelSeoGeneratedBy; model: string | null } = {
    title: truncate(title, titleLimit),
    description: truncate(description, descriptionLimit),
    seoScore,
    keywords: Array.from(
      new Set(
        joinSafe([
          product.name,
          product.category,
          product.brand,
          ...joinSafe(product.features ?? []).slice(0, 3),
        ])
      )
    ).slice(0, 6),
    warnings,
    notes,
    generatedBy: input.generatedBy ?? "fallback",
    model: null,
  };

  return fallback;
}

export function normalizeChannelSeoOutput(
  output: Partial<ChannelSeoOptimizationOutput>,
  input: ChannelSeoOptimizationInput
): ChannelSeoOptimizationOutput {
  const fallback = createFallbackChannelSeoContent(input);
  const title = typeof output.title === "string" && output.title.trim().length > 0 ? output.title.trim() : fallback.title;
  const description =
    typeof output.description === "string" && output.description.trim().length > 0 ? output.description.trim() : fallback.description;
  const seoScoreCandidate = typeof output.seoScore === "number" && Number.isFinite(output.seoScore) ? Math.round(output.seoScore) : fallback.seoScore;
  const seoScore = Math.max(0, Math.min(100, seoScoreCandidate));
  const keywords = Array.isArray(output.keywords)
    ? Array.from(new Set(output.keywords.map((item) => item.trim()).filter((item) => item.length > 0))).slice(0, 8)
    : fallback.keywords;
  const warnings = Array.isArray(output.warnings)
    ? Array.from(new Set(output.warnings.map((item) => item.trim()).filter((item) => item.length > 0)))
    : fallback.warnings;
  const notes = Array.isArray(output.notes)
    ? Array.from(new Set(output.notes.map((item) => item.trim()).filter((item) => item.length > 0)))
    : fallback.notes;

  return {
    title,
    description,
    seoScore,
    keywords,
    warnings,
    notes,
  };
}

export function createChannelSeoContentRecord(input: {
  productId: string;
  channel: SalesChannel;
  output: ChannelSeoOptimizationOutput;
  generatedBy?: ChannelSeoGeneratedBy;
  model?: string | null;
  status?: ChannelSeoContent["status"];
  optimizedAt?: string | null;
}): ChannelSeoContent {
  return {
    productId: input.productId,
    channel: input.channel,
    title: input.output.title,
    description: input.output.description,
    status: input.status ?? "draft",
    seoScore: input.output.seoScore,
    warnings: input.output.warnings,
    notes: input.output.notes,
    keywords: input.output.keywords,
    generatedBy: input.generatedBy ?? "manual",
    model: input.model ?? null,
    optimizedAt: input.optimizedAt ?? null,
  };
}

export function buildChannelSeoQualityWarnings(product: ChannelSeoOptimizationInput["product"]) {
  const warnings: string[] = [];

  if (!product.category) warnings.push("Kategori bilgisi eksik.");
  if (!product.brand) warnings.push("Marka bilgisi eksik.");
  if (!product.baseDescription) warnings.push("Ürün açıklaması eksik.");
  if (!product.sku && !product.barcode) warnings.push("SKU veya barkod eksik.");
  if (!product.price) warnings.push("Satış fiyatı eksik.");
  if (!product.stock && product.stock !== 0) warnings.push("Stok bilgisi eksik.");
  if (Array.isArray(product.features) && product.features.length === 0) warnings.push("Özellik listesi boş.");

  return warnings;
}
