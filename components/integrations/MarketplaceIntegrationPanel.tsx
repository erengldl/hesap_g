"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ErrorStateCard, GlassCard } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import type {
  MarketplaceConnectionState,
  MarketplaceCredentialUpsertRequest,
  MarketplaceIntegrationStatusItem,
  MarketplaceIntegrationStatusResponse,
  MarketplaceSlug,
  MarketplaceSyncRequest,
  MarketplaceSyncResponse,
} from "@/lib/marketplace-integration-types";

type ToastTone = "success" | "error" | "info";

type ToastState = {
  text: string;
  tone: ToastTone;
} | null;

type CredentialFormState = {
  merchant_id: string;
  api_key: string;
  api_secret: string;
  is_active: boolean;
};

const MARKETPLACE_META: Record<
  MarketplaceSlug,
  {
    accent: string;
    badge: string;
    logoLabel: string;
    tagline: string;
  }
> = {
  trendyol: {
    accent: "#FF6A00",
    badge: "Marketplace",
    logoLabel: "Trendyol",
    tagline: "Siparis, stok ve fiyat akislarini yonet",
  },
  hepsiburada: {
    accent: "#1D4ED8",
    badge: "Marketplace",
    logoLabel: "Hepsiburada",
    tagline: "Urun ve siparis operasyonunu canli tut",
  },
};

function createFallbackMarketplaceItem(slug: MarketplaceSlug): MarketplaceIntegrationStatusItem {
  const meta = MARKETPLACE_META[slug];

  return {
    marketplace_id: slug === "trendyol" ? 1 : 2,
    marketplace_slug: slug,
    marketplace_name: meta.logoLabel,
    merchant_id: null,
    is_active: false,
    has_credentials: false,
    connection_state: "disconnected",
    api_key_masked: null,
    last_sync_time: null,
    last_sync_scope: null,
    last_error: "Baglanti bilgileri alinamiyor.",
  };
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Son guncelleme yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Son guncelleme yok";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "simdi";
  if (diffMinutes < 60) return `${diffMinutes} dk once`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa once`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gun once`;
}

function formatExactTime(value?: string | null) {
  if (!value) return "Bilgi yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bilgi yok";
  return date.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function statusClassName(state: MarketplaceConnectionState) {
  if (state === "connected") {
    return "border-emerald-200 bg-emerald-50 text-emerald-600";
  }
  if (state === "degraded") {
    return "border-amber-200 bg-amber-50 text-amber-600";
  }
  return "border-rose-200 bg-rose-50 text-rose-600";
}

function statusLabel(state: MarketplaceConnectionState) {
  if (state === "connected") return "Bagli";
  if (state === "degraded") return "Sorunlu";
  return "Kapali";
}

async function readMarketplaceResponse<T = unknown>(response: Response): Promise<T | null> {
  const rawText = await response.text();
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return null;
  }

  try {
    return JSON.parse(trimmedText) as T;
  } catch {
    return null;
  }
}

function BrandGlyph({ slug }: { slug: MarketplaceSlug }) {
  const label = slug === "trendyol" ? "TY" : "HB";

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-extrabold tracking-tight text-slate-900 shadow-sm">
      {label}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function MarketplaceCard({
  item,
  onOpen,
  onSync,
  syncing,
}: {
  item: MarketplaceIntegrationStatusItem;
  onOpen: (item: MarketplaceIntegrationStatusItem) => void;
  onSync: (item: MarketplaceIntegrationStatusItem) => void;
  syncing: boolean;
}) {
  const meta = MARKETPLACE_META[item.marketplace_slug];

  return (
    <motion.div className="group relative cursor-pointer" onClick={() => onOpen(item)}>
      <GlassCard className="h-full rounded-[26px] border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <BrandGlyph slug={item.marketplace_slug} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                    {meta.logoLabel}
                  </h3>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {meta.badge}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{meta.tagline}</p>
              </div>
            </div>

            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                statusClassName(item.connection_state)
              )}
            >
              {statusLabel(item.connection_state)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Seller</p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                {item.merchant_id ?? "Tanimlanmadi"}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Son sync</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatRelativeTime(item.last_sync_time)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Son guncelleme
              </div>
              <p className="mt-2 text-sm text-slate-600">{formatExactTime(item.last_sync_time)}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                API key
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.api_key_masked ?? "Gizli"}</p>
            </div>
          </div>

          {item.last_error ? (
            <div className="mt-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Sorun
              </div>
              {item.last_error}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSync(item);
              }}
              disabled={syncing}
              className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Sync suruyor" : "Guncelle"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
              className="btn-secondary px-4 py-2 text-sm"
            >
              <Settings className="h-4 w-4" />
              Duzenle
            </button>
            <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" />
              {statusLabel(item.connection_state)}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function CredentialModal({
  item,
  form,
  onClose,
  onChange,
  onSave,
  saving,
}: {
  item: MarketplaceIntegrationStatusItem;
  form: CredentialFormState;
  onClose: () => void;
  onChange: (next: CredentialFormState) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const meta = MARKETPLACE_META[item.marketplace_slug];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 px-4 py-8 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } }}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${meta.accent}, #10b981)` }}
        />

        <div className="p-6 md:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-500">
                {meta.badge}
              </span>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-900">
                {meta.logoLabel} baglantisi
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                Kimlik bilgilerini guncelle, baglantiyi aktif et ve kayit sonrasi otomatik sync
                tetikle.
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Kapat
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-400">
                  Seller ID
                </span>
                <input
                  value={form.merchant_id}
                  onChange={(event) => onChange({ ...form, merchant_id: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-white"
                  placeholder="Satici kodu"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-400">
                  API key
                </span>
                <input
                  value={form.api_key}
                  onChange={(event) => onChange({ ...form, api_key: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-white"
                  placeholder="Yeni key"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-400">
                  API secret
                </span>
                <input
                  type="password"
                  value={form.api_secret}
                  onChange={(event) => onChange({ ...form, api_secret: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-white"
                  placeholder="Yeni secret"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Baglanti acik</p>
                  <p className="text-xs text-slate-500">Kapaliysa otomatik sync durur.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Baglanti ozeti
                </p>
                <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-900">
                  {meta.logoLabel} ayarlari
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Bu panelden kimlik bilgilerini duzenleyip operasyon sagligini takip edebilirsin.
                </p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Durum</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {statusLabel(item.connection_state)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Son sync</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatRelativeTime(item.last_sync_time)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Not</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Kayit sonrasinda sistem otomatik sync dener. Sorun varsa kart uzerinde
                      gorunur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-3 text-sm">
              Vazgec
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="btn-primary px-5 py-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", saving && "animate-spin")} />
              {saving ? "Kaydediliyor" : "Kaydet ve sync et"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MarketplaceIntegrationPanel() {
  const [marketplaces, setMarketplaces] = useState<MarketplaceIntegrationStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncingSlug, setSyncingSlug] = useState<MarketplaceSlug | "all" | null>(null);
  const [savingSlug, setSavingSlug] = useState<MarketplaceSlug | null>(null);
  const [selectedItem, setSelectedItem] = useState<MarketplaceIntegrationStatusItem | null>(null);
  const [form, setForm] = useState<CredentialFormState>({
    merchant_id: "",
    api_key: "",
    api_secret: "",
    is_active: true,
  });
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const displayMarketplaces = useMemo(() => {
    const fallbackItems = [
      createFallbackMarketplaceItem("trendyol"),
      createFallbackMarketplaceItem("hepsiburada"),
    ];

    if (marketplaces.length === 0) {
      return fallbackItems;
    }

    const bySlug = new Map(marketplaces.map((item) => [item.marketplace_slug, item]));
    return fallbackItems.map(
      (fallbackItem) => bySlug.get(fallbackItem.marketplace_slug) ?? fallbackItem
    );
  }, [marketplaces]);

  const refreshStatus = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/marketplace-integrations/status", { cache: "no-store" });
      const payload =
        await readMarketplaceResponse<MarketplaceIntegrationStatusResponse>(response);

      if (!response.ok || !payload?.success) {
        throw new Error(
          (payload as { error?: string } | null)?.error ?? "Baglanti durumu yuklenemedi"
        );
      }

      setMarketplaces(Array.isArray(payload.marketplaces) ? payload.marketplaces : []);
    } catch (error) {
      console.error("Marketplace status load error:", error);
      setToast({ text: "Baglanti durumu alinamadi.", tone: "error" });
      setMarketplaces([]);
      setLoadError(
        "API baglantisi kurulamadi. Sunucu yanit vermiyor. Internet baglantini kontrol edip tekrar dene."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const connectedCount = useMemo(
    () => displayMarketplaces.filter((item) => item.connection_state === "connected").length,
    [displayMarketplaces]
  );

  const lastSyncSummary = useMemo(() => {
    const latest = displayMarketplaces
      .map((item) => (item.last_sync_time ? new Date(item.last_sync_time).getTime() : 0))
      .filter(Boolean)
      .sort((left, right) => right - left)[0];

    if (!latest) return "Son guncelleme yok";
    return formatRelativeTime(new Date(latest).toISOString());
  }, [displayMarketplaces]);

  const showToast = (text: string, tone: ToastTone) => setToast({ text, tone });

  const openEditor = (item: MarketplaceIntegrationStatusItem) => {
    setSelectedItem(item);
    setForm({
      merchant_id: item.merchant_id ?? "",
      api_key: "",
      api_secret: "",
      is_active: item.is_active,
    });
  };

  const closeEditor = () => {
    setSelectedItem(null);
    setForm({
      merchant_id: "",
      api_key: "",
      api_secret: "",
      is_active: true,
    });
  };

  const runSync = async (
    item: MarketplaceIntegrationStatusItem,
    options?: { silent?: boolean }
  ) => {
    if (!options?.silent) {
      setSyncingSlug(item.marketplace_slug);
    }

    try {
      const payload: MarketplaceSyncRequest = {
        marketplace_slug: item.marketplace_slug,
        scope: "full",
        lookback_days: 14,
        publish_price_updates: true,
      };

      const response = await fetch("/api/marketplace-integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readMarketplaceResponse<MarketplaceSyncResponse>(response);

      if (!response.ok || !data?.success) {
        throw new Error((data as { error?: string } | null)?.error ?? "Guncelleme basarisiz.");
      }

      await refreshStatus();

      if (!options?.silent) {
        const warnings =
          Array.isArray(data.warnings) && data.warnings.length > 0
            ? ` (${data.warnings.join(" • ")})`
            : "";
        showToast(`${item.marketplace_name} guncellendi.${warnings}`, "success");
      }

      return { success: true as const };
    } catch (error) {
      console.error("Marketplace sync error:", error);
      if (!options?.silent) {
        showToast(`${item.marketplace_name} guncellemesi basarisiz.`, "error");
      }
      return { success: false as const };
    } finally {
      if (!options?.silent) {
        setSyncingSlug(null);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    if (!form.merchant_id.trim()) {
      showToast("Satici alani zorunlu.", "error");
      return;
    }

    setSavingSlug(selectedItem.marketplace_slug);

    try {
      const payload: MarketplaceCredentialUpsertRequest = {
        marketplace_slug: selectedItem.marketplace_slug,
        merchant_id: form.merchant_id.trim(),
        api_key: form.api_key.trim() || null,
        api_secret: form.api_secret.trim() || null,
        is_active: form.is_active,
      };

      const response = await fetch("/api/marketplace-integrations/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readMarketplaceResponse<MarketplaceIntegrationStatusResponse>(response);
      if (!response.ok || !data?.success) {
        throw new Error((data as { error?: string } | null)?.error ?? "Baglanti kaydedilemedi.");
      }

      const syncResult = await runSync(selectedItem, { silent: true });
      if (!syncResult.success) {
        showToast("Kaydedildi, ancak sync baslatilamadi.", "info");
        closeEditor();
        return;
      }

      showToast("Kaydedildi. Sync baslatildi.", "success");
      closeEditor();
    } catch (error) {
      console.error("Credential save error:", error);
      showToast("Baglanti kaydedilemedi.", "error");
    } finally {
      setSavingSlug(null);
    }
  };

  const syncOne = async (item: MarketplaceIntegrationStatusItem) => {
    await runSync(item);
  };

  const syncAll = async () => {
    setSyncingSlug("all");

    try {
      const connectedItems = displayMarketplaces.filter(
        (item) => item.has_credentials && item.is_active
      );

      if (connectedItems.length === 0) {
        showToast("Once en az bir aktif baglanti ekle.", "info");
        return;
      }

      const failures: string[] = [];

      for (const item of connectedItems) {
        const result = await runSync(item, { silent: true });
        if (!result.success) {
          failures.push(item.marketplace_name);
        }
      }

      if (failures.length > 0) {
        showToast(`Bazi baglantilar guncellenemedi: ${failures.join(", ")}`, "error");
      } else {
        showToast("Tum aktif baglantilar guncellendi.", "success");
      }
    } finally {
      setSyncingSlug(null);
    }
  };

  const hasAnyDisconnected = displayMarketplaces.some(
    (item) => item.connection_state !== "connected"
  );

  if (loadError) {
    return (
      <ErrorStateCard
        title="API baglanti hatasi"
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors duration-200 hover:bg-rose-100"
          >
            <RefreshCw className="h-4 w-4" />
            Tekrar dene
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassCard className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                Secure vault
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Auto sync
              </span>
            </div>
            <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-slate-900">
              Pazar yeri baglantilarini tek panelden yonet
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Kimlik bilgilerini sakla, sync sagligini izle ve fiyat akislarini tek bir operasyon
              ekranindan kontrol et.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={syncAll}
              disabled={syncingSlug === "all" || loading}
              className="btn-primary px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", syncingSlug === "all" && "animate-spin")} />
              {syncingSlug === "all" ? "Toplu sync suruyor" : "Tumunu guncelle"}
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Otomatik yenileme
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ArrowUpRight className="h-4 w-4 text-secondary" />
              Fiyat aktarimi acik
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryTile
            label="Bagli hesap"
            value={connectedCount}
            hint="Aktif ve saglikli pazar yeri sayisi."
          />
          <SummaryTile
            label="Son sync"
            value={lastSyncSummary}
            hint="En son basarili veri hareketi."
          />
          <SummaryTile
            label="Operasyon durumu"
            value={hasAnyDisconnected ? "Mudahale gerek" : "Hazir"}
            hint={
              hasAnyDisconnected ? "En az bir baglanti sorunlu." : "Tum baglantilar calisiyor."
            }
          />
        </div>
      </GlassCard>

      {toast ? (
        <div
          className={cn(
            "rounded-[22px] border px-4 py-3 text-sm font-semibold",
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : toast.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
          )}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {loading ? (
          <div className="grid gap-6 xl:col-span-2 xl:grid-cols-2">
            {[0, 1].map((index) => (
              <GlassCard
                key={index}
                className="h-72 rounded-[26px] animate-pulse border border-slate-200 bg-white"
              >
                <div className="h-full w-full rounded-[20px] bg-gradient-to-br from-slate-100 via-white to-slate-50" />
              </GlassCard>
            ))}
          </div>
        ) : (
          displayMarketplaces.map((item) => (
            <MarketplaceCard
              key={item.marketplace_id}
              item={item}
              onOpen={openEditor}
              onSync={syncOne}
              syncing={syncingSlug === item.marketplace_slug}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedItem ? (
          <CredentialModal
            key={selectedItem.marketplace_id}
            item={selectedItem}
            form={form}
            onClose={closeEditor}
            onChange={setForm}
            onSave={handleSave}
            saving={savingSlug === selectedItem.marketplace_slug}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
