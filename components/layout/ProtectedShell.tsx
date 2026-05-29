"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Box,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext";
import { navigationItems } from "./navigation";
import { ToastProvider } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ProtectedShellProps = {
  children: React.ReactNode;
};

type RouteMeta = {
  title: string;
  description: string;
};

type AppStatsPayload = {
  success?: boolean;
  counts?: {
    products?: number;
  };
  dashboard_summary?: {
    total_revenue?: number;
    total_orders?: number;
    avg_margin?: number;
    stock_alert_count?: number;
  };
};

const routeMeta: Array<{ match: (pathname: string) => boolean; meta: RouteMeta }> = [
  { match: (pathname) => pathname === "/dashboard", meta: { title: "Anasayfa", description: "Günün ana kârlılık ve veri görünümü." } },
  { match: (pathname) => pathname.startsWith("/veri-merkezi"), meta: { title: "Ürünler", description: "Ürün, satış ve ayar kayıtlarını tek merkezde yönet." } },
  { match: (pathname) => pathname.startsWith("/forecast"), meta: { title: "Tahmin", description: "Talep, sipariş ve sapma görünümünü takip et." } },
  { match: (pathname) => pathname.startsWith("/profit-pricing") || pathname.startsWith("/net-maliyet-motoru"), meta: { title: "Karlılık", description: "Kanal bazlı net kâr ve maliyet farklarını oku." } },
  { match: (pathname) => pathname.startsWith("/reklam-analizi"), meta: { title: "Reklam", description: "Kampanya çıktıları ve karar önerileri." } },
  { match: (pathname) => pathname.startsWith("/channel-seo") || pathname.startsWith("/seo"), meta: { title: "SEO", description: "Kanal bazlı içerik ve görünürlük optimizasyonu." } },
  { match: (pathname) => pathname.startsWith("/integrations"), meta: { title: "Entegrasyonlar", description: "Pazar yeri ve servis bağlantıları." } },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRouteMeta(pathname: string) {
  return routeMeta.find((item) => item.match(pathname))?.meta ?? {
    title: "Hesap G",
    description: "Operasyon paneli",
  };
}

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export default function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState<AppStatsPayload | null>(null);
  const meta = useMemo(() => getRouteMeta(pathname), [pathname]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/app-stats", { cache: "no-store" });
        const data = await response.json();
        if (response.ok) {
          setStats(data);
        }
      } catch {
        setStats(null);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="app-shell-backdrop min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="app-surface-strong w-full max-w-xl rounded-[28px] p-8">
            <div className="h-4 w-24 animate-pulse rounded-full bg-surface-muted" />
            <div className="mt-4 h-10 w-64 animate-pulse rounded-full bg-surface-muted" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-surface-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="app-shell-backdrop min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 px-3 py-3 sm:px-4">
          <aside className="hidden w-[238px] shrink-0 rounded-[26px] border border-slate-900/8 bg-white/95 p-4 shadow-[var(--shadow-panel)] lg:flex lg:flex-col">
            <Link href="/dashboard" className="flex items-center gap-3 px-2 py-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <span className="text-xl font-bold">G</span>
              </div>
              <div>
                <p className="text-[1.05rem] font-semibold tracking-tight text-foreground">Hesap G</p>
              </div>
            </Link>

            <nav className="mt-6 space-y-1.5">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-[#edf7f5] text-[#0b6f68]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-foreground">Veri senkronizasyonu</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                Tüm sistemler güncel. Son güncelleme: birkaç dakika önce.
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1 rounded-[30px] border border-slate-900/8 bg-white/96 shadow-[var(--shadow-panel)]">
            <header className="border-b border-slate-900/6 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen((current) => !current)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                    aria-label="Menüyü aç"
                  >
                    <Menu className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <h1 className="truncate text-[1.8rem] font-semibold tracking-[-0.04em] text-slate-900">
                      {meta.title}
                    </h1>
                  </div>
                </div>

                <div className="order-3 flex w-full items-center gap-3 lg:order-none lg:w-auto lg:flex-1">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="truncate text-sm text-slate-400">Ürün, SKU, ASIN veya komut ara...</span>
                    <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-400">⌘ K</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <HeaderStat title="Toplam Net Kâr" value={formatCurrency(stats?.dashboard_summary?.total_revenue)} />
                  <HeaderStat title="Ortalama Marj" value={`%${(stats?.dashboard_summary?.avg_margin ?? 0).toFixed(1)}`} />
                  <HeaderStat title="Aktif Ürün" value={`${stats?.counts?.products ?? 0}`} icon={Box} compact />
                  <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                  </button>
                  <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {user?.name?.slice(0, 2).toUpperCase() || "HG"}
                    </div>
                    <div className="max-w-[140px]">
                      <p className="truncate text-sm font-semibold text-slate-900">{user?.name || "Hesap G"}</p>
                      <p className="truncate text-[11px] text-slate-500">{user?.email || "Yönetici"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:text-danger"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {mobileNavOpen ? (
                <div className="mt-4 space-y-2 lg:hidden">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium",
                          active ? "bg-[#edf7f5] text-[#0b6f68]" : "bg-slate-50 text-slate-700"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </header>

            <main className="px-4 py-5 sm:px-6">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}

function HeaderStat({
  title,
  value,
  icon: Icon,
  compact = false,
}: {
  title: string;
  value: string;
  icon?: typeof Box;
  compact?: boolean;
}) {
  return (
    <div className={cn("hidden rounded-2xl border border-slate-200 bg-white px-3 py-2.5 lg:block", compact ? "min-w-[110px]" : "min-w-[120px]")}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
        <p className="text-[11px] text-slate-400">{title}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
