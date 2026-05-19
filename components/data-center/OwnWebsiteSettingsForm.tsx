"use client";

import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";

type WebsiteSettingsState = {
  gateway_name: string;
  commission_rate: number;
  fixed_fee: number;
  manual_shipping_cost: number;
  include_kdv: boolean;
  avg_ad_cost: number;
  avg_conversion_rate: number;
};

const DEFAULT_STATE: WebsiteSettingsState = {
  gateway_name: "Kullanıcı Tanımlı Ödeme Altyapısı",
  commission_rate: 3.49,
  fixed_fee: 0.25,
  manual_shipping_cost: 95,
  include_kdv: true,
  avg_ad_cost: 56.2,
  avg_conversion_rate: 2.6,
};

export function OwnWebsiteSettingsForm() {
  const [form, setForm] = useState<WebsiteSettingsState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/website-settings", { cache: "no-store" });
        const data = await response.json();
        if (data?.success && data.settings) {
          setForm({
            gateway_name: data.settings.gateway_name ?? DEFAULT_STATE.gateway_name,
            commission_rate: Number(data.settings.commission_rate ?? DEFAULT_STATE.commission_rate),
            fixed_fee: Number(data.settings.fixed_fee ?? DEFAULT_STATE.fixed_fee),
            manual_shipping_cost: Number(data.settings.manual_shipping_cost ?? DEFAULT_STATE.manual_shipping_cost),
            include_kdv: Boolean(data.settings.include_kdv ?? DEFAULT_STATE.include_kdv),
            avg_ad_cost: Number(data.settings.avg_ad_cost ?? DEFAULT_STATE.avg_ad_cost),
            avg_conversion_rate: Number(data.settings.avg_conversion_rate ?? DEFAULT_STATE.avg_conversion_rate),
          });
        }
      } catch (error) {
        console.error("Website settings load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/website-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Website settings could not be saved");
      }
      setMessage("Ayarlar kaydedildi. Kendi web sitesi maliyetleri güncellendi.");
    } catch (error) {
      console.error("Website settings save error:", error);
      setMessage("Ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/50 flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm text-muted-foreground leading-relaxed">
          Kendi web sitemde pazaryeri komisyonu ve platform bedeli yoktur. Ancak ödeme altyapısı, reklam, trafik ve kargo maliyetleri doğrudan satıcıya aittir. Bu ayarlar Net Maliyet içindeki Kendi Web Sitem hesaplamaları için kullanılır.
        </span>
      </div>

      <GlassCard>
        <h3 className="text-xl font-heading font-semibold text-foreground mb-6">Ödeme ve Kargo Ayarları</h3>

        {message && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-surface-container text-sm text-soft">
            {message}
          </div>
        )}

        <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Ödeme Altyapısı Sağlayıcı</label>
              <input
                type="text"
                value={form.gateway_name}
                onChange={(e) => setForm({ ...form, gateway_name: e.target.value })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">Ödeme Komisyon Oranı (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">Sabit İşlem Ücreti (TL)</label>
              <input
                type="number"
                step="0.01"
                value={form.fixed_fee}
                onChange={(e) => setForm({ ...form, fixed_fee: Number(e.target.value) })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">Manuel Kargo Maliyeti (TL)</label>
              <input
                type="number"
                value={form.manual_shipping_cost}
                onChange={(e) => setForm({ ...form, manual_shipping_cost: Number(e.target.value) })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
              <p className="text-xs text-muted-foreground mt-2">Sabit desi/kargo maliyetiniz.</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">Ortalama Reklam Maliyeti (TL / Ürün)</label>
              <input
                type="number"
                step="0.01"
                value={form.avg_ad_cost}
                onChange={(e) => setForm({ ...form, avg_ad_cost: Number(e.target.value) })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">Ortalama Dönüşüm Oranı (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.avg_conversion_rate}
                onChange={(e) => setForm({ ...form, avg_conversion_rate: Number(e.target.value) })}
                className="w-full bg-input border border-outline-variant rounded-xl p-3 text-foreground focus:border-primary/50 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.include_kdv}
                onChange={(e) => setForm({ ...form, include_kdv: e.target.checked })}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm text-foreground">Kesintilere KDV Dahil</span>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving || loading}
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Veriler yükleniyor...
                </span>
              ) : saving ? (
                "Kaydediliyor..."
              ) : (
                "Ayarları Kaydet"
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
