export type StorePackagingBehavior = "seller_pays" | "included_in_product" | "separate_charge";

export type StoreSettingsFieldId =
  | "shippingCost"
  | "paymentCommission"
  | "monthlyFixedExpenses"
  | "defaultTaxAssumptions"
  | "defaultMarginTarget"
  | "expectedMonthlyOrderCount"
  | "defaultCommission"
  | "defaultPackagingCost"
  | "defaultRiskThreshold";

export type StoreSettingsSectionId = "ownWebsite" | "expenses" | "sellerProfile" | "calculationDefaults";

export interface StoreSettingsData {
  ownWebsite: {
    shippingCost: number | null;
    paymentCommission: number | null;
    packagingBehavior: StorePackagingBehavior;
    freeShippingThreshold: number | null;
  };
  expenses: {
    monthlyFixedExpenses: number | null;
    marketplaceExpenses: number | null;
    operationalCosts: number | null;
  };
  sellerProfile: {
    businessType: string;
    defaultTaxAssumptions: number | null;
    defaultMarginTarget: number | null;
    expectedMonthlyOrderCount: number | null;
  };
  calculationDefaults: {
    defaultCommission: number | null;
    defaultPackagingCost: number | null;
    defaultRiskThreshold: number | null;
  };
}

export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  ownWebsite: {
    shippingCost: 95,
    paymentCommission: 3.49,
    packagingBehavior: "seller_pays",
    freeShippingThreshold: 0,
  },
  expenses: {
    monthlyFixedExpenses: null,
    marketplaceExpenses: 0,
    operationalCosts: 0,
  },
  sellerProfile: {
    businessType: "Şahıs Şirketi",
    defaultTaxAssumptions: 20,
    defaultMarginTarget: 25,
    expectedMonthlyOrderCount: 500,
  },
  calculationDefaults: {
    defaultCommission: 3.49,
    defaultPackagingCost: 0,
    defaultRiskThreshold: 18,
  },
};

export const STORE_SETTINGS_FIELD_META: Record<
  StoreSettingsFieldId,
  { label: string; section: StoreSettingsSectionId }
> = {
  shippingCost: { label: "Kargo maliyeti", section: "ownWebsite" },
  paymentCommission: { label: "Ödeme komisyonu", section: "ownWebsite" },
  monthlyFixedExpenses: { label: "Aylık sabit giderler", section: "expenses" },
  defaultTaxAssumptions: { label: "Vergi varsayımı", section: "sellerProfile" },
  defaultMarginTarget: { label: "Hedef marj", section: "sellerProfile" },
  expectedMonthlyOrderCount: { label: "Aylık sipariş beklentisi", section: "sellerProfile" },
  defaultCommission: { label: "Varsayılan komisyon", section: "calculationDefaults" },
  defaultPackagingCost: { label: "Varsayılan paketleme maliyeti", section: "calculationDefaults" },
  defaultRiskThreshold: { label: "Risk eşiği", section: "calculationDefaults" },
};

function isMissingNumber(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(Number(value));
}

export function normalizePackagingBehavior(value: unknown): StorePackagingBehavior {
  if (value === "included_in_product" || value === "separate_charge") {
    return value;
  }
  return "seller_pays";
}

export function buildStoreSettingsMissingFields(settings: StoreSettingsData): StoreSettingsFieldId[] {
  const missing: StoreSettingsFieldId[] = [];

  if (isMissingNumber(settings.ownWebsite.shippingCost)) {
    missing.push("shippingCost");
  }
  if (isMissingNumber(settings.ownWebsite.paymentCommission)) {
    missing.push("paymentCommission");
  }
  if (isMissingNumber(settings.expenses.monthlyFixedExpenses)) {
    missing.push("monthlyFixedExpenses");
  }
  if (isMissingNumber(settings.sellerProfile.defaultTaxAssumptions)) {
    missing.push("defaultTaxAssumptions");
  }
  if (isMissingNumber(settings.sellerProfile.defaultMarginTarget)) {
    missing.push("defaultMarginTarget");
  }
  if (
    isMissingNumber(settings.sellerProfile.expectedMonthlyOrderCount) ||
    Number(settings.sellerProfile.expectedMonthlyOrderCount) <= 0
  ) {
    missing.push("expectedMonthlyOrderCount");
  }
  if (isMissingNumber(settings.calculationDefaults.defaultCommission)) {
    missing.push("defaultCommission");
  }
  if (isMissingNumber(settings.calculationDefaults.defaultPackagingCost)) {
    missing.push("defaultPackagingCost");
  }
  if (isMissingNumber(settings.calculationDefaults.defaultRiskThreshold)) {
    missing.push("defaultRiskThreshold");
  }

  return missing;
}

export function summarizeStoreSettingsMissingFields(settings: StoreSettingsData) {
  const missingFields = buildStoreSettingsMissingFields(settings);

  return {
    missingFields,
    missingLabels: missingFields.map((fieldId) => STORE_SETTINGS_FIELD_META[fieldId].label),
    missingBySection: missingFields.reduce(
      (acc, fieldId) => {
        const section = STORE_SETTINGS_FIELD_META[fieldId].section;
        acc[section] += 1;
        return acc;
      },
      {
        ownWebsite: 0,
        expenses: 0,
        sellerProfile: 0,
        calculationDefaults: 0,
      } satisfies Record<StoreSettingsSectionId, number>
    ),
  };
}
