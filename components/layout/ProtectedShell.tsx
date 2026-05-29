"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "./AuthContext";
import { navigationItems, navigationSections } from "./navigation";
import { ToastProvider } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ProtectedShellProps = {
  children: React.ReactNode;
};

type RouteMeta = {
  section: string;
  title: string;
  description: string;
};

const routeMeta: Array<{ match: (pathname: string) => boolean; meta: RouteMeta }> = [
  {
    match: (pathname) => pathname === "/dashboard",
    meta: {
      section: "Komuta",
      title: "Operasyon merkezi",
      description: "Kârlılık, veri kalitesi ve kanal önceliklerini aynı yüzeyde yönet.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/net-maliyet-motoru"),
    meta: {
      section: "Kârlılık",
      title: "Net maliyet motoru",
      description: "Ürün bazlı gerçek maliyet, marj ve kanal farkını saniyeler içinde oku.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/veri-merkezi"),
    meta: {
      section: "Katalog",
      title: "Veri merkezi",
      description: "Ürün, maliyet, kargo ve kanal ayarlarını tek veri omurgasında tut.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/profit-pricing"),
    meta: {
      section: "Karar",
      title: "Fiyat ve kârlılık",
      description: "Fiyat senaryoları ile net kârlılık etkisini yan yana değerlendir.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/forecast"),
    meta: {
      section: "Tahmin",
      title: "Talep görünümü",
      description: "Sipariş ivmesini, dönemsel sinyalleri ve sapma riskini takip et.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/reklam-analizi"),
    meta: {
      section: "Büyüme",
      title: "Reklam analizi",
      description: "Kampanya etkisini maliyet ve dönüşüm bağlamında oku.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/channel-seo") || pathname.startsWith("/seo"),
    meta: {
      section: "Büyüme",
      title: "SEO merkezi",
      description: "Kanal bazlı içerik kalitesini ve görünürlük aksiyonlarını izle.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/integrations"),
    meta: {
      section: "Bağlantı",
      title: "Entegrasyonlar",
      description: "Pazar yeri ve veri kaynaklarıyla bağlantı durumunu yönet.",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/ayarlar"),
    meta: {
      section: "Hesap",
      title: "Ayarlar",
      description: "Profil, erişim ve uygulama tercihlerinin merkez noktası.",
    },
  },
];

function getRouteMeta(pathname: string): RouteMeta {
  const explicit = routeMeta.find((item) => item.match(pathname));
  if (explicit) {
    return explicit.meta;
  }

  const activeNavItem = navigationItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  if (activeNavItem) {
    return {
      section: "Modül",
      title: activeNavItem.name,
      description: activeNavItem.description,
    };
  }

  return {
    section: "Hesap G",
    title: "Operasyon yüzeyi",
    description: "Tüm karar akışını tek çalışma yüzeyinden yönet.",
  };
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const meta = useMemo(() => getRouteMeta(pathname), [pathname]);

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
      <div className="app-shell-backdrop app-grid min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-900/6 bg-white/70 px-5 py-5 backdrop-blur-xl lg:flex">
          <Link
            href="/dashboard"
            className="app-surface-strong rounded-[28px] px-5 py-5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-foreground">Hesap G</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Commerce command
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-soft">
              Ürün, maliyet ve büyüme kararlarını tek operasyon omurgasında topla.
            </p>
          </Link>

          <nav className="mt-6 flex-1 space-y-5 overflow-y-auto pb-4">
            {navigationSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                  {section.title}
                </p>
                <div className="mt-3 space-y-1.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200",
                          active
                            ? "bg-slate-950 text-white shadow-[0_20px_45px_-28px_rgba(15,23,42,0.7)]"
                            : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            active
                              ? "border-white/10 bg-white/10"
                              : "border-slate-900/6 bg-white/80"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold tracking-tight">{item.name}</span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-xs",
                              active ? "text-white/70" : "text-muted-foreground"
                            )}
                          >
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="app-surface rounded-[28px] p-5">
            <div className="app-chip">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Hazır akış
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
              Önce ürünü sağlamlaştır, sonra kârı büyüt.
            </h2>
            <p className="mt-2 text-sm leading-6 text-soft">
              Veri merkezi ile ürün girişini tamamla, ardından net maliyet ekranında kanal farkını ölç.
            </p>
            <Link
              href="/net-maliyet-motoru"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              Ana karar ekranına git
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>

        <div className="lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-slate-900/6 bg-background/78 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen((current) => !current)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-900/8 bg-white/85 text-foreground lg:hidden"
                    aria-label="Menüyü aç"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {meta.section}
                    </p>
                    <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {meta.title}
                    </h1>
                  </div>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">
                  {meta.description}
                </p>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <Link href="/veri-merkezi" className="app-chip">
                  Veri merkezi
                </Link>
                <Link href="/profit-pricing" className="app-chip">
                  Kârlılık
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-[22px] border border-slate-900/8 bg-white/80 px-4 py-2 text-right shadow-[var(--shadow-card)] sm:block">
                  <p className="max-w-[180px] truncate text-sm font-semibold text-foreground">
                    {user?.name || "Kullanıcı"}
                  </p>
                  <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                    {user?.email || "Hesap bağlı"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-[18px] border border-slate-900/8 bg-white/80 px-4 py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-card)] transition-colors hover:border-danger/25 hover:bg-danger/5 hover:text-danger"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Çıkış</span>
                </button>
              </div>
            </div>

            {mobileNavOpen ? (
              <div className="border-t border-slate-900/6 px-4 py-4 lg:hidden">
                <div className="space-y-2">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-3",
                          active ? "bg-slate-950 text-white" : "bg-white/80 text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{item.name}</span>
                          <span className={cn("block text-xs", active ? "text-white/70" : "text-muted-foreground")}>
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
