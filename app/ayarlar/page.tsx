"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, GlassCard } from "@/components/ui-custom/GlassComponents";
import { useAuth } from "@/components/layout/AuthContext";
import { ThemeModeSelector } from "@/components/theme/ThemeModeSelector";
import type { AuthUser } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  User,
  Lock,
  Bell,
  Globe,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  SunMoon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "profile" | "security" | "notifications" | "locale" | "appearance" | "billing" | "api";

type NotificationSettings = {
  stockAlerts: boolean;
  priceSuggestions: boolean;
  adPerformance: boolean;
  weeklyReport: boolean;
  systemUpdates: boolean;
};

type LocaleSettings = {
  language: "tr" | "en";
  currency: "try" | "usd" | "eur";
  dateFormat: "tr" | "iso" | "us";
};

type ApiSettings = {
  apiKey: string;
  webhookUrl: string;
};

const NOTIFICATION_SETTINGS_KEY = "hesapg.settings.notifications";
const LOCALE_SETTINGS_KEY = "hesapg.settings.locale";
const API_SETTINGS_KEY = "hesapg.settings.api";

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  stockAlerts: true,
  priceSuggestions: true,
  adPerformance: false,
  weeklyReport: true,
  systemUpdates: false,
};

const DEFAULT_LOCALE_SETTINGS: LocaleSettings = {
  language: "tr",
  currency: "try",
  dateFormat: "tr",
};

const DEFAULT_API_SETTINGS: ApiSettings = {
  apiKey: "hp_test_sk_demo",
  webhookUrl: "",
};

function usePersistentJsonState<T>(storageKey: string, fallbackValue: T) {
  const [value, setValue] = useState<T>(fallbackValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue) {
        setValue(JSON.parse(storedValue) as T);
      }
    } catch {
      // Keep fallback on parse/storage errors.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore storage quota / access errors in the demo shell.
    }
  }, [hydrated, storageKey, value]);

  return [value, setValue, hydrated] as const;
}

function createApiKey() {
  const randomSegment = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? "";
  const fallbackSegment =
    randomSegment ||
    Array.from(globalThis.crypto?.getRandomValues(new Uint8Array(12)) ?? new Uint8Array(12))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  return `hp_live_sk_${fallbackSegment.slice(0, 24)}`;
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 11) {
    return "*".repeat(apiKey.length);
  }
  return `${apiKey.slice(0, 11)}${"*".repeat(Math.max(12, apiKey.length - 11))}`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function selectTextInElement(element: HTMLElement | null) {
  if (!element) return false;

  const selection = window.getSelection();
  if (!selection) return false;

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Ayarlar"
        description="Hesabını, güvenlik tercihlerini ve entegrasyon uçlarını tek akışta yönet."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
         <div className="space-y-3">
            <div className="rounded-lg border border-border/80 bg-surface-container p-3">
              <div className="mb-3 border-b border-border/80 pb-3">
                <p className="text-sm font-semibold text-foreground">{user?.name || "Kullanıcı"}</p>
                <p className="mt-1 text-xs text-muted">{user?.email || ""}</p>
              </div>
              <div className="space-y-1">
            <SettingsNavItem icon={User} label="Profil" active={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
            <SettingsNavItem icon={Lock} label="Güvenlik" active={activeTab === "security"} onClick={() => setActiveTab("security")} />
            <SettingsNavItem icon={Bell} label="Bildirimler" active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} />
            <SettingsNavItem icon={Globe} label="Dil ve Para" active={activeTab === "locale"} onClick={() => setActiveTab("locale")} />
            <SettingsNavItem icon={SunMoon} label="Görünüm" active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")} />
            <SettingsNavItem icon={CreditCard} label="Abonelik" active={activeTab === "billing"} onClick={() => setActiveTab("billing")} />
            <SettingsNavItem icon={ShieldCheck} label="Bağlantılar" active={activeTab === "api"} onClick={() => setActiveTab("api")} />
              </div>

            <div className="pt-3">
               <button
                 onClick={handleLogout}
                 className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 font-medium text-danger transition-colors duration-200 hover:bg-danger/5"
               >
                  <LogOut className="w-5 h-5" />
                  Çıkış Yap
               </button>
            </div>
            </div>
         </div>

         <div>
           {activeTab === "profile" && <ProfileTab user={user} />}
           {activeTab === "security" && <SecurityTab />}
           {activeTab === "notifications" && <NotificationsTab />}
           {activeTab === "locale" && <LocaleTab />}
           {activeTab === "appearance" && <AppearanceTab />}
           {activeTab === "billing" && <BillingTab />}
           {activeTab === "api" && <ApiTab />}
         </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────

function ProfileTab({ user }: { user: AuthUser | null }) {
  const { success, error: toastError } = useToast();
  const { refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [company, setCompany] = useState(user?.company || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setCompany(user?.company || "");
    setPhone(user?.phone || "");
  }, [user?.company, user?.name, user?.phone]);

  const avatarInitial = (user?.name || "K").charAt(0).toUpperCase();

  const handleSave = async () => {
    if (!name.trim()) {
      toastError("Ad soyad alani zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), company: company.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        success("Profil kaydedildi.");
        await refreshUser();
      } else {
        toastError(data.error || "Kaydetme başarısız.");
      }
    } catch {
      toastError("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard>
      <h3 className="mb-6 text-lg font-semibold text-foreground">Profil</h3>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-primary/30 bg-primary/20 text-2xl font-extrabold text-primary">
            {avatarInitial}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{user?.plan || "Premium plan"}</p>
            <p className="mt-2 text-[10px] text-muted">{user?.email || ""}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="form-label">Ad soyad</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
          </div>
          <div className="space-y-2">
            <label className="form-label">E-posta</label>
            <input type="email" value={user?.email || ""} disabled className="form-input opacity-60 cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <label className="form-label">Şirket</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Şirket adı" className="form-input" />
          </div>
          <div className="space-y-2">
            <label className="form-label">Telefon</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 555 000 00 00" className="form-input" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <button
            onClick={() => {
              setName(user?.name || "");
              setCompany(user?.company || "");
              setPhone(user?.phone || "");
            }}
            className="btn-ghost"
          >
            Vazgeç
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Security Tab ────────────────────────────────────────────────────

function SecurityTab() {
  const { success, error: toastError, info } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toastError("Mevcut ve yeni şifre gerekli.");
      return;
    }
    if (newPassword.length < 6) {
      toastError("Yeni şifre en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError("Yeni şifreler eşleşmiyor.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        success("Şifre güncellendi.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toastError(data.error || "Şifre güncellenemedi.");
      }
    } catch {
      toastError("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard>
      <h3 className="mb-6 text-lg font-semibold text-foreground">Güvenlik</h3>
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="form-label">Mevcut şifre</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="form-input pr-12"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors duration-200">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="form-label">Yeni şifre</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input pr-12"
              placeholder="En az 6 karakter"
            />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors duration-200">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="form-label">Yeni şifre (tekrar)</label>
          <input
            type={showNew ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
          />
        </div>
        <div className="border-t border-border pt-5">
          <h4 className="mb-3 font-semibold text-foreground">İki adımlı doğrulama</h4>
          <p className="mb-4 text-xs text-muted">Hesabına ekstra güvenlik ekle.</p>
          <button
            type="button"
            onClick={() => info("2FA kurulumu", "Bu demo ortamda henüz aktif değil.")}
            className="btn-secondary"
          >
            2FA'yı Aç
          </button>
        </div>
        <div className="flex justify-end border-t border-border pt-5">
          <button onClick={handleChangePassword} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Şifreyi Güncelle
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Notifications Tab ───────────────────────────────────────────────

function NotificationsTab() {
  const [toggles, setToggles] = usePersistentJsonState<NotificationSettings>(
    NOTIFICATION_SETTINGS_KEY,
    DEFAULT_NOTIFICATION_SETTINGS
  );

  const items = [
    { key: "stockAlerts" as const, label: "Stok", desc: "Stok kritik seviyeye düşünce haber ver" },
    { key: "priceSuggestions" as const, label: "Fiyat önerisi", desc: "Fiyat önerisi hazır olunca haber ver" },
    { key: "adPerformance" as const, label: "Reklam", desc: "Günlük reklam özeti" },
    { key: "weeklyReport" as const, label: "Haftalık özet", desc: "Her pazartesi kısa özet" },
    { key: "systemUpdates" as const, label: "Güncellemeler", desc: "Yeni özellik ve düzeltmeler" },
  ];

  return (
    <GlassCard>
      <h3 className="mb-5 text-lg font-semibold text-foreground">Bildirimler</h3>
      <p className="mb-4 text-xs text-muted">
        Değişiklikler bu cihazda saklanır.
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-md border border-border bg-surface-container px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-[10px] text-muted">{item.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setToggles((current) => ({ ...current, [item.key]: !current[item.key] }))}
              className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 relative active:scale-[0.98]",
                toggles[item.key] ? "bg-primary" : "bg-border"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full bg-background absolute top-1 transition-transform duration-200",
                toggles[item.key] ? "left-6" : "left-1"
              )} />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Locale Tab ──────────────────────────────────────────────────────

function LocaleTab() {
  const [locale, setLocale] = usePersistentJsonState<LocaleSettings>(
    LOCALE_SETTINGS_KEY,
    DEFAULT_LOCALE_SETTINGS
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <GlassCard>
        <h4 className="mb-2 font-semibold text-foreground">Dil</h4>
        <p className="mb-4 text-xs text-muted">Uygulama dili. Değişiklikler otomatik kaydedilir.</p>
        <select
          className="form-select"
          value={locale.language}
          onChange={(event) => setLocale((current) => ({ ...current, language: event.target.value as LocaleSettings["language"] }))}
        >
          <option value="tr">Türkçe (TR)</option>
          <option value="en">English (US)</option>
        </select>
      </GlassCard>

      <GlassCard>
        <h4 className="mb-2 font-semibold text-foreground">Para birimi</h4>
        <p className="mb-4 text-xs text-muted">Varsayılan para birimi. Değişiklikler otomatik kaydedilir.</p>
        <select
          className="form-select"
          value={locale.currency}
          onChange={(event) => setLocale((current) => ({ ...current, currency: event.target.value as LocaleSettings["currency"] }))}
        >
          <option value="try">TL (₺)</option>
          <option value="usd">US Dollar ($)</option>
          <option value="eur">Euro (€)</option>
        </select>
      </GlassCard>

      <GlassCard>
        <h4 className="mb-2 font-semibold text-foreground">Tarih</h4>
        <p className="mb-4 text-xs text-muted">Rapor tarihi. Değişiklikler otomatik kaydedilir.</p>
        <select
          className="form-select"
          value={locale.dateFormat}
          onChange={(event) => setLocale((current) => ({ ...current, dateFormat: event.target.value as LocaleSettings["dateFormat"] }))}
        >
          <option value="tr">GG.AA.YYYY (TR)</option>
          <option value="iso">YYYY-MM-DD (ISO)</option>
          <option value="us">MM/DD/YYYY (US)</option>
        </select>
      </GlassCard>
    </div>
  );
}

// ─── Appearance Tab ─────────────────────────────────────────────────

function AppearanceTab() {
  return (
    <GlassCard>
      <h3 className="mb-2 text-lg font-semibold text-foreground">Görünüm</h3>
      <p className="mb-5 text-xs text-muted">
        Koyu, açık veya sistem temasını seç. Tercihin sayfa yenilense bile korunur.
      </p>
      <ThemeModeSelector />
    </GlassCard>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────

function BillingTab() {
  return (
    <GlassCard>
      <h3 className="mb-6 text-lg font-semibold text-foreground">Abonelik</h3>
      <p className="mb-5 text-xs text-muted">
        Bu bölüm sadece görüntüleme amaçlıdır.
      </p>
      <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Pro plan</p>
            <p className="mt-1 text-xs text-muted">Aylık ₺499 · 30 günlük dönem</p>
          </div>
          <span className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">Aktif</span>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Son faturalar</p>
        {[
          { date: "01 May 2026", amount: "₺499,00", status: "Ödendi" },
          { date: "01 Nis 2026", amount: "₺499,00", status: "Ödendi" },
          { date: "01 Mar 2026", amount: "₺499,00", status: "Ödendi" },
        ].map((invoice) => (
          <div key={invoice.date} className="flex items-center justify-between rounded-md border border-border bg-surface-container p-3">
            <span className="text-sm text-foreground">{invoice.date}</span>
            <span className="text-sm text-muted">{invoice.amount}</span>
            <span className="text-[10px] font-semibold text-primary">Ödendi</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── API Tab ─────────────────────────────────────────────────────────

function ApiTab() {
  const { success, error: toastError, warning } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [apiSettings, setApiSettings] = usePersistentJsonState<ApiSettings>(
    API_SETTINGS_KEY,
    DEFAULT_API_SETTINGS
  );
  const apiKeyTextRef = useRef<HTMLElement>(null);

  const fullApiKey = apiSettings.apiKey.trim();
  const displayedApiKey = fullApiKey ? (showKey ? fullApiKey : maskApiKey(fullApiKey)) : "Anahtar yok";

  const handleCopyKey = async () => {
    if (!fullApiKey) {
      warning("Aktif bir anahtar yok.");
      return;
    }

    try {
      const copiedToClipboard = await copyTextToClipboard(fullApiKey);
      if (!copiedToClipboard) {
        const selected = selectTextInElement(apiKeyTextRef.current);
        warning(
          selected
            ? "Otomatik kopyalama desteklenmedi. Anahtar seçildi."
            : "Otomatik kopyalama desteklenmedi."
        );
        return;
      }
      setCopied(true);
      success("Anahtar kopyalandı.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const selected = selectTextInElement(apiKeyTextRef.current);
      if (selected) {
        warning("Kopyalama başarısız oldu. Anahtar seçildi.");
        return;
      }
      toastError("Anahtar kopyalanamadı.");
    }
  };

  const handleGenerateKey = () => {
    const nextKey = createApiKey();
    setApiSettings((current) => ({ ...current, apiKey: nextKey }));
    setShowKey(false);
    setCopied(false);
    setWebhookStatus(null);
    success("Yeni anahtar oluşturuldu.");
  };

  const handleRevokeKey = () => {
    setApiSettings((current) => ({ ...current, apiKey: "" }));
    setShowKey(false);
    setCopied(false);
    setWebhookStatus(null);
    warning("Anahtar kapatıldı.");
  };

  const handleWebhookTest = async () => {
    const webhookUrl =
      apiSettings.webhookUrl.trim() ||
      (process.env.NODE_ENV !== "production" ? `${window.location.origin}/api/settings/webhook/echo` : "");
    if (!webhookUrl) {
      toastError("Webhook adresi girin.");
      return;
    }

    setTestingWebhook(true);
    setWebhookStatus(null);

    try {
      const response = await fetch("/api/settings/webhook/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          sampleEvent: {
            event: "webhook.test",
            source: "Hesap G",
            timestamp: new Date().toISOString(),
          },
        }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string; status?: number; message?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Webhook testi başarısız.");
      }

      setWebhookStatus(data.message || `İstek gönderildi. HTTP ${data.status ?? response.status}`);
      success("Webhook testi tamamlandı.", data.message || `HTTP ${data.status ?? response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook testi başarısız.";
      setWebhookStatus(message);
      toastError("Webhook testi başarısız.", message);
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="w-5 h-5 text-primary" /> Bağlantı anahtarı
        </h3>
        <p className="mb-4 text-xs text-muted">Bu anahtar erişim için kullanılır. Gizli tutun.</p>
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-container p-4">
          <code ref={apiKeyTextRef} className="flex-1 text-sm text-soft font-mono">
            {displayedApiKey}
          </code>
          <button
            type="button"
            onClick={() => setShowKey((current) => !current)}
            disabled={!fullApiKey}
            className="p-2 text-muted hover:text-foreground transition-colors duration-200 disabled:cursor-not-allowed disabled:text-muted/60"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopyKey}
            disabled={!fullApiKey}
            className="p-2 text-muted hover:text-primary transition-colors duration-200 disabled:cursor-not-allowed disabled:text-muted/60"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={handleGenerateKey} className="btn-ghost">
            Yeni anahtar oluştur
          </button>
          <button type="button" onClick={handleRevokeKey} className="btn-danger">
            Anahtarı kapat
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Webhook adresi</h3>
        <p className="mb-4 text-xs text-muted">Sipariş ve durum değişiklikleri bu adrese gönderilir. Yerel veya özel ağ hedefleri engellenir.</p>
        <div className="space-y-2">
          <label className="form-label">Adres</label>
          <input
            type="text"
            className="form-input"
            placeholder="https://site.com/bildirim"
            value={apiSettings.webhookUrl}
            onChange={(event) => setApiSettings((current) => ({ ...current, webhookUrl: event.target.value }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleWebhookTest} disabled={testingWebhook} className="btn-primary">
            {testingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Test et
          </button>
          <span className="rounded-md border border-border/80 bg-surface-container px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Geliştirme için yerel echo desteklenir
          </span>
        </div>
        {webhookStatus && <p className="mt-3 text-xs text-muted">{webhookStatus}</p>}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Kullanım</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-border bg-surface-container p-4">
            <p className="text-2xl font-semibold text-foreground">1,247</p>
            <p className="mt-1 text-[10px] text-muted">Bu ay</p>
          </div>
          <div className="rounded-md border border-border bg-surface-container p-4">
            <p className="text-2xl font-semibold text-foreground">10,000</p>
            <p className="mt-1 text-[10px] text-muted">Aylık sınır</p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-surface-container overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: "12.5%" }} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Nav Item ────────────────────────────────────────────────────────

function SettingsNavItem({ icon: Icon, label, active = false, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
   return (
      <button onClick={onClick} className={cn(
         "group flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-colors duration-200",
         active ? "border-primary/20 bg-primary/[0.06] text-foreground" : "border-transparent text-muted hover:border-border/80 hover:bg-surface-container hover:text-foreground"
      )}>
         <div className="flex items-center gap-3">
            <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted group-hover:text-foreground")} />
            <span className="text-sm font-medium">{label}</span>
         </div>
         <ChevronRight className={cn("h-4 w-4", active ? "text-primary/70" : "text-muted/60")} />
      </button>
   );
}
