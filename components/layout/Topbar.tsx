"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Link2,
  Search,
} from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { useDashboardStats } from "./DashboardStatsProvider";
import { useAuth } from "./AuthContext";
import { cn } from "@/lib/utils";
import { navigationItems } from "./navigation";

interface TopbarProps {
  onOpenMobileNavigation: () => void;
  onOpenCommandPalette: () => void;
}

type TopbarMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

const routeMeta: Array<{ match: (pathname: string) => boolean; meta: TopbarMeta }> = [
  {
    match: (pathname) => pathname === "/dashboard",
    meta: {
      eyebrow: "Başlangıç",
      title: "Kontrol Merkezi",
      description: "Önce veri kalitesi, sonra kârlılık ve stok uyarıları.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/veri-merkezi"),
    meta: {
      eyebrow: "Katalog",
      title: "Ürünler",
      description: "Ürün verileri, kanal eşleşmeleri ve operasyon ayarları.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/forecast"),
    meta: {
      eyebrow: "Tahmin",
      title: "Talep Tahmini",
      description: "Satış öngörüleri, senaryolar ve trend kırılımları.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/profit-pricing"),
    meta: {
      eyebrow: "Kârlılık",
      title: "Kârlılık",
      description: "Fiyat Optimizasyonu ve Net Maliyet, aynı karar alanında.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi/new"),
    meta: {
      eyebrow: "Reklam",
      title: "Yeni Analiz",
      description: "Yeni kampanya analizi başlat ve veri kaynağını seç.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi/") && pathname.endsWith("/chat"),
    meta: {
      eyebrow: "Reklam",
      title: "Analiz Sohbeti",
      description: "Rapor çıktıları üzerinden odaklı soru-cevap akışı.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi/") && pathname.endsWith("/report"),
    meta: {
      eyebrow: "Reklam",
      title: "Analiz Raporu",
      description: "Kampanya performansını rapor katmanında incele.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi"),
    meta: {
      eyebrow: "Reklam",
      title: "Reklam Analizi",
      description: "Kampanya performansı, maliyet ve içgörü üretimi.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/channel-seo") || pathname.startsWith("/seo"),
    meta: {
      eyebrow: "SEO",
      title: "SEO Merkezi",
      description: "Kanal bazlı içerik ve görünürlük optimizasyonu.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/integrations"),
    meta: {
      eyebrow: "Entegrasyon",
      title: "Bağlantılar",
      description: "Servis, kanal ve reklam platformu bağlantılarını yönet.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/ayarlar"),
    meta: {
      eyebrow: "Hesap",
      title: "Ayarlar",
      description: "Profil, tercih ve uygulama davranışlarını düzenle.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/products/") || pathname.startsWith("/urun/"),
    meta: {
      eyebrow: "Ürün",
      title: "Ürün Detayı",
      description: "Kanal, fiyat, maliyet ve içerik alanlarını birlikte gör.",
    },
  },
];

function getTopbarMeta(pathname: string): TopbarMeta {
  const explicitMatch = routeMeta.find((item) => item.match(pathname));
  if (explicitMatch) return explicitMatch.meta;

  const navMatch = navigationItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (navMatch) {
    return {
      eyebrow: "Kontrol Merkezi",
      title: navMatch.name,
      description: navMatch.description,
    };
  }

  return {
    eyebrow: "Kontrol Merkezi",
    title: "Panel",
    description: "Uygulama akışını tek kontrol yüzeyinden yönet.",
  };
}

export default function Topbar({ onOpenMobileNavigation, onOpenCommandPalette }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { stats } = useDashboardStats();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = getTopbarMeta(pathname);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-surface/70 px-4 shadow-sm backdrop-blur-md md:left-[var(--sidebar-width)] md:px-5">
      <div className="flex h-[76px] items-center justify-between gap-3">
        {/* Left Side Info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNavigation}
            aria-label="Mobil menüyü aç"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-surface-container/80 text-muted-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-surface-container hover:text-foreground md:hidden"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <Link
            href="/dashboard"
            aria-label="Ana sayfaya git"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-surface-container/80 px-3 py-2 transition-colors duration-200 hover:border-white/20 hover:bg-surface-container md:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">Hesap G</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">{meta.eyebrow}</p>
            </div>
          </Link>

          <div className="hidden min-w-0 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              {meta.eyebrow}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <h1 className="truncate text-base font-bold tracking-tight text-foreground">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs font-semibold text-muted-foreground/70 xl:block">
                {meta.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Stats & Actions */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Komut aramasını aç"
            className="hidden items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-muted-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-surface-container hover:text-foreground md:flex"
          >
            <Search className="h-4 w-4" />
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-bold text-foreground">ARA</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Sayfa, ürün, sipariş</p>
            </div>
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Ctrl+K
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Komut aramasını aç"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors duration-200 hover:border-primary/25 hover:bg-surface-container hover:text-foreground md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="hidden items-center xl:flex">
            {stats ? (
              <>
                <TopbarMetric label="Ciro" value={formatCurrency(stats.totalRevenue)} />
                <span className="mx-3 h-8 w-px bg-white/10" aria-hidden="true" />
                <TopbarMetric label="Sipariş" value={formatNumber(stats.totalOrders)} />
                <span className="mx-3 h-8 w-px bg-white/10" aria-hidden="true" />
                <TopbarMetric label="Marj" value={formatPercent(stats.avgMargin)} tone="primary" />
              </>
            ) : (
              <div className="h-8 w-64 animate-pulse rounded-md bg-white/5" />
            )}
          </div>

          <button
            type="button"
            aria-label="Bildirimler"
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground"
          >
            <Bell className="h-4.5 w-4.5" />
            {stats && stats.stockAlerts > 0 && (
              <span className="absolute -right-1 -top-1">
                <NotificationBadge count={stats.stockAlerts} />
              </span>
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="group flex items-center gap-3 rounded-md py-1.5 pl-0 pr-0 text-left transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-foreground">{user?.name || "Kullanıcı"}</p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">{user?.plan || "Premium plan"}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-200 group-hover:bg-primary/90">
                <User className="h-4 w-4" />
              </div>
              <ChevronDown className={cn("hidden h-3 w-3 text-muted-foreground transition-colors duration-200 sm:block", menuOpen && "rotate-180")} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-white/10 bg-surface-dim shadow-xl backdrop-blur-2xl">
                <div className="border-b border-white/10 p-4">
                  <p className="truncate text-xs font-bold text-foreground">{user?.name}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground/60">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); router.push("/integrations"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground active:scale-[0.98]"
                  >
                    <Link2 className="h-4 w-4" />
                    Bağlantılar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); router.push("/ayarlar"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground active:scale-[0.98]"
                  >
                    <Settings className="h-4 w-4" />
                    Ayarlar
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-danger transition-colors duration-200 hover:bg-danger/10 active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4" />
                    Oturumu Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function TopbarMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary";
}) {
  return (
    <div className="min-w-[88px]">
      <p className={cn("text-[9px] font-bold uppercase tracking-[0.16em]", tone === "primary" ? "text-primary/80" : "text-muted-foreground/50")}>
        {label}
      </p>
      <p className={cn("mt-1 whitespace-nowrap font-mono text-sm font-semibold tracking-tight", tone === "primary" ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
