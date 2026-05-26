import { getOne } from "./db";

const DEFAULT_VAT_RATE_PERCENT = 18;

type CategoryRow = Record<string, unknown> & {
  category_id?: number | null;
  parent_id?: number | null;
};

type CategoryTaxRuleRow = {
  tax_rate: number | null;
};

export type VatRateResolution = {
  ratePercent: number;
  source: "category" | "category_tax_rule" | "default";
  sourceCategoryId: number | null;
  warning: string | null;
};

export type VatEstimate = {
  vatRatePercent: number;
  outputVat: number;
  inputVat: number;
  estimatedVatPayable: number;
  source: VatRateResolution["source"];
  sourceCategoryId: number | null;
  warning: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function resolveVatRateForCategory(categoryId: number | null): Promise<VatRateResolution> {
  if (!categoryId) {
    return {
      ratePercent: DEFAULT_VAT_RATE_PERCENT,
      source: "default",
      sourceCategoryId: null,
      warning: "Kategori KDV oranı bulunamadı, %18 varsayıldı.",
    };
  }

  const visited = new Set<number>();
  let currentCategoryId: number | null = categoryId;

  while (currentCategoryId && !visited.has(currentCategoryId)) {
    visited.add(currentCategoryId);

    const category = await getOne<CategoryRow>(
      "SELECT * FROM categories WHERE category_id = ? LIMIT 1",
      [currentCategoryId]
    );

    const categoryVatRate =
      toFiniteNumber(category?.vat_rate) ??
      toFiniteNumber(category?.vat_rate_percent);

    if (categoryVatRate != null && categoryVatRate >= 0) {
      return {
        ratePercent: round2(categoryVatRate),
        source: "category",
        sourceCategoryId: currentCategoryId,
        warning: null,
      };
    }

    const legacyRule = await getOne<CategoryTaxRuleRow>(
      "SELECT tax_rate FROM category_tax_rules WHERE category_id = ? LIMIT 1",
      [currentCategoryId]
    );

    if (legacyRule?.tax_rate != null && Number.isFinite(Number(legacyRule.tax_rate))) {
      return {
        ratePercent: round2(Number(legacyRule.tax_rate)),
        source: "category_tax_rule",
        sourceCategoryId: currentCategoryId,
        warning: null,
      };
    }

    const parentCategoryId = toFiniteNumber(category?.parent_id);
    currentCategoryId = parentCategoryId && parentCategoryId > 0 ? parentCategoryId : null;
  }

  return {
    ratePercent: DEFAULT_VAT_RATE_PERCENT,
    source: "default",
    sourceCategoryId: null,
    warning: "Kategori KDV oranı bulunamadı, %18 varsayıldı.",
  };
}

export async function calculateVatEstimate(params: {
  salePrice: number;
  productCost: number;
  packagingCost: number;
  categoryId: number | null;
}): Promise<VatEstimate> {
  const resolution = await resolveVatRateForCategory(params.categoryId);
  const rateMultiplier = resolution.ratePercent / 100;
  const salePrice = Math.max(0, Number(params.salePrice ?? 0));
  const costBase =
    Math.max(0, Number(params.productCost ?? 0)) +
    Math.max(0, Number(params.packagingCost ?? 0));
  const outputVat = round2(salePrice * rateMultiplier);
  const inputVat = round2(costBase * rateMultiplier);

  return {
    vatRatePercent: resolution.ratePercent,
    outputVat,
    inputVat,
    estimatedVatPayable: round2(outputVat - inputVat),
    source: resolution.source,
    sourceCategoryId: resolution.sourceCategoryId,
    warning: resolution.warning,
  };
}
