import { buildChannelRulesBlock, getChannelRule } from "./channel-rules";
import type { ChannelSeoOptimizationInput, SalesChannel } from "./types";

export const CHANNEL_SEO_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "Türkçe, kanal kurallarına uygun ürün başlığı.",
    },
    description: {
      type: "string",
      description: "Türkçe, kanal kurallarına uygun ürün açıklaması.",
    },
    seoScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "0-100 arasında SEO kalitesi puanı.",
    },
    keywords: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Doğal geçen anahtar kelimeler.",
    },
    warnings: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Eksik bilgi veya risk uyarıları.",
    },
    notes: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Kısa gerekçe maddeleri.",
    },
  },
  required: ["title", "description", "seoScore", "keywords", "warnings", "notes"],
} as const;

function normalizeList(values: string[] | undefined | null) {
  const unique = Array.from(new Set((values ?? []).map((item) => item.trim()).filter((item) => item.length > 0)));
  return unique;
}

function formatOptionalText(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : "Bilgi yok";
}

function formatAttributes(attributes: Record<string, string | number | boolean | null> | null | undefined) {
  if (!attributes) {
    return "Bilgi yok";
  }

  const entries = Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && `${value}`.trim().length > 0);
  if (entries.length === 0) {
    return "Bilgi yok";
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

export function buildChannelSeoPrompt(input: ChannelSeoOptimizationInput) {
  const product = input.product;
  const keywords = normalizeList(input.keywords);
  const forbiddenWords = normalizeList(input.forbiddenWords);

  return [
    "Ürün:",
    `- ID: ${product.id}`,
    `- Ürün adı: ${product.name}`,
    `- Kategori: ${formatOptionalText(product.category)}`,
    `- Marka: ${formatOptionalText(product.brand)}`,
    `- SKU: ${formatOptionalText(product.sku)}`,
    `- Barkod: ${formatOptionalText(product.barcode)}`,
    `- Mevcut açıklama: ${formatOptionalText(product.baseDescription)}`,
    `- Özellikler: ${product.features && product.features.length > 0 ? product.features.join(" | ") : "Bilgi yok"}`,
    `- Attribute bilgileri: ${formatAttributes(product.attributes)}`,
    `- Fiyat: ${typeof product.price === "number" && Number.isFinite(product.price) ? product.price : "Bilgi yok"}`,
    `- Stok: ${typeof product.stock === "number" && Number.isFinite(product.stock) ? product.stock : "Bilgi yok"}`,
    `- Varyantlar: ${product.variants && product.variants.length > 0 ? product.variants.join(" | ") : "Bilgi yok"}`,
    "",
    "Satış kanalı:",
    `- Kanal: ${input.channel}`,
    "",
    "Kanal kuralları:",
    buildChannelRulesBlock(input.channel),
    "",
    "Mevcut kanal içeriği:",
    `- Mevcut başlık: ${formatOptionalText(input.existingTitle)}`,
    `- Mevcut açıklama: ${formatOptionalText(input.existingDescription)}`,
    "",
    "Kullanıcı talimatı:",
    formatOptionalText(input.userInstructions),
    "",
    "Yasaklı kelimeler:",
    forbiddenWords.length > 0 ? forbiddenWords.join(", ") : "Belirtilmedi",
    "",
    "Ek ipuçları:",
    "- Türkçe yaz.",
    "- Sadece verilen ürün bilgilerine dayan.",
    "- Teknik özellik uydurma.",
    "- Sağlık, garanti, sertifika, resmi onay, orijinallik veya tıbbi fayda iddiası ekleme.",
    "- Anahtar kelime spam'i yapma.",
    "- Markayı varsa doğal kullan, yoksa marka uydurma.",
    "- Kategori yoksa kategori uydurma; güvenli çıkarım yapamıyorsan bırak.",
    "- Ürün açıklaması eksikse, ürün adı ve mevcut özelliklere dayanarak güvenli bir açıklama yaz.",
    "- Açıklama, başlıktan ayrı olarak ürünün faydasını, kullanım alanını ve temel özelliklerini anlatan detaylı bir metin olsun.",
    "- Açıklamayı tek cümle yapma; kanalına göre daha açıklayıcı ama dolgu içermeyen bir yapı kur.",
    "- Yasaklı kelimeleri kullanma.",
    "- Başlık okunabilir ve satış odaklı olsun.",
    "- Açıklamayı kanal davranışına göre düzenle.",
    "",
    "İstenen JSON:",
    JSON.stringify(
      {
        title: "string",
        description: "string",
        seoScore: 0,
        keywords,
        warnings: ["string"],
        notes: ["string"],
      },
      null,
      2
    ),
    "",
    "Kesin kurallar:",
    "- Sadece geçerli JSON döndür.",
    "- Markdown kullanma.",
    "- JSON dışında açıklama yazma.",
    "- Bilgi uydurma.",
  ].join("\n");
}

export function buildChannelSeoSystemInstruction(channel: SalesChannel) {
  const rule = getChannelRule(channel);
  return [
    "Sen e-ticaret SEO ve pazaryeri ürün içerik uzmanısın.",
    "Görevin, verilen ürün bilgilerine göre seçilen satış kanalı için en uygun Türkçe ürün başlığı ve ürün açıklamasını üretmektir.",
    "Kesin kurallar:",
    "- Türkçe yaz.",
    "- Sadece verilen ürün bilgilerine dayan.",
    "- Ürün hakkında teknik özellik uydurma.",
    "- Sağlık, garanti, sertifika, resmi onay, orijinallik, tıbbi fayda gibi iddiaları kullanıcı verisi yoksa ekleme.",
    "- Anahtar kelime spam'i yapma.",
    "- Başlığı okunabilir ve satış odaklı yaz.",
    "- Yasaklı kelimeler verilmişse kullanma.",
    "- Marka verilmişse doğal kullan.",
    "- Marka yoksa marka uydurma.",
    "- Kategori yoksa kategori uydurma; ürün adından güvenli çıkarım yapılabiliyorsa dikkatli davran.",
    "- Ürün açıklaması eksikse ürün adı ve özelliklere göre sınırlı, güvenli açıklama yaz.",
    "- Açıklama, başlıktan ayrı olarak fayda, kullanım alanı ve temel özellikleri anlatan detaylı bir ürün metni olmalıdır.",
    "- SEO skorunu 0-100 arasında ver.",
    "- Warnings alanında eksik bilgi veya riskleri belirt.",
    "- Notes alanında neden böyle yazdığını kısa maddelerle açıkla.",
    "- Sadece geçerli JSON döndür.",
    "- Markdown kullanma.",
    "- JSON dışında açıklama yazma.",
    `Açıklama odağı: ${rule.descriptionGuidance}`,
    `Kanal önceliği: ${rule.label} için ${rule.fallbackTone} bir dil kullan.`,
  ].join("\n");
}
