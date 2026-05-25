"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  CloudDownload,
  Globe,
  Link2,
  ShoppingBag,
  Store,
  TrendingUp,
  X,
} from "lucide-react";

import { SeedDemoButton } from "@/components/demo/SeedDemoButton";
import { useAuth } from "@/components/layout/AuthContext";
import { EyebrowBadge, GlassCard } from "@/components/ui-custom/GlassComponents";
import type { SeedDemoResponse } from "@/lib/seed-demo-contract";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ONBOARDING_STORAGE_KEY = "hg_onboarding_completed";

const MARKETPLACE_CARDS = [
  {
    name: "Trendyol",
    description: "Siparis akisini otomatik senkronla",
    icon: ShoppingBag,
    className: "border-[#FF6A00]/20 bg-[#FF6A00]/10 text-[#FFB27A]",
  },
  {
    name: "Hepsiburada",
    description: "Urun ve siparis baglantisini ac",
    icon: Store,
    className: "border-[#1D4ED8]/20 bg-[#1D4ED8]/10 text-[#93C5FD]",
  },
  {
    name: "Kendi Websitem",
    description: "Odeme ve trafik verilerini bagla",
    icon: Globe,
    className: "border-success/20 bg-success/10 text-success",
  },
] as const;

const FEATURE_CARDS = [
  {
    title: "KPI kartlari",
    description: "Ciro, siparis ve marj sinyallerini ilk bakista gor.",
    icon: CheckCircle2,
  },
  {
    title: "Trend grafigi",
    description: "Son gunlerdeki satis ivmesini aninda izle.",
    icon: TrendingUp,
  },
  {
    title: "Karsilastirma",
    description: "Kanal ve urun performansini ayni ekranda karsilastir.",
    icon: BarChart3,
  },
] as const;

type DashboardGateResponse = {
  success?: boolean;
  aggregate?: {
    totalRevenue?: number;
    totalOrders?: number;
    totalProducts?: number;
    topProducts?: unknown[];
    channelBreakdown?: unknown[];
    salesTrend?: unknown[];
  };
};

function isDashboardEmpty(payload: DashboardGateResponse | null) {
  const aggregate = payload?.aggregate;
  if (!aggregate) return true;

  const totalRevenue = Number(aggregate.totalRevenue ?? 0);
  const totalOrders = Number(aggregate.totalOrders ?? 0);
  const totalProducts = Number(aggregate.totalProducts ?? 0);
  const topProducts = Array.isArray(aggregate.topProducts) ? aggregate.topProducts.length : 0;
  const trendPoints = Array.isArray(aggregate.salesTrend) ? aggregate.salesTrend.length : 0;
  const channels = Array.isArray(aggregate.channelBreakdown) ? aggregate.channelBreakdown.length : 0;

  return totalRevenue <= 0 && totalOrders <= 0 && totalProducts <= 0 && topProducts === 0 && trendPoints === 0 && channels === 0;
}

function isPremiumPlan(plan?: string | null) {
  return /premium|pro/i.test(String(plan ?? ""));
}

function StepDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-all duration-200",
        active ? "bg-primary shadow-[0_0_0_4px_rgba(90,124,255,0.16)]" : "bg-border"
      )}
    />
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [seededDemo, setSeededDemo] = useState(false);
  const [, startTransition] = useTransition();
  const checkedUserIdRef = useRef<number | null>(null);

  const markCompleted = useCallback(() => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  }, []);

  const closeWizard = useCallback(() => {
    markCompleted();
    setOpen(false);
  }, [markCompleted]);

  const goToStep = useCallback((nextStep: number) => {
    startTransition(() => {
      setCurrentStep(nextStep);
    });
  }, []);

  const handleRouteAndClose = useCallback((href: string) => {
    markCompleted();
    setOpen(false);
    router.push(href);
  }, [markCompleted, router]);

  const handleFinish = useCallback(() => {
    markCompleted();
    setOpen(false);
    window.location.assign("/dashboard");
  }, [markCompleted]);

  const handleSeeded = useCallback(async (result: SeedDemoResponse) => {
    setSeededDemo(true);
    toast.success("Demo verileri yuklendi", result.message);
    if (result.warning) {
      toast.warning("Demo modu aktif", result.warning);
    }
    goToStep(1);
  }, [goToStep, toast]);

  const handleSeedError = useCallback((message: string) => {
    toast.error("Demo verileri yuklenemedi", message);
  }, [toast]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      checkedUserIdRef.current = null;
      setOpen(false);
      setCurrentStep(0);
      setSeededDemo(false);
      return;
    }

    if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true") {
      checkedUserIdRef.current = user.userId;
      return;
    }

    if (checkedUserIdRef.current === user.userId) {
      return;
    }

    checkedUserIdRef.current = user.userId;

    if (!isPremiumPlan(user.plan)) {
      setOpen(true);
      setCurrentStep(0);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as DashboardGateResponse | null;

        if (!cancelled && response.ok && isDashboardEmpty(data)) {
          setOpen(true);
          setCurrentStep(0);
        }
      } catch {
        // Silent by design: onboarding should never block the shell.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-panel/72 px-4 py-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-border/80 bg-panel/96 shadow-[var(--shadow-card)]"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(90,124,255,0.18),transparent_70%)]" />

            <div className="relative border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <EyebrowBadge className="gap-1.5 border-primary/20 bg-primary/10 text-primary">
                    3 adimli hizli baslangic
                  </EyebrowBadge>
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((step) => (
                      <StepDot key={step} active={step === currentStep} />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeWizard}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container/80 px-3 py-2 text-sm font-semibold text-muted transition-colors duration-200 hover:text-foreground"
                  aria-label="Onboarding sihirbazini kapat"
                >
                  <X className="h-4 w-4" />
                  Kapat
                </button>
              </div>
            </div>

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                {currentStep === 0 ? (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-primary/20 bg-primary/10 text-primary shadow-[0_24px_80px_-48px_rgba(90,124,255,0.9)]">
                        <CloudDownload className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">Adim 1</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Verilerini Yukle
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Demo verilerle hemen basla veya kendi urunlerini yukle. Juri uygulamayi actigi anda akisi buradan baslatabilir.
                      </p>
                    </div>

                    <GlassCard className="border-primary/15 bg-primary/5 p-4 sm:p-5">
                      <p className="text-sm leading-7 text-muted/70">
                        En hizli yol demo veriyi yuklemek. Bir tikla urunler, sentetik siparisler ve dashboard ozetleri hazir olur.
                      </p>
                    </GlassCard>

                    <div className="space-y-3">
                      <SeedDemoButton
                        className="w-full justify-center py-3.5 text-base"
                        onSeeded={handleSeeded}
                        onError={handleSeedError}
                      />
                      <button
                        type="button"
                        onClick={() => handleRouteAndClose("/veri-merkezi")}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-3.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
                      >
                        Kendi Verilerimi Yukle
                        <Link2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}

                {currentStep === 1 ? (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-info/20 bg-info/10 text-info shadow-[0_24px_80px_-48px_rgba(56,189,248,0.9)]">
                        <Store className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-info/70">Adim 2</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Magazani Bagla
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Entegrasyon ile siparislerin otomatik gelsin. Bu adim opsiyonel, ister simdilik atlayip sonra geri donebilirsin.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {MARKETPLACE_CARDS.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-border/70 bg-surface-container/75 p-3.5"
                        >
                          <div className={cn("mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border", item.className)}>
                            <item.icon className="h-5 w-5" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                          <p className="mt-2 text-xs leading-6 text-muted/60">{item.description}</p>
                        </div>
                      ))}
                    </div>

                    {seededDemo ? (
                      <GlassCard className="border-success/20 bg-success/10 p-4">
                        <p className="text-sm leading-7 text-success">
                          Demo veri hazir. Istersen entegrasyon ekle, istemezsen son adima gecip dashboard'u gorebilirsin.
                        </p>
                      </GlassCard>
                    ) : null}

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => handleRouteAndClose("/integrations")}
                        className="btn-primary w-full justify-center py-3.5 text-base"
                      >
                        Entegrasyonlari Ac
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-3.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
                      >
                        Simdilik Atla
                      </button>
                    </div>
                  </motion.div>
                ) : null}

                {currentStep === 2 ? (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-success/20 bg-success/10 text-success shadow-[0_24px_80px_-48px_rgba(16,185,129,0.9)]">
                        <BarChart3 className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success/70">Adim 3</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Dashboard'unu Kesfet
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Iste finansal kontrol merkezin. KPI kartlari, trend grafigi ve urun karsilastirmalari ayni panelde seni bekliyor.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {FEATURE_CARDS.map((feature) => (
                        <GlassCard key={feature.title} className="border-border/70 bg-surface-container/80 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-primary">
                              <feature.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                              <p className="mt-1 text-xs leading-6 text-muted/60">{feature.description}</p>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleFinish}
                      className="btn-primary w-full justify-center py-3.5 text-base"
                    >
                      Dashboard'a Git
                      <BarChart3 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="border-t border-border/70 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted/60">
                  Adim {currentStep + 1} / 3
                </div>
                {currentStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => goToStep(currentStep - 1)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
                  >
                    Geri
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 text-[11px] font-medium text-muted/60">
                    30 saniyede hizli kurulum
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
