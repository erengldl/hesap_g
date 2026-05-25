import { z } from "zod";

export const PRODUCT_CHANNEL_OPTIONS = ["trendyol", "hepsiburada", "my_website"] as const;
export const PRODUCT_STATUS_OPTIONS = ["active", "passive", "draft"] as const;
export const SELLER_COMPANY_TYPES = ["Şahıs Şirketi", "Limited Şirket", "Anonim Şirket"] as const;
export const SELLER_TAX_BRACKETS = [15, 20, 27, 35, 40] as const;
export const MARKETPLACE_SLUG_OPTIONS = ["trendyol", "hepsiburada"] as const;

export function parseLocaleNumberValue(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function requiredText(label: string, min = 1, max = 255) {
  return z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} zorunludur.` : `${label} en az ${min} karakter olmalıdır.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);
}

function optionalText(label: string, max = 255) {
  return z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`);
}

function emailText() {
  return z
    .string()
    .trim()
    .min(1, "E-posta zorunludur.")
    .email("Geçerli bir e-posta adresi girin.");
}

function requiredNumericText(
  label: string,
  options: {
    min?: number;
    minExclusive?: number;
    integer?: boolean;
  } = {}
) {
  return z
    .string()
    .trim()
    .min(1, `${label} zorunludur.`)
    .refine((value) => !Number.isNaN(parseLocaleNumberValue(value)), `${label} sayısal bir değer olmalıdır.`)
    .refine(
      (value) => {
        const parsed = parseLocaleNumberValue(value);
        if (Number.isNaN(parsed)) return false;
        if (typeof options.minExclusive === "number") {
          return parsed > options.minExclusive;
        }
        if (typeof options.min === "number") {
          return parsed >= options.min;
        }
        return true;
      },
      typeof options.minExclusive === "number"
        ? `${label} ${options.minExclusive}'dan büyük olmalıdır.`
        : typeof options.min === "number"
          ? `${label} ${options.min === 0 ? "0 veya daha büyük olmalıdır." : `${options.min}'dan küçük olamaz.`}`
          : `${label} geçersiz.`
    )
    .refine(
      (value) => {
        if (!options.integer) return true;
        const parsed = parseLocaleNumberValue(value);
        return Number.isInteger(parsed);
      },
      `${label} tam sayı olmalıdır.`
    );
}

function enumText<T extends readonly string[]>(label: string, options: T) {
  return z
    .string()
    .trim()
    .min(1, `${label} zorunludur.`)
    .refine((value) => options.includes(value as T[number]), `Geçerli bir ${label.toLocaleLowerCase("tr-TR")} seçin.`);
}

function enumNumber(label: string, options: readonly number[]) {
  return z
    .number({ message: `${label} zorunludur.` })
    .refine((value) => options.includes(value), `Geçerli bir ${label.toLocaleLowerCase("tr-TR")} seçin.`);
}

export const productSchema = z.object({
  name: requiredText("Ürün adı", 2, 160),
  sku: optionalText("SKU", 120),
  barcode: optionalText("Barkod", 120),
  image_url: optionalText("Ürün görseli", 2048),
  category_id: z.number().nullable(),
  category_path: requiredText("Kategori", 2, 255),
  description: optionalText("Ürün açıklaması", 2000),
  cost: requiredNumericText("Üretim / alış maliyeti", { minExclusive: 0 }),
  packaging_cost: requiredNumericText("Paketleme maliyeti", { min: 0 }),
  desi: requiredNumericText("Desi", { min: 0 }),
  sale_price: requiredNumericText("Satış fiyatı", { minExclusive: 0 }),
  active_channels: z
    .array(z.string())
    .min(1, "En az bir satış kanalı seçin.")
    .refine(
      (channels) => channels.every((channel) => PRODUCT_CHANNEL_OPTIONS.includes(channel as (typeof PRODUCT_CHANNEL_OPTIONS)[number])),
      "Geçerli satış kanalları seçin."
    ),
  status: enumText("durum", PRODUCT_STATUS_OPTIONS),
});

export const loginSchema = z.object({
  email: emailText(),
  password: z.string().min(1, "Şifre zorunludur.").min(6, "Şifre en az 6 karakter olmalıdır."),
});

export const registerSchema = z
  .object({
    name: requiredText("Ad soyad", 2, 120),
    email: emailText(),
    password: z.string().min(1, "Şifre zorunludur.").min(6, "Şifre en az 6 karakter olmalıdır."),
    confirmPassword: z.string().min(1, "Şifre tekrarı zorunludur."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"],
  });

export const sellerProfileSchema = z.object({
  company_type: enumText("şirket türü", SELLER_COMPANY_TYPES),
  tax_bracket: enumNumber("vergi oranı", SELLER_TAX_BRACKETS),
  expected_monthly_order_count: requiredNumericText("Aylık tahmini sipariş sayısı", { min: 1, integer: true }),
});

export const storeExpenseSchema = z.object({
  name: requiredText("Gider adı", 2, 160),
  monthly_amount: requiredNumericText("Aylık tutar", { min: 0 }),
  note: optionalText("Açıklama / not", 1000),
  status: enumText("durum", PRODUCT_STATUS_OPTIONS),
});

export const marketplaceCredentialSchema = z.object({
  marketplace_slug: enumText("pazaryeri", MARKETPLACE_SLUG_OPTIONS),
  merchant_id: requiredText("Satıcı kodu", 2, 160),
  api_key: optionalText("API anahtarı", 255),
  api_secret: optionalText("API gizli anahtarı", 255),
  is_active: z.boolean(),
});

export type ProductSchemaInput = z.input<typeof productSchema>;
export type LoginSchemaInput = z.input<typeof loginSchema>;
export type RegisterSchemaInput = z.input<typeof registerSchema>;
export type SellerProfileSchemaInput = z.input<typeof sellerProfileSchema>;
export type StoreExpenseSchemaInput = z.input<typeof storeExpenseSchema>;
export type MarketplaceCredentialSchemaInput = z.input<typeof marketplaceCredentialSchema>;
