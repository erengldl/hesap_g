"use client";

import { type ElementType, type ReactNode, useEffect, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Calculator,
  Loader2,
  Package2,
  Percent,
  Store,
  Truck,
} from "lucide-react";

import {
  ErrorStateCard,
  GlassCard,
  SkeletonCard,
  StatusBadge,
} from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import {
  STORE_SETTINGS_FIELD_META,
  summarizeStoreSettingsMissingFields,
  type StorePackagingBehavior,
  type StoreSettingsData,
  type StoreSettingsFieldId,
} from "@/lib/store-settings";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type FormState = {
  ownWebsite: {
    shippingCost: string;
    paymentCommission: string;
    packagingBehavior: StorePackagingBehavior;
    freeShippingThreshold: string;
  };
  expenses: {
    monthlyFixedExpenses: string;
    marketplaceExpenses: string;
    operationalCosts: string;
  };
  sellerProfile: {
    businessType: string;
    defaultTaxAssumptions: string;
    defaultMarginTarget: string;
    expectedMonthlyOrderCount: string;
  };
  calculationDefaults: {
    defaultCommission: string;
    defaultPackagingCost: string;
    defaultRiskThreshold: string;
  };
};

type StoreSettingsResponse = {
  success: boolean;
  error?: string;
  settings?: StoreSettingsData;
  missingFields?: StoreSettingsFieldId[];
};

const BUSINESS_TYPE_OPTIONS = [
  "Şahıs Şirketi",
  "Limited Şirket",
  "Anonim Şirket",
];

const TAX_RATE_OPTIONS = [15, 20, 27, 35, 40];

const PACKAGING_BEHAVIOR_OPTIONS: Array<{ value: StorePackagingBehavior; label: string; description: string }> = [
  {
    value: "seller_pays",
    label: "Satıcı karşılar",
    description: "Paketleme gideri sipariş kârlılığından düşülür.",
  },
  {
    value: "included_in_product",
    label: "Ürüne dahil",
    description: "Paketleme maliyeti ürün bazlı maliyet içinde düşünülür.",
  },
  {
    value: "separate_charge",
    label: "Ayrı izlenir",
    description: "Paketleme maliyeti ayrı bir varsayım olarak tutulur.",
  },
];

const DEFAULT_FORM_STATE: FormState = {
  ownWebsite: {
    shippingCost: "",
    paymentCommission: "",
    packagingBehavior: "seller_pays",
    freeShippingThreshold: "0",
  },
  expenses: {
    monthlyFixedExpenses: "",
    marketplaceExpenses: "0",
    operationalCosts: "0",
  },
  sellerProfile: {
    businessType: "Şahıs Şirketi",
    defaultTaxAssumptions: "",
    defaultMarginTarget: "",
    expectedMonthlyOrderCount: "",
  },
  calculationDefaults: {
    defaultCommission: "",
    defaultPackagingCost: "",
    defaultRiskThreshold: "",
  },
};

function formatNumberInput(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function toNullableNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toFormState(settings: StoreSettingsData): FormState {
  return {
    ownWebsite: {
      shippingCost: formatNumberInput(settings.ownWebsite.shippingCost),
      paymentCommission: formatNumberInput(settings.ownWebsite.paymentCommission),
      packagingBehavior: settings.ownWebsite.packagingBehavior,
      freeShippingThreshold: formatNumberInput(settings.ownWebsite.freeShippingThreshold ?? 0),
    },
    expenses: {
      monthlyFixedExpenses: formatNumberInput(settings.expenses.monthlyFixedExpenses),
      marketplaceExpenses: formatNumberInput(settings.expenses.marketplaceExpenses ?? 0),
      operationalCosts: formatNumberInput(settings.expenses.operationalCosts ?? 0),
    },
    sellerProfile: {
      businessType: settings.sellerProfile.businessType,
      defaultTaxAssumptions: formatNumberInput(settings.sellerProfile.defaultTaxAssumptions),
      defaultMarginTarget: formatNumberInput(settings.sellerProfile.defaultMarginTarget),
      expectedMonthlyOrderCount: formatNumberInput(settings.sellerProfile.expectedMonthlyOrderCount),
    },
    calculationDefaults: {
      defaultCommission: formatNumberInput(settings.calculationDefaults.defaultCommission),
      defaultPackagingCost: formatNumberInput(settings.calculationDefaults.defaultPackagingCost),
      defaultRiskThreshold: formatNumberInput(settings.calculationDefaults.defaultRiskThreshold),
    },
  };
}

function toSettingsPayload(form: FormState): StoreSettingsData {
  return {
    ownWebsite: {
      shippingCost: toNullableNumber(form.ownWebsite.shippingCost),
      paymentCommission: toNullableNumber(form.ownWebsite.paymentCommission),
      packagingBehavior: form.ownWebsite.packagingBehavior,
      freeShippingThreshold: toNullableNumber(form.ownWebsite.freeShippingThreshold) ?? 0,
    },
    expenses: {
      monthlyFixedExpenses: toNullableNumber(form.expenses.monthlyFixedExpenses),
      marketplaceExpenses: toNullableNumber(form.expenses.marketplaceExpenses) ?? 0,
      operationalCosts: toNullableNumber(form.expenses.operationalCosts) ?? 0,
    },
    sellerProfile: {
      businessType: form.sellerProfile.businessType,
      defaultTaxAssumptions: toNullableNumber(form.sellerProfile.defaultTaxAssumptions),
      defaultMarginTarget: toNullableNumber(form.sellerProfile.defaultMarginTarget),
      expectedMonthlyOrderCount: toNullableNumber(form.sellerProfile.expectedMonthlyOrderCount),
    },
    calculationDefaults: {
      defaultCommission: toNullableNumber(form.calculationDefaults.defaultCommission),
      defaultPackagingCost: toNullableNumber(form.calculationDefaults.defaultPackagingCost),
      defaultRiskThreshold: toNullableNumber(form.calculationDefaults.defaultRiskThreshold),
    },
  };
}

function validateForm(form: FormState) {
  const errors: Partial<Record<StoreSettingsFieldId, string>> = {};

  const requireNumericField = (
    fieldId: StoreSettingsFieldId,
    rawValue: string,
    options: { min?: number; max?: number; positive?: boolean } = {}
  ) => {
    if (rawValue.trim() === "") {
      errors[fieldId] = "Bu varsayım gerekli.";
      return;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      errors[fieldId] = "Geçerli bir sayı girin.";
      return;
    }
    if (options.positive && numericValue <= 0) {
      errors[fieldId] = "0'dan büyük bir değer girin.";
      return;
    }
    if (options.min !== undefined && numericValue < options.min) {
      errors[fieldId] = `${options.min} veya daha yüksek bir değer girin.`;
      return;
    }
    if (options.max !== undefined && numericValue > options.max) {
      errors[fieldId] = `${options.max} veya daha düşük bir değer girin.`;
    }
  };

  const optionalNumericField = (fieldId: StoreSettingsFieldId | null, rawValue: string, min = 0) => {
    if (rawValue.trim() === "") {
      return;
    }
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < min) {
      if (fieldId) {
        errors[fieldId] = `${min} veya daha yüksek bir değer girin.`;
      }
    }
  };

  requireNumericField("shippingCost", form.ownWebsite.shippingCost, { min: 0 });
  requireNumericField("paymentCommission", form.ownWebsite.paymentCommission, { min: 0, max: 100 });
  requireNumericField("monthlyFixedExpenses", form.expenses.monthlyFixedExpenses, { min: 0 });
  requireNumericField("defaultTaxAssumptions", form.sellerProfile.defaultTaxAssumptions, { min: 0, max: 100 });
  requireNumericField("defaultMarginTarget", form.sellerProfile.defaultMarginTarget, { min: 0, max: 100 });
  requireNumericField("expectedMonthlyOrderCount", form.sellerProfile.expectedMonthlyOrderCount, { positive: true });
  requireNumericField("defaultCommission", form.calculationDefaults.defaultCommission, { min: 0, max: 100 });
  requireNumericField("defaultPackagingCost", form.calculationDefaults.defaultPackagingCost, { min: 0 });
  requireNumericField("defaultRiskThreshold", form.calculationDefaults.defaultRiskThreshold, { min: 0, max: 100 });

  optionalNumericField(null, form.ownWebsite.freeShippingThreshold);
  optionalNumericField(null, form.expenses.marketplaceExpenses);
  optionalNumericField(null, form.expenses.operationalCosts);

  return errors;
}

function SettingsField({
  label,
  helper,
  error,
  badge,
  children,
}: {
  label: string;
  helper: string;
  error?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</label>
        {badge}
      </div>
      {children}
      <p className={cn("text-xs leading-5", error ? "text-warning" : "text-muted")}>{error ?? helper}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  warningCount,
  children,
}: {
  icon: ElementType;
  title: string;
  description: string;
  warningCount: number;
  children: ReactNode;
}) {
  return (
    <GlassCard className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-surface-container/80 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <StatusBadge tone={warningCount > 0 ? "warning" : "neutral"}>
                {warningCount > 0 ? `${warningCount} eksik varsayım` : "Kâr hesabını etkiler"}
              </StatusBadge>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

export default function StoreSettingsSection() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [initialForm, setInitialForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<StoreSettingsFieldId, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { error: toastError, success, warning } = useToast();

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/data-center/store-settings", { cache: "no-store" });
        const data = (await response.json()) as StoreSettingsResponse;

        if (!response.ok || !data.success || !data.settings) {
          throw new Error(data.error || "Mağaza ayarları yüklenemedi");
        }

        const nextForm = toFormState(data.settings);
        setForm(nextForm);
        setInitialForm(nextForm);
        setTouched({});
        setSubmitAttempted(false);
        setLoadError(null);
      } catch (error) {
        console.error("Store settings load error:", error);
        setLoadError("Mağaza varsayımları alınamadı. Bağlantıyı kontrol edip tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const settingsPayload = toSettingsPayload(form);
  const validationErrors = validateForm(form);
  const missingSummary = summarizeStoreSettingsMissingFields(settingsPayload);
  const visibleError = (fieldId: StoreSettingsFieldId) =>
    submitAttempted || touched[fieldId] ? validationErrors[fieldId] : undefined;
  const totalStoreExpenses =
    Number(settingsPayload.expenses.monthlyFixedExpenses ?? 0) +
    Number(settingsPayload.expenses.marketplaceExpenses ?? 0) +
    Number(settingsPayload.expenses.operationalCosts ?? 0);
  const expectedOrderCount = Number(settingsPayload.sellerProfile.expectedMonthlyOrderCount ?? 0);
  const unitFixedCost = expectedOrderCount > 0 ? totalStoreExpenses / expectedOrderCount : 0;
  const isDirty = initialForm ? JSON.stringify(initialForm) !== JSON.stringify(form) : false;

  const updateTouched = (fieldId: StoreSettingsFieldId) => {
    setTouched((current) => ({ ...current, [fieldId]: true }));
  };

  const updateOwnWebsite = (key: keyof FormState["ownWebsite"], value: string) => {
    setForm((current) => ({
      ...current,
      ownWebsite: {
        ...current.ownWebsite,
        [key]: value,
      },
    }));
  };

  const updateExpenses = (key: keyof FormState["expenses"], value: string) => {
    setForm((current) => ({
      ...current,
      expenses: {
        ...current.expenses,
        [key]: value,
      },
    }));
  };

  const updateSellerProfile = (key: keyof FormState["sellerProfile"], value: string) => {
    setForm((current) => ({
      ...current,
      sellerProfile: {
        ...current.sellerProfile,
        [key]: value,
      },
    }));
  };

  const updateCalculationDefaults = (key: keyof FormState["calculationDefaults"], value: string) => {
    setForm((current) => ({
      ...current,
      calculationDefaults: {
        ...current.calculationDefaults,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    const nextErrors = validateForm(form);
    setSubmitAttempted(true);

    if (Object.keys(nextErrors).length > 0) {
      const firstMissing = Object.keys(nextErrors)[0] as StoreSettingsFieldId;
      warning("Eksik mağaza varsayımları var.", `${STORE_SETTINGS_FIELD_META[firstMissing].label} alanını tamamlayın.`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/data-center/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPayload),
      });
      const data = (await response.json()) as StoreSettingsResponse;

      if (!response.ok || !data.success || !data.settings) {
        throw new Error(data.error || "Mağaza ayarları kaydedilemedi");
      }

      const nextForm = toFormState(data.settings);
      setForm(nextForm);
      setInitialForm(nextForm);
      setTouched({});
      setSubmitAttempted(false);
      success("Mağaza bilgileri kaydedildi.", "Net kâr varsayımları güncellendi.");
    } catch (error) {
      console.error("Store settings save error:", error);
      toastError("Mağaza bilgileri kaydedilemedi.", "Ayarlar finans motoruna yazılamadı.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard variant="card" height={92} />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SkeletonCard variant="card" height={420} />
          <SkeletonCard variant="card" height={420} />
          <SkeletonCard variant="card" height={360} />
          <SkeletonCard variant="card" height={360} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorStateCard
        title="Mağaza bilgileri yüklenemedi"
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
          >
            Tekrar dene
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <GlassCard className="overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-foreground">
                Bu bilgiler tüm ürünlerin net kâr hesaplamasında kullanılır.
              </h3>
              <StatusBadge tone={missingSummary.missingFields.length > 0 ? "warning" : "profit"}>
                {missingSummary.missingFields.length > 0 ? "Eksik varsayım var" : "Hesaplama hazır"}
              </StatusBadge>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted">
              Mağaza düzeyindeki kargo, gider, vergi ve varsayılan eşik ayarlarını bir kez tanımlayın. Sonraki
              kârlılık sonuçları bu zemini kullanır.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">Kompakt ayar görünümü</StatusBadge>
            {missingSummary.missingFields.length > 0 ? (
              <StatusBadge tone="warning">{missingSummary.missingFields.length} alan kontrol edilmeli</StatusBadge>
            ) : null}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <SectionCard
            icon={Truck}
            title="Kendi Web Siteniz"
            description="Kargo ve ödeme varsayımlarını tek yerde tutun. Bu ayarlar doğrudan kanal kârlılığına yansır."
            warningCount={missingSummary.missingBySection.ownWebsite}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SettingsField
                label="Kargo Maliyeti"
                helper="Ücretsiz kargo yoksa sipariş başına kullanılan temel dağıtım maliyeti."
                error={visibleError("shippingCost")}
                badge={visibleError("shippingCost") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
              >
                <div className="relative">
                  <input
                    aria-label="Kargo Maliyeti"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.ownWebsite.shippingCost}
                    onChange={(event) => updateOwnWebsite("shippingCost", event.target.value)}
                    onBlur={() => updateTouched("shippingCost")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("shippingCost") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Ödeme Komisyonu"
                helper="Sanal POS veya ödeme altyapısının sipariş başına aldığı oran."
                error={visibleError("paymentCommission")}
                badge={visibleError("paymentCommission") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
              >
                <div className="relative">
                  <input
                    aria-label="Ödeme Komisyonu"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.ownWebsite.paymentCommission}
                    onChange={(event) => updateOwnWebsite("paymentCommission", event.target.value)}
                    onBlur={() => updateTouched("paymentCommission")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("paymentCommission") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    %
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Paketleme Davranışı"
                helper="Paketleme giderini ürün bazında mı yoksa sipariş bazında mı izlediğinizi tanımlayın."
              >
                <select
                  aria-label="Paketleme Davranışı"
                  value={form.ownWebsite.packagingBehavior}
                  onChange={(event) =>
                    updateOwnWebsite("packagingBehavior", event.target.value as StorePackagingBehavior)
                  }
                  className="h-11 w-full rounded-xl border border-border/70 bg-surface-container/70 px-4 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35"
                >
                  {PACKAGING_BEHAVIOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SettingsField>

              <SettingsField
                label="Ücretsiz Kargo Eşiği"
                helper="0 bırakırsanız her siparişte standart kargo maliyeti kullanılır."
              >
                <div className="relative">
                  <input
                    aria-label="Ücretsiz Kargo Eşiği"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.ownWebsite.freeShippingThreshold}
                    onChange={(event) => updateOwnWebsite("freeShippingThreshold", event.target.value)}
                    className="h-11 w-full rounded-xl border border-border/70 bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface-container/60 px-4 py-3">
              <p className="text-xs leading-6 text-muted">
                {PACKAGING_BEHAVIOR_OPTIONS.find((option) => option.value === form.ownWebsite.packagingBehavior)
                  ?.description ?? "Paketleme davranışı kaydediliyor."}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            icon={Store}
            title="Mağaza Giderleri"
            description="Sabit giderleri üç net başlık altında toplayın. Sipariş başı sabit maliyet otomatik hesaplanır."
            warningCount={missingSummary.missingBySection.expenses}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SettingsField
                label="Aylık Sabit Giderler"
                helper="Kira, ekip, abonelik ve tekrarlayan çekirdek giderler."
                error={visibleError("monthlyFixedExpenses")}
                badge={visibleError("monthlyFixedExpenses") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
              >
                <div className="relative">
                  <input
                    aria-label="Aylık Sabit Giderler"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.expenses.monthlyFixedExpenses}
                    onChange={(event) => updateExpenses("monthlyFixedExpenses", event.target.value)}
                    onBlur={() => updateTouched("monthlyFixedExpenses")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("monthlyFixedExpenses") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Pazaryeri Giderleri"
                helper="Sabit pazaryeri operasyon bütçeleri veya platform bazlı ek maliyetler."
              >
                <div className="relative">
                  <input
                    aria-label="Pazaryeri Giderleri"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.expenses.marketplaceExpenses}
                    onChange={(event) => updateExpenses("marketplaceExpenses", event.target.value)}
                    className="h-11 w-full rounded-xl border border-border/70 bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Operasyonel Maliyetler"
                helper="Paketleme ekibi, destek, depo içi hareket ve benzeri süreç maliyetleri."
              >
                <div className="relative">
                  <input
                    aria-label="Operasyonel Maliyetler"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.expenses.operationalCosts}
                    onChange={(event) => updateExpenses("operationalCosts", event.target.value)}
                    className="h-11 w-full rounded-xl border border-border/70 bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-surface-container/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Aylık Toplam</p>
                <p className="mt-2 text-[1.35rem] font-semibold text-foreground tabular-nums">
                  {formatCurrency(totalStoreExpenses)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface-container/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Sipariş Başı Sabit</p>
                <p className="mt-2 text-[1.35rem] font-semibold text-primary tabular-nums">
                  {formatCurrency(unitFixedCost)}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            icon={BriefcaseBusiness}
            title="Satıcı Profili"
            description="Vergi ve büyüme varsayımlarını netleştirin. Sabit gider dağılımı da bu profil üzerinden okunur."
            warningCount={missingSummary.missingBySection.sellerProfile}
          >
            <div className="space-y-4">
              <SettingsField label="İşletme Türü" helper="Varsayılan şirket yapınızı seçin.">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-label={option}
                      onClick={() => updateSellerProfile("businessType", option)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm transition-colors duration-200",
                        form.sellerProfile.businessType === option
                          ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                          : "border-border/70 bg-surface-container/70 text-muted hover:border-primary/20 hover:text-foreground"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </SettingsField>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SettingsField
                  label="Vergi Varsayımı"
                  helper="Net kâr sonrasında kalan vergi yükü için temel oran."
                  error={visibleError("defaultTaxAssumptions")}
                  badge={
                    visibleError("defaultTaxAssumptions") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null
                  }
                >
                  <div className="grid grid-cols-5 gap-2">
                    {TAX_RATE_OPTIONS.map((option) => {
                      const isSelected = form.sellerProfile.defaultTaxAssumptions === String(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-label={`Vergi Varsayımı ${option}`}
                          onClick={() => {
                            updateSellerProfile("defaultTaxAssumptions", String(option));
                            updateTouched("defaultTaxAssumptions");
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-sm transition-colors duration-200",
                            isSelected
                              ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                              : "border-border/70 bg-surface-container/70 text-muted hover:border-primary/20 hover:text-foreground"
                          )}
                        >
                          %{option}
                        </button>
                      );
                    })}
                  </div>
                </SettingsField>

                <SettingsField
                  label="Hedef Marj"
                  helper="Yeni fiyat kararlarında referans alınacak güvenli marj yüzdesi."
                  error={visibleError("defaultMarginTarget")}
                  badge={visibleError("defaultMarginTarget") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
                >
                  <div className="relative">
                    <input
                      aria-label="Hedef Marj"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.sellerProfile.defaultMarginTarget}
                      onChange={(event) => updateSellerProfile("defaultMarginTarget", event.target.value)}
                      onBlur={() => updateTouched("defaultMarginTarget")}
                      className={cn(
                        "h-11 w-full rounded-xl border bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                        visibleError("defaultMarginTarget") ? "border-warning/40" : "border-border/70"
                      )}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                      %
                    </span>
                  </div>
                </SettingsField>
              </div>

              <SettingsField
                label="Aylık Sipariş Beklentisi"
                helper="Sabit gideri sipariş başına bölmek için kullanılan temel hacim."
                error={visibleError("expectedMonthlyOrderCount")}
                badge={
                  visibleError("expectedMonthlyOrderCount") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null
                }
              >
                <div className="relative">
                  <Calculator className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    aria-label="Aylık Sipariş Beklentisi"
                    type="number"
                    min="1"
                    step="1"
                    value={form.sellerProfile.expectedMonthlyOrderCount}
                    onChange={(event) => updateSellerProfile("expectedMonthlyOrderCount", event.target.value)}
                    onBlur={() => updateTouched("expectedMonthlyOrderCount")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("expectedMonthlyOrderCount") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                </div>
              </SettingsField>
            </div>
          </SectionCard>

          <SectionCard
            icon={Package2}
            title="Hesap Varsayılanları"
            description="Yeni ürün, kanal ve risk hesaplarında başlangıç referansı olacak varsayımları belirleyin."
            warningCount={missingSummary.missingBySection.calculationDefaults}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SettingsField
                label="Varsayılan Komisyon"
                helper="Yeni kanal kurgularında başlangıç komisyon yüzdesi."
                error={visibleError("defaultCommission")}
                badge={visibleError("defaultCommission") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
              >
                <div className="relative">
                  <Percent className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    aria-label="Varsayılan Komisyon"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.calculationDefaults.defaultCommission}
                    onChange={(event) => updateCalculationDefaults("defaultCommission", event.target.value)}
                    onBlur={() => updateTouched("defaultCommission")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("defaultCommission") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                </div>
              </SettingsField>

              <SettingsField
                label="Varsayılan Paketleme"
                helper="Ürün kartı eksikse kullanılacak güvenli paketleme maliyeti."
                error={visibleError("defaultPackagingCost")}
                badge={
                  visibleError("defaultPackagingCost") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null
                }
              >
                <div className="relative">
                  <input
                    aria-label="Varsayılan Paketleme"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.calculationDefaults.defaultPackagingCost}
                    onChange={(event) => updateCalculationDefaults("defaultPackagingCost", event.target.value)}
                    onBlur={() => updateTouched("defaultPackagingCost")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 px-4 pr-10 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("defaultPackagingCost") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                    TL
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Risk Eşiği"
                helper="Tahmin ve stok modüllerinin uyarı üretmeye başlayacağı yüzdelik sapma."
                error={visibleError("defaultRiskThreshold")}
                badge={visibleError("defaultRiskThreshold") ? <StatusBadge tone="warning">Gerekli</StatusBadge> : null}
              >
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <input
                    aria-label="Risk Eşiği"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.calculationDefaults.defaultRiskThreshold}
                    onChange={(event) => updateCalculationDefaults("defaultRiskThreshold", event.target.value)}
                    onBlur={() => updateTouched("defaultRiskThreshold")}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-surface-container/70 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/35",
                      visibleError("defaultRiskThreshold") ? "border-warning/40" : "border-border/70"
                    )}
                  />
                </div>
              </SettingsField>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <GlassCard className="border-border-strong/70 bg-panel/92 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {isDirty ? "Kaydedilmeyi bekleyen mağaza varsayımları var" : "Mağaza varsayımları güncel"}
              </span>
              {missingSummary.missingFields.length > 0 ? (
                <StatusBadge tone="warning">{missingSummary.missingFields.length} alan kontrol edilmeli</StatusBadge>
              ) : (
                <StatusBadge tone="profit">Kârlılık hesabı hazır</StatusBadge>
              )}
              <span className="text-xs text-muted">
                {isDirty ? "Kaydettiğinizde tüm net kâr sonuçları yeniden hesaplanır." : "En son sürüm gösteriliyor."}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || (!isDirty && !submitAttempted)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Mağaza Bilgilerini Kaydet"
              )}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
