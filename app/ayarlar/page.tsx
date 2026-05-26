"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EyebrowBadge, GlassCard, PageHeader } from "@/components/ui-custom/GlassComponents";
import { useAuth } from "@/components/layout/AuthContext";
import { ThemeModeSelector } from "@/components/theme/ThemeModeSelector";
import type { AuthUser } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  SunMoon,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "profile" | "security" | "notifications" | "locale" | "appearance" | "billing" | "api";

type SelectOption = {
  value: string;
  label: string;
};

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
        description="Hesap bilgilerini, güvenlik ayarlarını ve bu sürümde aktif olan tercihleri tek akışta yönet."
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
              <SettingsNavItem icon={Globe} label="Dil ve Bölge" active={activeTab === "locale"} onClick={() => setActiveTab("locale")} />
              <SettingsNavItem icon={SunMoon} label="Görünüm" active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")} />
              <SettingsNavItem icon={CreditCard} label="Abonelik" active={activeTab === "billing"} onClick={() => setActiveTab("billing")} />
              <SettingsNavItem icon={ShieldCheck} label="API ve Webhook" active={activeTab === "api"} onClick={() => setActiveTab("api")} />
            </div>

            <div className="pt-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 font-medium text-danger transition-colors duration-200 hover:bg-danger/5"
              >
                <LogOut className="h-5 w-5" />
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
      toastError("Ad soyad alanı zorunludur.");
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
        toastError(data.error || "Profil kaydedilemedi.");
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
            <p className="text-sm font-semibold text-foreground">{user?.plan || "Plan bilgisi henüz tanımlanmadı"}</p>
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
            <input type="email" value={user?.email || ""} disabled className="form-input cursor-not-allowed opacity-60" />
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function SecurityTab() {
  const { success, error: toastError } = useToast();
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
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 hover:text-foreground"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

        <div className="rounded-lg border border-dashed border-border/80 bg-surface-container/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-foreground">İki adımlı doğrulama</h4>
              <p className="mt-2 text-xs leading-5 text-muted">
                Gerçek doğrulama akışı henüz aktif değil. Kullanıma açıldığında bu bölümden yönetilecek.
              </p>
            </div>
            <EyebrowBadge variant="default">Yakında</EyebrowBadge>
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <button onClick={handleChangePassword} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Şifreyi Güncelle
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function NotificationsTab() {
  const items = [
    { key: "stockAlerts", label: "Stok uyarıları", desc: "Kritik stok eşiği bildirimleri" },
    { key: "priceSuggestions", label: "Fiyat önerileri", desc: "Yeni öneri ve optimizasyon güncellemeleri" },
    { key: "adPerformance", label: "Reklam performansı", desc: "Günlük kanal ve kampanya özetleri" },
    { key: "weeklyReport", label: "Haftalık rapor", desc: "Pazartesi özet raporu teslimatı" },
    { key: "systemUpdates", label: "Ürün güncellemeleri", desc: "Yeni özellik ve bakım bildirimleri" },
  ];

  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Bildirimler</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
            Canlı e-posta, push ve operasyon bildirimleri henüz hesap düzeyinde bağlı değil. Bu nedenle ayarlar pasif durumda
            gösterilir ve herhangi bir tercih kaydedilmez.
          </p>
        </div>
        <EyebrowBadge variant="default">Yakında</EyebrowBadge>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-md border border-border bg-surface-container px-4 py-3 opacity-70">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted">{item.desc}</p>
            </div>
            <button
              type="button"
              disabled
              aria-label={`${item.label} yakında aktif olacak`}
              className="relative h-6 w-11 cursor-not-allowed rounded-full bg-border/90"
            >
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-background/90" />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function LocaleTab() {
  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Dil ve Bölge</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
              Dil, para birimi ve tarih biçimi tercihleri hesap düzeyinde henüz kaydedilmiyor. Tema dışındaki bu tercihler şu
              an için pasif durumda tutulur.
            </p>
          </div>
          <EyebrowBadge variant="default">Yakında</EyebrowBadge>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DisabledSelectCard
          title="Dil"
          description="Hesap bazlı dil seçimi yayınlandığında burada yönetilecek."
          ariaLabel="Dil seçimi yakında aktif olacak"
          options={[
            { value: "tr", label: "Türkçe (TR)" },
            { value: "en", label: "English (US)" },
          ]}
        />
        <DisabledSelectCard
          title="Para birimi"
          description="Varsayılan para birimi tercihi henüz bağlı değil."
          ariaLabel="Para birimi seçimi yakında aktif olacak"
          options={[
            { value: "try", label: "TL (₺)" },
            { value: "usd", label: "US Dollar ($)" },
            { value: "eur", label: "Euro (€)" },
          ]}
        />
        <DisabledSelectCard
          title="Tarih biçimi"
          description="Rapor görünümü için tarih tercihi yakında açılacak."
          ariaLabel="Tarih biçimi seçimi yakında aktif olacak"
          options={[
            { value: "tr", label: "GG.AA.YYYY (TR)" },
            { value: "iso", label: "YYYY-MM-DD (ISO)" },
            { value: "us", label: "MM/DD/YYYY (US)" },
          ]}
        />
      </div>
    </div>
  );
}

function AppearanceTab() {
  return (
    <GlassCard>
      <h3 className="mb-2 text-lg font-semibold text-foreground">Görünüm</h3>
      <p className="mb-5 text-sm leading-6 text-muted/70">
        Tema tercihi sadece bu tarayıcıda saklanır. Hesabına senkronize edilmez, ancak sayfa yenilense bile aynı cihazda korunur.
      </p>
      <ThemeModeSelector />
    </GlassCard>
  );
}

function BillingTab() {
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Abonelik ve Faturalandırma</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
            Bu alan canlı faturalandırma verisi göstermez. Gerçek plan, ödeme yöntemi ve fatura geçmişi bağlantısı hazır
            olduğunda bu bölüm aktif hale getirilecek.
          </p>
        </div>
        <EyebrowBadge variant="primary">Yakında</EyebrowBadge>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-border/80 bg-surface-container/70 p-5">
        <p className="text-sm font-semibold text-foreground">Canlı faturalandırma akışı bu sürümde kapalıdır.</p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Kullanıcı güveni için statik fatura satırları ve ödeme geçmişi kaldırıldı. Gerçek veri kaynağı bağlandığında plan
          değişikliği, ödeme yöntemi ve fatura geçmişi burada gösterilecek.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {["Plan değişikliği", "Ödeme yöntemi", "Fatura geçmişi"].map((item) => (
          <div key={item} className="rounded-md border border-border bg-surface-container p-4">
            <p className="text-sm font-semibold text-foreground">{item}</p>
            <p className="mt-2 text-xs leading-5 text-muted">Canlı faturalandırma hazır olduğunda bu bölüm açılacak.</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function ApiTab() {
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Key className="h-5 w-5 text-primary" />
              API ve erişim yönetimi
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
              API anahtarı yönetimi yakında aktif olacak. Gerçek backend bağlantısı hazır olana kadar bu ekranda anahtar
              oluşturma, görüntüleme veya kopyalama yapılmaz.
            </p>
          </div>
          <EyebrowBadge variant="primary">Yakında</EyebrowBadge>
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-border/80 bg-surface-container/70 p-5">
          <p className="text-sm font-semibold text-foreground">Gerçek credential gösterilmez</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Güvenlik nedeniyle sahte secret, test anahtarı veya canlı credential izlenimi veren örnek değerler göstermiyoruz.
          </p>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold text-foreground">Webhook yapılandırması</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
          Webhook teslimatı ve bağlantı testi bu sürümde kapalıdır. Alanlar yalnızca planlanan kapsamı açıklamak için pasif
          durumda gösterilir.
        </p>

        <div className="mt-4 space-y-2">
          <label className="form-label">Adres</label>
          <input
            type="text"
            disabled
            className="form-input cursor-not-allowed opacity-60"
            placeholder="Canlı webhook yapılandırması yakında açılacak"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled className="btn-primary cursor-not-allowed opacity-60">
            Yakında aktif olacak
          </button>
          <EyebrowBadge variant="default">Backend bağlantısı kapalı</EyebrowBadge>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold text-foreground">Kullanım verileri</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/70">
          Canlı limit, kota ve çağrı sayıları henüz yayınlanmıyor. Gerçek ölçümler etkinleştiğinde burada gösterilecek.
        </p>
      </GlassCard>
    </div>
  );
}

function DisabledSelectCard({
  title,
  description,
  options,
  ariaLabel,
}: {
  title: string;
  description: string;
  options: SelectOption[];
  ariaLabel: string;
}) {
  return (
    <GlassCard>
      <h4 className="mb-2 font-semibold text-foreground">{title}</h4>
      <p className="mb-4 text-xs leading-5 text-muted">{description}</p>
      <select disabled defaultValue={options[0]?.value} aria-label={ariaLabel} className="form-select cursor-not-allowed opacity-60">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </GlassCard>
  );
}

function SettingsNavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-colors duration-200",
        active
          ? "border-primary/20 bg-primary/[0.06] text-foreground"
          : "border-transparent text-muted hover:border-border/80 hover:bg-surface-container hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted group-hover:text-foreground")} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ChevronRight className={cn("h-4 w-4", active ? "text-primary/70" : "text-muted/60")} />
    </button>
  );
}
