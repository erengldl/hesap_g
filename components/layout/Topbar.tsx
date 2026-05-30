"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Link2,
  LineChart,
  LogOut,
  Menu,
  Settings,
  User,
} from "lucide-react";

import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { useAuth } from "./AuthContext";
import { useDashboardStats } from "./DashboardStatsProvider";
import { navigationItems } from "./navigation";

interface TopbarProps {
  onOpenMobileNavigation: () => void;
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
      eyebrow: "Karar Özeti",
      title: "Başlangıç",
      description: "Günlük aksiyonlar, marj sinyalleri ve operasyonel riskleri önce görün.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/veri-merkezi"),
    meta: {
      eyebrow: "Hazırlık",
      title: "Veri Merkezi",
      description: "Ürün, katalog ve sipariş verisini kararlara hazır hale getirin.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/forecast"),
    meta: {
      eyebrow: "Analiz",
      title: "Tahmin",
      description: "Talep, trend ve senaryo akışını daha temiz bir tahmin yüzeyinde izleyin.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/profit-pricing"),
    meta: {
      eyebrow: "Analiz",
      title: "Kârlılık",
      description: "Maliyet, fiyat ve kanal kararları aynı akış üzerinden ilerler.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi"),
    meta: {
      eyebrow: "Büyüt",
      title: "Reklam",
      description: "Zarar, izleme ve ölçeklenme sinyallerini daha hızlı ayıklayın.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/channel-seo") || pathname.startsWith("/seo"),
    meta: {
      eyebrow: "Büyüt",
      title: "SEO",
      description: "Kanal bazlı içerik ve görünürlük sinyallerini tek yerde toplayın.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/integrations"),
    meta: {
      eyebrow: "Yönet",
      title: "Bağlantılar",
      description: "Pazar yerleri, servisler ve entegrasyon bağlantılarını yönetin.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/ayarlar"),
    meta: {
      eyebrow: "Yönet",
      title: "Ayarlar",
      description: "Tema, hesap ve uygulama davranışını merkezi olarak düzenleyin.",
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
    description: "Uygulama akışlarını tek bir kontrol yüzeyinden yönetin.",
  };
}

function getMarginTone(avgMargin: number) {
  if (avgMargin >= 35) return "profit";
  if (avgMargin < 18) return "loss";
  if (avgMargin < 26) return "warning";
  return "neutral";
}

function getAlertTone(count: number) {
  if (count <= 0) return "profit";
  if (count >= 3) return "loss";
  return "warning";
}

export default function Topbar({ onOpenMobileNavigation }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { stats } = useDashboardStats();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = getTopbarMeta(pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (!menuOpen) return;

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-border/80 bg-panel/94 px-4 shadow-[var(--shadow-soft)] backdrop-blur-2xl md:left-[var(--sidebar-width)] md:px-6">
      <div className="flex h-[64px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNavigation}
            aria-label="Mobil menüyü aç"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface-container/80 text-muted transition-colors duration-200 hover:border-primary/25 hover:bg-surface-container hover:text-foreground md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link
            href="/dashboard"
            aria-label="Kontrol merkezine git"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border/80 bg-surface-container/80 px-3 py-2 transition-colors duration-200 hover:border-border-strong hover:bg-surface-container md:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
              <LineChart className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">Hesap G</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{meta.eyebrow}</p>
            </div>
          </Link>

          <div className="hidden min-w-0 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{meta.eyebrow}</p>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <h1 className="truncate text-[1rem] font-semibold tracking-[-0.03em] text-foreground xl:text-[1.05rem]">
                {meta.title}
              </h1>
              <p className="hidden truncate text-sm text-muted xl:block">{meta.description}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="hidden items-center gap-2 xl:flex">
            {stats ? (
              <>
                <TopbarMetric label="Ciro" value={formatCurrency(stats.totalRevenue)} tone="neutral" />
                <TopbarMetric label="Marj" value={formatPercent(stats.avgMargin)} tone={getMarginTone(stats.avgMargin)} />
                <TopbarMetric label="Stok Riski" value={formatNumber(stats.stockAlerts)} tone={getAlertTone(stats.stockAlerts)} />
              </>
            ) : (
              <div className="h-9 w-72 animate-pulse rounded-lg bg-surface-container/55" />
            )}
          </div>

          <button
            type="button"
            aria-label="Bildirimler"
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-container/55 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {stats && stats.stockAlerts > 0 ? (
              <span className="absolute -right-1 -top-1">
                <NotificationBadge count={stats.stockAlerts} />
              </span>
            ) : null}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="group flex items-center gap-3 rounded-md py-1 text-left transition-colors duration-200 hover:text-foreground"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-foreground">{user?.name || "Kullanıcı"}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{user?.plan || "Premium plan"}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-[filter] duration-200 group-hover:brightness-110">
                <User className="h-4 w-4" />
              </div>
              <ChevronDown className={cn("hidden h-3 w-3 text-muted transition-[color,transform] duration-200 sm:block", menuOpen && "rotate-180")} />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-border/80 bg-panel/98 shadow-[var(--shadow-card)] backdrop-blur-2xl">
                <div className="border-b border-border/80 p-4">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                  <p className="mt-1 truncate text-[11px] text-muted">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); router.push("/integrations"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
                  >
                    <Link2 className="h-4 w-4" />
                    Bağlantılar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); router.push("/ayarlar"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Ayarlar
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger transition-colors duration-200 hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Oturumu Kapat
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function TopbarMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "profit" | "loss" | "warning";
}) {
  return (
    <div className={cn(
      "min-w-[104px] rounded-lg border px-3 py-2",
      tone === "profit"
        ? "border-profit/15 bg-profit/[0.05]"
        : tone === "loss"
          ? "border-loss/15 bg-loss/[0.05]"
          : tone === "warning"
            ? "border-warning/15 bg-warning/[0.05]"
            : "border-border/80 bg-surface-soft/70"
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 whitespace-nowrap text-sm font-semibold tracking-[-0.02em] text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
