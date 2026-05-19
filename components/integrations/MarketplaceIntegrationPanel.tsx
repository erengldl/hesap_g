"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  KeyRound,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
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
    glow: string;
    badge: string;
    logoLabel: string;
    tagline: string;
  }
> = {
  trendyol: {
    accent: "#FF6A00",
    glow: "rgba(255, 106, 0, 0.35)",
    badge: "Bağlantı",
    logoLabel: "Trendyol",
    tagline: "Sipariş ve stok akışı",
  },
  hepsiburada: {
    accent: "#1D4ED8",
    glow: "rgba(29, 78, 216, 0.35)",
    badge: "Bağlantı",
    logoLabel: "Hepsiburada",
    tagline: "Sipariş ve ürün akışı",
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
    last_error: "Bağlantı bilgileri alınamıyor.",
  };
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Son güncelleme yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Son güncelleme yok";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "şimdi";
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gün önce`;
}

function formatExactTime(value?: string | null) {
  if (!value) return "Bilgi yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bilgi yok";
  return date.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function statusClassName(state: MarketplaceConnectionState) {
  if (state === "connected") {
    return "border-success/20 bg-success/10 text-success";
  }
  if (state === "degraded") {
    return "border-warning/20 bg-warning/10 text-warning";
  }
  return "border-danger/20 bg-danger/10 text-danger";
}

function statusLabel(state: MarketplaceConnectionState) {
  if (state === "connected") return "Bağlı";
  if (state === "degraded") return "Sorunlu";
  return "Kapalı";
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
  if (slug === "trendyol") {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-container text-foreground"
      >
        <span className="text-sm font-extrabold tracking-tight">TY</span>
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-container text-foreground"
    >
      <span className="text-sm font-extrabold tracking-tight">HB</span>
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
    <motion.div
      className="group relative cursor-pointer"
      onClick={() => onOpen(item)}
    >
      <GlassCard className="h-full border border-border bg-surface-container transition-colors duration-200 hover:border-primary/20">
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <BrandGlyph slug={item.marketplace_slug} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {meta.logoLabel}
                  </h3>
                  <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {meta.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{meta.tagline}</p>
              </div>
            </div>

            <span className={cn("rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", statusClassName(item.connection_state))}>
              {statusLabel(item.connection_state)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border/80 bg-surface-container p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Satıcı</p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.merchant_id ?? "Belirtilmedi"}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-surface-container p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Son senkron</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{formatRelativeTime(item.last_sync_time)}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/80 bg-surface-container px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                <Clock3 className="h-3.5 w-3.5" />
                Son güncelleme
              </div>
              <p className="mt-2 text-sm text-muted">{formatExactTime(item.last_sync_time)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-surface-container px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                <ShieldCheck className="h-3.5 w-3.5" />
                Anahtar
              </div>
              <p className="mt-2 text-sm text-muted">{item.api_key_masked ?? "Gizli"}</p>
            </div>
          </div>

          {item.last_error && (
            <div className="mt-3 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger/80">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" />
                Sorun
              </div>
              {item.last_error}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSync(item);
              }}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-[color,transform] duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Senkron sürüyor" : "Güncelle"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
              className="action-inline-button"
            >
              <Settings className="h-4 w-4" />
              Düzenle
            </button>
            <div className="ml-auto flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-panel/75 px-4 py-8 backdrop-blur-xl"
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
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--shadow-card)]"
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${meta.accent}, var(--success))` }}
        />

        <div className="p-6 md:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <span className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.25em] text-primary">
                {meta.badge}
              </span>
              <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">{meta.logoLabel} bağlantısı</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Satıcı bilgilerini buradan güncelle.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-border bg-surface-container px-4 py-2 text-sm font-bold text-soft transition-[color,transform] duration-200 hover:bg-surface-container hover:text-foreground active:scale-[0.98]"
            >
              Kapat
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-muted">Satıcı</span>
                <input
                  value={form.merchant_id}
                  onChange={(event) => onChange({ ...form, merchant_id: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container"
                  placeholder="Satıcı kodu"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-muted">Anahtar</span>
                <input
                  value={form.api_key}
                  onChange={(event) => onChange({ ...form, api_key: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container"
                  placeholder="Yeni anahtar"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-muted">Gizli anahtar</span>
                <input
                  type="password"
                  value={form.api_secret}
                  onChange={(event) => onChange({ ...form, api_secret: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40 focus:bg-surface-container"
                  placeholder="Yeni gizli anahtar"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-border bg-surface-container px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Bağlantı açık</p>
                  <p className="text-xs text-muted">Kapalıysa güncelleme durur.</p>
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
              <div className="rounded-xl border border-border bg-surface-container p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-primary">Güvenlik</p>
                    <p className="text-sm text-muted">Anahtarlar gizli saklanır</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted">
                  <p>• Anahtarlar gizli kalır.</p>
                  <p>• Boş alanlar mevcut değeri korur.</p>
                  <p>• Güncelleme saati yenilenir.</p>
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-primary">Fiyat aktarımı</p>
                    <p className="text-sm text-muted">Senkron fiyat güncellemelerini de gönderir.</p>
                  </div>
                </div>
                <div className="mt-4 text-sm leading-relaxed text-muted">
                  Yeni fiyatlar bu bağlantı üzerinden pazaryerine gider.
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-container p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted">Durum</p>
                <p className="mt-2 text-sm text-soft">
                  {item.last_error ? item.last_error : "Bağlantı hazır."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-border bg-surface-container px-5 py-3 text-sm font-bold text-soft transition-[color,transform] duration-200 hover:bg-surface-container hover:text-foreground active:scale-[0.98]"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-black transition-[color,transform] duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
              <RefreshCw className={cn("h-4 w-4", saving && "animate-spin")} />
              {saving ? "Kaydediliyor" : "Kaydet ve güncelle"}
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
    const fallbackItems = [createFallbackMarketplaceItem("trendyol"), createFallbackMarketplaceItem("hepsiburada")];
    if (marketplaces.length === 0) {
      return fallbackItems;
    }

    const bySlug = new Map(marketplaces.map((item) => [item.marketplace_slug, item]));
    return fallbackItems.map((fallbackItem) => bySlug.get(fallbackItem.marketplace_slug) ?? fallbackItem);
  }, [marketplaces]);

  const refreshStatus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/marketplace-integrations/status", { cache: "no-store" });
      const payload = await readMarketplaceResponse<MarketplaceIntegrationStatusResponse>(response);
      if (!response.ok || !payload?.success) {
        throw new Error((payload as { error?: string } | null)?.error || "Bağlantı durumu yüklenemedi");
      }
      setMarketplaces(Array.isArray(payload.marketplaces) ? payload.marketplaces : []);
    } catch (error) {
      console.error("Marketplace status load error:", error);
      setToast({ text: "Bağlantı durumu alınamadı.", tone: "error" });
      setMarketplaces([]);
      setLoadError("API bağlantısı kurulamadı. Sunucu yanıt vermiyor. İnternet bağlantınızı kontrol edip tekrar deneyin.");
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
      .sort((a, b) => b - a)[0];
    if (!latest) return "Son güncelleme yok";
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

  const handleSave = async () => {
    if (!selectedItem) return;
    if (!form.merchant_id.trim()) {
      showToast("Satıcı alanı zorunlu.", "error");
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
        throw new Error((data as { error?: string } | null)?.error || "Bağlantı kaydedilemedi.");
      }

      const syncResult = await runSync(selectedItem, { silent: true });
      if (!syncResult.success) {
        showToast("Kaydedildi, ancak güncelleme başlatılamadı.", "info");
        closeEditor();
        return;
      }

      showToast("Kaydedildi. Güncelleme başlatıldı.", "success");
      closeEditor();
    } catch (error) {
      console.error("Credential save error:", error);
      showToast("Bağlantı kaydedilemedi.", "error");
    } finally {
      setSavingSlug(null);
    }
  };

  const runSync = async (item: MarketplaceIntegrationStatusItem, options?: { silent?: boolean }) => {
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
        throw new Error((data as { error?: string } | null)?.error || "Güncelleme başarısız.");
      }

      await refreshStatus();
      const warnings = Array.isArray(data.warnings) && data.warnings.length > 0 ? ` (${data.warnings.join(" • ")})` : "";
      if (!options?.silent) {
        showToast(`${item.marketplace_name} güncellendi.${warnings}`, "success");
      }
      return { success: true as const, warnings: Array.isArray(data.warnings) ? data.warnings : [] };
    } catch (error) {
      console.error("Marketplace sync error:", error);
      if (!options?.silent) {
        showToast(`${item.marketplace_name} güncellemesi başarısız.`, "error");
      }
      return { success: false as const };
    } finally {
      if (!options?.silent) {
        setSyncingSlug(null);
      }
    }
  };

  const syncOne = async (item: MarketplaceIntegrationStatusItem) => {
    await runSync(item);
  };

  const syncAll = async () => {
    setSyncingSlug("all");
    try {
      const connectedItems = displayMarketplaces.filter((item) => item.has_credentials && item.is_active);
      if (connectedItems.length === 0) {
        showToast("Önce en az bir aktif bağlantı ekle.", "info");
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
        showToast(`Bazı bağlantılar güncellenemedi: ${failures.join(", ")}`, "error");
      } else {
        showToast("Tüm aktif bağlantılar güncellendi.", "success");
      }
    } finally {
      setSyncingSlug(null);
    }
  };

  const hasAnyDisconnected = displayMarketplaces.some((item) => item.connection_state !== "connected");

  if (loadError) {
    return (
      <ErrorStateCard
        title="API bağlantı hatası"
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
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
      <GlassCard className="border border-border bg-surface-container">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Güvenli saklama
              </span>
              <span className="rounded-md border border-border bg-surface-container px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Otomatik senkron
              </span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Trendyol ve Hepsiburada bağlantılarını tek yerden yönetin. Kaydetme sonrası senkron arka planda başlar.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-lg border border-border bg-surface-container p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Bağlı</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{connectedCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-container p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Son güncelleme</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{lastSyncSummary}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-container p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Durum</p>
              <p className={cn("mt-2 text-sm font-semibold", hasAnyDisconnected ? "text-danger" : "text-primary")}>
                {hasAnyDisconnected ? "Düzeltilmeli" : "Tam bağlı"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={syncAll}
                disabled={syncingSlug === "all" || loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-[color,transform] duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", syncingSlug === "all" && "animate-spin")} />
                {syncingSlug === "all" ? "Güncelleme sürüyor" : "Tümünü güncelle"}
              </button>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Otomatik yenileme
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                <ArrowUpRight className="h-4 w-4 text-secondary" />
                Fiyat aktarımı açık
              </div>
        </div>
      </GlassCard>

        {toast && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm font-semibold",
              toast.tone === "success"
                ? "border-success/20 bg-success/10 text-success"
                : toast.tone === "error"
                  ? "border-danger/20 bg-danger/10 text-danger/80"
                  : "border-info/20 bg-info/10 text-info"
            )}
          >
            {toast.text}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {loading ? (
            <div className="grid gap-6 xl:col-span-2 xl:grid-cols-2">
              {[0, 1].map((index) => (
                <GlassCard key={index} className="h-64 animate-pulse border border-border bg-surface-container">
                  <div className="h-full w-full rounded-xl bg-gradient-to-br from-surface-container/60 via-surface-container/80 to-transparent" />
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

        <GlassCard className="border border-border bg-surface-container">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Ne yapar</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">Tek yerden yönet</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Sipariş ve stok akışını çek, sonra yeni fiyatları gönder.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Nasıl çalışır</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li>• Bağlantılar güvenli saklanır</li>
                <li>• Gerekirse güncelleme tekrar denenir</li>
                <li>• Fiyatlar seçili kanallara gider</li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Dikkat</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {hasAnyDisconnected
                  ? "Kırmızı durum, müdahale gerektiren bağlantıları gösterir."
                  : "Tüm kanallar bağlı; güncelleme ve fiyat aktarımı hazır."}
              </p>
            </div>
          </div>
        </GlassCard>
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
