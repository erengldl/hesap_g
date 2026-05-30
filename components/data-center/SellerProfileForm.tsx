"use client";

import { useEffect, useState } from "react";
import { Building2, Calculator, Coins, Info, Loader2 } from "lucide-react";
import { GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type SellerProfileState = {
  company_type: string;
  tax_bracket: number;
  expected_monthly_order_count: number;
  active_monthly_expense_total: number;
  unit_fixed_cost: number;
};

const DEFAULT_STATE: SellerProfileState = {
  company_type: "Şahıs Şirketi",
  tax_bracket: 20,
  expected_monthly_order_count: 500,
  active_monthly_expense_total: 0,
  unit_fixed_cost: 0,
};

type MessageState = {
  text: string;
  tone: "success" | "error" | "info";
} | null;

export function SellerProfileForm() {
  const [form, setForm] = useState<SellerProfileState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/seller-profile", { cache: "no-store" });
        const data = await response.json();
        if (data?.success && data.profile) {
          setForm({
            company_type: String(data.profile.company_type ?? DEFAULT_STATE.company_type),
            tax_bracket: Number(data.profile.tax_bracket ?? DEFAULT_STATE.tax_bracket),
            expected_monthly_order_count: Number(data.profile.expected_monthly_order_count ?? DEFAULT_STATE.expected_monthly_order_count),
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
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/seller-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_type: form.company_type,
          tax_bracket: form.tax_bracket,
          expected_monthly_order_count: form.expected_monthly_order_count,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Şirket bilgileri kaydedilemedi");
      }

      setForm((current) => ({
        ...current,
        active_monthly_expense_total: Number(data.profile?.active_monthly_expense_total ?? current.active_monthly_expense_total),
        unit_fixed_cost: Number(data.profile?.unit_fixed_cost ?? current.unit_fixed_cost),
      }));
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

  const companyTypes = [
    "Şahıs Şirketi",
    "Limited Şirket",
    "Anonim Şirket",
  ];

  const taxBrackets = [15, 20, 27, 35, 40];

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
              <p className="text-2xl font-extrabold text-foreground">{formatCurrency(form.active_monthly_expense_total)}</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted">Ürün Başı Sabit Gider</p>
            {loading ? (
              <SkeletonCard variant="text-line" height={24} className="mt-2 w-24" />
            ) : (
              <p className="text-2xl font-extrabold text-primary">{formatCurrency(form.unit_fixed_cost)}</p>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={cn("mb-6 rounded-2xl border px-4 py-3 text-sm", messageClassName)}>
          {message.text}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-info/10 bg-info/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-info" />
          <p className="text-sm leading-relaxed text-info/90">
            Bu alan sadece şirket ve vergi parametrelerini saklar. Sabit operasyon giderlerini üstteki
            <strong> Genel Giderler</strong> bölümünden yönetin.
          </p>
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Şirket Türü</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {companyTypes.map((companyType) => (
                <button
                  key={companyType}
                  type="button"
                  onClick={() => setForm({ ...form, company_type: companyType })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm transition-all duration-200",
                    form.company_type === companyType
                      ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                      : "border-border bg-surface-container text-muted hover:border-border-strong hover:bg-surface-container hover:text-foreground"
                  )}
                >
                  {companyType}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Vergi Oranı / Tahmini Yük
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {taxBrackets.map((bracket) => (
                <button
                  key={bracket}
                  type="button"
                  onClick={() => setForm({ ...form, tax_bracket: bracket })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm transition-all duration-200",
                    form.tax_bracket === bracket
                      ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                      : "border-border bg-surface-container text-muted hover:border-border-strong hover:bg-surface-container hover:text-foreground"
                  )}
                >
                  %{bracket}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Aylık Tahmini Sipariş Sayısı
            </label>
            <div className="relative">
              <Calculator className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="number"
                min={1}
                value={form.expected_monthly_order_count}
                onChange={(event) =>
                  setForm({ ...form, expected_monthly_order_count: Number(event.target.value) })
                }
                className="w-full rounded-xl border border-border bg-surface-container py-3 pl-12 pr-4 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
              />
            </div>
            <p className="text-xs text-muted">
              Bu değer, sabit giderlerin ürün başına düşen payını daha gerçekçi göstermek için kullanılır.
            </p>
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
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
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
