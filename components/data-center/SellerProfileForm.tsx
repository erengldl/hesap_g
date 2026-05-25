"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Calculator, Coins, Info, Loader2 } from "lucide-react";

import { GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import { parseLocaleNumberValue, sellerProfileSchema, SELLER_COMPANY_TYPES, SELLER_TAX_BRACKETS, type SellerProfileSchemaInput } from "@/lib/validation-schemas";
import { cn } from "@/lib/utils";

type SellerProfileMetrics = {
  active_monthly_expense_total: number;
  unit_fixed_cost: number;
};

const DEFAULT_VALUES: SellerProfileSchemaInput = {
  company_type: "Şahıs Şirketi",
  tax_bracket: 20,
  expected_monthly_order_count: "500",
};

type MessageState = {
  text: string;
  tone: "success" | "error" | "info";
} | null;

export function SellerProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [metrics, setMetrics] = useState<SellerProfileMetrics>({
    active_monthly_expense_total: 0,
    unit_fixed_cost: 0,
  });

  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<SellerProfileSchemaInput>({
    resolver: zodResolver(sellerProfileSchema),
    mode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  const selectedCompanyType = useWatch({ control, name: "company_type" });
  const selectedTaxBracket = useWatch({ control, name: "tax_bracket" });

  useEffect(() => {
    register("company_type");
    register("tax_bracket");
  }, [register]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/seller-profile", { cache: "no-store" });
        const data = await response.json();

        if (data?.success && data.profile) {
          reset({
            company_type: String(data.profile.company_type ?? DEFAULT_VALUES.company_type),
            tax_bracket: Number(data.profile.tax_bracket ?? DEFAULT_VALUES.tax_bracket),
            expected_monthly_order_count: String(data.profile.expected_monthly_order_count ?? DEFAULT_VALUES.expected_monthly_order_count),
          });
          setMetrics({
            active_monthly_expense_total: Number(data.profile.active_monthly_expense_total ?? 0),
            unit_fixed_cost: Number(data.profile.unit_fixed_cost ?? 0),
          });
        }
      } catch (error) {
        console.error("Seller profile load error:", error);
        setMessage({ text: "Şirket bilgileri yüklenemedi.", tone: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, [reset]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const onSubmit = async (values: SellerProfileSchemaInput) => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/seller-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_type: values.company_type,
          tax_bracket: values.tax_bracket,
          expected_monthly_order_count: Number(parseLocaleNumberValue(values.expected_monthly_order_count)),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Şirket bilgileri kaydedilemedi");
      }

      reset({
        company_type: String(data.profile?.company_type ?? values.company_type),
        tax_bracket: Number(data.profile?.tax_bracket ?? values.tax_bracket),
        expected_monthly_order_count: String(data.profile?.expected_monthly_order_count ?? values.expected_monthly_order_count),
      });
      setMetrics({
        active_monthly_expense_total: Number(data.profile?.active_monthly_expense_total ?? metrics.active_monthly_expense_total),
        unit_fixed_cost: Number(data.profile?.unit_fixed_cost ?? metrics.unit_fixed_cost),
      });
      setMessage({ text: "Şirket bilgileri kaydedildi.", tone: "success" });
    } catch (error) {
      console.error("Seller profile save error:", error);
      setMessage({ text: "Şirket bilgileri kaydedilemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const messageClassName =
    message?.tone === "success"
      ? "border-success/20 bg-success/5 text-success"
      : message?.tone === "error"
        ? "border-danger/20 bg-danger/5 text-danger"
        : "border-info/20 bg-info/5 text-info";

  return (
    <GlassCard className="flex h-full flex-col">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Şirket Bilgileri</h3>
              <p className="text-sm text-muted">
                Vergi ve şirket parametrelerini burada tut. Genel giderler ayrı sekmede yönetilir.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted">Aylık Sabit Gider</p>
            {loading ? (
              <SkeletonCard variant="text-line" height={24} className="mt-2 w-28" />
            ) : (
              <p className="text-2xl font-extrabold text-foreground">{formatCurrency(metrics.active_monthly_expense_total)}</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted">Ürün Başı Sabit Gider</p>
            {loading ? (
              <SkeletonCard variant="text-line" height={24} className="mt-2 w-24" />
            ) : (
              <p className="text-2xl font-extrabold text-primary">{formatCurrency(metrics.unit_fixed_cost)}</p>
            )}
          </div>
        </div>
      </div>

      {message ? (
        <div className={cn("mb-6 rounded-2xl border px-4 py-3 text-sm", messageClassName)}>{message.text}</div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-info/10 bg-info/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-info" />
          <p className="text-sm leading-relaxed text-info/90">
            Bu alan sadece şirket ve vergi parametrelerini saklar. Sabit operasyon giderlerini üstteki
            <strong> Genel Giderler</strong> bölümünden yönetin.
          </p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="form-label">Şirket Türü</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SELLER_COMPANY_TYPES.map((companyType) => (
                <button
                  key={companyType}
                  type="button"
                  onClick={() => setValue("company_type", companyType, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm transition-all duration-200",
                    selectedCompanyType === companyType
                      ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                      : "border-border bg-surface-container text-muted hover:border-border-strong hover:bg-surface-container hover:text-foreground"
                  )}
                >
                  {companyType}
                </button>
              ))}
            </div>
            {errors.company_type?.message ? (
              <p className="text-[10px] text-danger">{errors.company_type.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="form-label">Vergi Oranı / Tahmini Yük</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SELLER_TAX_BRACKETS.map((bracket) => (
                <button
                  key={bracket}
                  type="button"
                  onClick={() => setValue("tax_bracket", bracket, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm transition-all duration-200",
                    selectedTaxBracket === bracket
                      ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                      : "border-border bg-surface-container text-muted hover:border-border-strong hover:bg-surface-container hover:text-foreground"
                  )}
                >
                  %{bracket}
                </button>
              ))}
            </div>
            {errors.tax_bracket?.message ? (
              <p className="text-[10px] text-danger">{errors.tax_bracket.message}</p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="expected_monthly_order_count" className="form-label">
              Aylık Tahmini Sipariş Sayısı
            </label>
            <div className="relative">
              <Calculator className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="expected_monthly_order_count"
                type="number"
                min={1}
                className={cn("form-input pl-12", errors.expected_monthly_order_count && "border-danger/50")}
                aria-invalid={Boolean(errors.expected_monthly_order_count)}
                {...register("expected_monthly_order_count")}
              />
            </div>
            {errors.expected_monthly_order_count?.message ? (
              <p className="text-[10px] text-danger">{errors.expected_monthly_order_count.message}</p>
            ) : (
              <p className="text-xs text-muted">
                Bu değer, sabit giderlerin ürün başına düşen payını daha gerçekçi göstermek için kullanılır.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
          <Coins className="h-4 w-4 text-muted" />
          <p className="text-xs leading-relaxed text-muted">
            Net maliyet ve kâr hesapları bu değerleri kullanır. Buradaki ayarlar doğrudan ürün hesaplamalarına
            yansır.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Şirket Bilgilerini Kaydet"
            )}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
