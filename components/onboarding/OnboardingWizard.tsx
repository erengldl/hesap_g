"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  CloudDownload,
  Globe,
  LayoutDashboard,
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
const STEP_TRANSITION = { duration: 0.3, ease: "easeOut" } as const;

const MARKETPLACE_CARDS = [
  {
    name: "Trendyol",
    description: "Sipariş akışını otomatik senkronla",
    icon: ShoppingBag,
    className: "border-[#FF6A00]/20 bg-[#FF6A00]/10 text-[#FFB27A]",
  },
  {
    name: "Hepsiburada",
    description: "Ürün ve sipariş bağlantısını aç",
    icon: Store,
    className: "border-[#1D4ED8]/20 bg-[#1D4ED8]/10 text-[#93C5FD]",
  },
  {
    name: "Kendi Websitem",
    description: "Ödeme ve trafik verilerini bağla",
    icon: Globe,
    className: "border-success/20 bg-success/10 text-success",
  },
] as const;

const FEATURE_CARDS = [
  {
    title: "KPI Paneli",
    description: "Ciro, sipariş ve marj sinyallerini ilk bakışta gör.",
    icon: CheckCircle2,
  },
  {
    title: "Trend Grafigi",
    description: "Son günlerdeki satış ivmesini anında izle.",
    icon: TrendingUp,
  },
  {
    title: "Kanal Analizi",
    description: "Kanal ve ürün performansını aynı ekranda karşılaştır.",
    icon: BarChart3,
  },
] as const;

function readOnboardingCompleted() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeOnboardingCompleted() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // localStorage failures should not block the flow.
  }
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
    writeOnboardingCompleted();
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
    router.push("/dashboard");
  }, [markCompleted, router]);

  const handleSeeded = useCallback(async (result: SeedDemoResponse) => {
    setSeededDemo(true);
    toast.success("Demo verileri yüklendi", result.message);

    if (result.warning && !result.message.includes(result.warning)) {
      toast.warning("Demo modu aktif", result.warning);
    }

    goToStep(1);
  }, [goToStep, toast]);

  const handleSeedError = useCallback((message: string) => {
    toast.error("Demo verileri yüklenemedi", message);
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

    if (checkedUserIdRef.current === user.userId) {
      return;
    }

    checkedUserIdRef.current = user.userId;

    if (readOnboardingCompleted()) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setCurrentStep(0);
    setSeededDemo(false);
  }, [loading, user]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[220] flex items-stretch justify-center bg-panel/72 px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={STEP_TRANSITION}
        >
          <motion.div
            className="relative h-full w-full overflow-hidden rounded-none bg-panel/96 shadow-[var(--shadow-card)] sm:h-auto sm:max-w-lg sm:rounded-[28px] sm:border sm:border-border/80"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={STEP_TRANSITION}
          >
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(90,124,255,0.18),transparent_70%)]" />

            <div className="relative border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <EyebrowBadge className="gap-1.5 border-primary/20 bg-primary/10 text-primary">
                    3 adımlı hızlı başlangıç
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

            <div className="relative h-[calc(100%-89px)] overflow-y-auto px-5 py-5 sm:h-auto sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                {currentStep === 0 ? (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={STEP_TRANSITION}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-primary/20 bg-primary/10 text-primary shadow-[0_24px_80px_-48px_rgba(90,124,255,0.9)]">
                        <CloudDownload className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">Adım 1</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Hemen Basla
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Demo verilerle hemen başla veya kendi ürünlerini yükle.
                      </p>
                    </div>

                    <GlassCard className="border-primary/15 bg-primary/5 p-4 sm:p-5">
                      <p className="text-sm leading-7 text-muted/70">
                        En hızlı yol demo veriyi yüklemek. Bir tıkla ürünler, sentetik siparişler ve dashboard özetleri hazır olur.
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
                        Kendi Verilerimi Yükle
                        <Link2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}

                {currentStep === 1 ? (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={STEP_TRANSITION}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-info/20 bg-info/10 text-info shadow-[0_24px_80px_-48px_rgba(56,189,248,0.9)]">
                        <Store className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-info/70">Adım 2</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Mağazalarını Bağla
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Entegrasyon ile siparişlerin otomatik gelsin. Dilersen şimdilik atlayabilirsin.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {MARKETPLACE_CARDS.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-border/70 bg-surface-container/75 p-3.5"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl border", item.className)}>
                              <item.icon className="h-5 w-5" />
                            </div>
                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">
                              Yakında
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                          <p className="mt-2 text-xs leading-6 text-muted/60">{item.description}</p>
                        </div>
                      ))}
                    </div>

                    {seededDemo ? (
                      <GlassCard className="border-success/20 bg-success/10 p-4">
                        <p className="text-sm leading-7 text-success">
                          Demo veri hazır. Son adıma geçip dashboard üzerinden finansal akışı inceleyebilirsin.
                        </p>
                      </GlassCard>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-3.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-soft"
                    >
                      Şimdilik Atla
                    </button>
                  </motion.div>
                ) : null}

                {currentStep === 2 ? (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={STEP_TRANSITION}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-success/20 bg-success/10 text-success shadow-[0_24px_80px_-48px_rgba(16,185,129,0.9)]">
                        <LayoutDashboard className="h-9 w-9" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success/70">Adım 3</p>
                      <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.06em] text-foreground">
                        Kontrol Sende
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                        Finansal kontrol merkezin hazır!
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
                      Özete Git
                      <LayoutDashboard className="h-4 w-4" />
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
