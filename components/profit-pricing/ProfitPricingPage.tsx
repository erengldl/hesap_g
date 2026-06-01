"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Check, CircleAlert, LineChart } from "lucide-react";

import { GlassCard, PageHeader } from "@/components/ui-custom/GlassComponents";
import { calculateProfitPricing } from "@/lib/profit-pricing/orchestrator";
import {
  buildOptimizationSuggestions,
  type OptimizationStrategyKey,
} from "@/lib/profit-pricing/strategy-engine";
import type {
  EditableProfitPricingField,
  ProfitPricingBootstrap,
  ProfitPricingChannelProfile,
  ProfitPricingInput,
  ProfitPricingResult,
  SalesChannel,
} from "@/lib/profit-pricing/types";

import OptimizationRecommendationTable from "./OptimizationRecommendationTable";
import PriceProfitCurve from "./PriceProfitCurve";
import ProfitPricingControlPanel from "./ProfitPricingControlPanel";
import ProfitPricingEmptyState from "./ProfitPricingEmptyState";
import ProfitPricingErrorState from "./ProfitPricingErrorState";
import ProfitPricingLoadingState from "./ProfitPricingLoadingState";

type SyncState = "idle" | "saving" | "saved" | "error";

type Feedback = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

const WORKFLOW_STEPS = [
  "Ürünü Seç",
  "Kanal Fiyatlarını Kontrol Et",
  "Optimize Et",
  "Öneriyi Kaydet",
] as const;

type ProfitPricingState = {
  channelProfiles: ProfitPricingChannelProfile[];
  selectedChannel: SalesChannel;
  optimizationReady: boolean;
  activeStrategy: OptimizationStrategyKey | null;
};

type ProfitPricingAction =
  | {
      type: "load-product";
      channelProfiles: ProfitPricingChannelProfile[];
      selectedChannel: SalesChannel;
    }
  | {
      type: "select-channel";
      channel: SalesChannel;
    }
  | {
      type: "patch-field";
      channel: SalesChannel;
      field: EditableProfitPricingField;
      value: number | undefined;
    }
  | {
      type: "apply-profiles";
      channelProfiles: ProfitPricingChannelProfile[];
      activeStrategy: OptimizationStrategyKey | null;
    }
  | {
      type: "set-optimization-ready";
      value: boolean;
    };

function createChannelSignature(channelProfiles: ProfitPricingChannelProfile[]) {
  return JSON.stringify(
    channelProfiles.map((profile) => ({
      channel: profile.channel,
      salePrice: profile.input.salePrice,
      buyboxPrice: profile.input.buyboxPrice ?? null,
    }))
  );
}

function createInitialState(bootstrap: ProfitPricingBootstrap): ProfitPricingState {
  return {
    channelProfiles: bootstrap.channelProfiles,
    selectedChannel: bootstrap.initialInput.channel,
    optimizationReady: false,
    activeStrategy: null,
  };
}

function reducer(state: ProfitPricingState, action: ProfitPricingAction): ProfitPricingState {
  switch (action.type) {
    case "load-product":
      return {
        channelProfiles: action.channelProfiles,
        selectedChannel: action.selectedChannel,
        optimizationReady: false,
        activeStrategy: null,
      };
    case "select-channel":
      return {
        ...state,
        selectedChannel: action.channel,
      };
    case "patch-field":
      return {
        ...state,
        activeStrategy: null,
        channelProfiles: state.channelProfiles.map((profile) => {
          if (profile.channel !== action.channel) {
            return profile;
          }

          const nextInput = {
            ...profile.input,
            [action.field]: action.value,
            dataSource: profile.input.dataSource === "product" ? "mixed" : profile.input.dataSource,
          } as ProfitPricingInput;

          if (action.field === "salePrice" && action.value !== undefined) {
            nextInput.basePrice = action.value;
          }

          return {
            ...profile,
            input: nextInput,
          };
        }),
      };
    case "apply-profiles":
      return {
        ...state,
        channelProfiles: action.channelProfiles,
        optimizationReady: true,
        activeStrategy: action.activeStrategy,
      };
    case "set-optimization-ready":
      return {
        ...state,
        optimizationReady: action.value,
      };
    default:
      return state;
  }
}

function buildResultsByChannel(channelProfiles: ProfitPricingChannelProfile[]) {
  return channelProfiles.reduce((accumulator, profile) => {
    accumulator[profile.channel] = calculateProfitPricing(profile.input);
    return accumulator;
  }, {} as Partial<Record<SalesChannel, ProfitPricingResult>>);
}

function toChannelPayload(channelProfiles: ProfitPricingChannelProfile[]) {
  return channelProfiles.map((profile) => ({
    slug: profile.channel === "website" ? "website" : profile.channel,
    enabled: true,
    salePrice: profile.input.salePrice,
    buyboxPrice: profile.input.buyboxPrice ?? null,
    manualShippingCost:
      profile.channel === "website" ? profile.input.shippingCost ?? null : null,
  }));
}

function hasInvalidChannelValues(channelProfiles: ProfitPricingChannelProfile[]) {
  return channelProfiles.some((profile) => {
    const salePrice = profile.input.salePrice;
    return !Number.isFinite(salePrice) || salePrice <= 0;
  });
}

async function persistProductChannels(
  productId: string,
  channelProfiles: ProfitPricingChannelProfile[]
) {
  const response = await fetch(`/api/products/${productId}/channels`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channels: toChannelPayload(channelProfiles),
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? "Kanal fiyatları kaydedilemedi.");
  }
}

function replaceUrlParams(productId: string | undefined, channel: SalesChannel) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (productId) {
    params.set("productId", productId);
  } else {
    params.delete("productId");
  }
  params.set("channel", channel);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function pickSelectableChannel(channelProfiles: ProfitPricingChannelProfile[], fallback?: SalesChannel) {
  if (fallback && channelProfiles.some((profile) => profile.channel === fallback)) {
    return fallback;
  }

  return channelProfiles[0]?.channel ?? "trendyol";
}

function collectMissingDataIssues(
  channelProfiles: ProfitPricingChannelProfile[],
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>
) {
  const issues: string[] = [];

  const hasMissingCost = channelProfiles.some((profile) => {
    const result = resultsByChannel[profile.channel];
    return (
      !Number.isFinite(profile.input.productCost) ||
      profile.input.productCost <= 0 ||
      Boolean(result?.missingFields.some((item) => item.includes("Ürün maliyeti")))
    );
  });

  const hasMissingCommission = channelProfiles.some((profile) => {
    if (profile.channel === "website") {
      return false;
    }

    const result = resultsByChannel[profile.channel];
    return (
      profile.input.commissionRate === undefined ||
      profile.input.commissionRate <= 0 ||
      Boolean(result?.assumptions.some((item) => item.includes("Komisyon oranı")))
    );
  });

  const hasMissingShipping = channelProfiles.some((profile) => {
    const result = resultsByChannel[profile.channel];
    return (
      profile.input.shippingCost === undefined ||
      profile.input.shippingCost <= 0 ||
      Boolean(result?.assumptions.some((item) => item.includes("Kargo maliyeti"))) ||
      Boolean(result?.missingFields.some((item) => item.includes("Kargo maliyeti")))
    );
  });

  const hasMissingSalesHistory = channelProfiles.some((profile) => {
    const result = resultsByChannel[profile.channel];
    const noDemandSignal =
      result?.priceGrid.length
        ? result.priceGrid.every(
            (point) => point.estimatedDemand === null || point.estimatedDemand <= 0
          )
        : false;

    return (
      profile.input.baseDemand === undefined ||
      profile.input.baseDemand <= 0 ||
      noDemandSignal
    );
  });

  if (hasMissingCost) {
    issues.push(
      "Ürün maliyeti eksik veya 0 görünüyor. Net kâr hesabını güvenle kullanmadan önce maliyet alanını tamamlayın."
    );
  }

  if (hasMissingCommission) {
    issues.push(
      "Komisyon oranı doğrulanamadı. Pazaryeri komisyonu eksikse kanal kârlılığı olduğundan iyi görünebilir."
    );
  }

  if (hasMissingShipping) {
    issues.push(
      "Kargo maliyeti eksik. Özellikle kendi web sitenizde toplam kâr tahmini bu alan olmadan zayıflar."
    );
  }

  if (hasMissingSalesHistory) {
    issues.push(
      "Satış geçmişi sınırlı. Talep ve toplam kâr tahminleri daha düşük güvenle hesaplanıyor."
    );
  }

  return issues;
}

export default function ProfitPricingPage(props: { bootstrap: ProfitPricingBootstrap }) {
  const [state, dispatch] = useReducer(reducer, props.bootstrap, createInitialState);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [applyingStrategy, setApplyingStrategy] = useState<OptimizationStrategyKey | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const lastSyncedSignatureRef = useRef(
    createChannelSignature(props.bootstrap.channelProfiles)
  );
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const graphSectionRef = useRef<HTMLDivElement | null>(null);

  const resultsByChannel = useMemo(
    () => buildResultsByChannel(state.channelProfiles),
    [state.channelProfiles]
  );
  const selectedProfile =
    state.channelProfiles.find((profile) => profile.channel === state.selectedChannel) ??
    state.channelProfiles[0] ??
    null;
  const selectedResult =
    resultsByChannel[state.selectedChannel] ??
    resultsByChannel[pickSelectableChannel(state.channelProfiles)] ??
    null;
  const activeResult =
    selectedResult ??
    (selectedProfile ? calculateProfitPricing(selectedProfile.input) : null);

  const strategies = useMemo(
    () => buildOptimizationSuggestions(resultsByChannel, state.selectedChannel),
    [resultsByChannel, state.selectedChannel]
  );
  const missingDataIssues = useMemo(
    () => collectMissingDataIssues(state.channelProfiles, resultsByChannel),
    [resultsByChannel, state.channelProfiles]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const productId = state.channelProfiles[0]?.input.productId;
    const signature = createChannelSignature(state.channelProfiles);

    if (!productId || signature === lastSyncedSignatureRef.current) {
      return;
    }

    if (hasInvalidChannelValues(state.channelProfiles)) {
      setSyncState("error");
      return;
    }

    setSyncState("saving");
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistProductChannels(productId, state.channelProfiles)
        .then(() => {
          lastSyncedSignatureRef.current = signature;
          setSyncState("saved");
        })
        .catch((error) => {
          setSyncState("error");
          setFeedback({
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Veri Merkezi güncellenemedi.",
          });
        });
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [state.channelProfiles]);

  const currentProductId = state.channelProfiles[0]?.input.productId;
  const currentProductName =
    state.channelProfiles[0]?.input.productName ?? props.bootstrap.products[0]?.label ?? "Ürün";

  const handleSelectProduct = async (productId: string) => {
    if (!productId || productId === currentProductId) {
      return;
    }

    setSelectionLoading(true);
    setLoadError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/profit-pricing/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        channelProfiles?: ProfitPricingChannelProfile[];
      };

      if (!response.ok || !data.ok || !data.channelProfiles?.length) {
        throw new Error(data.error ?? "Ürün verisi yüklenemedi.");
      }

      const selectedChannel = pickSelectableChannel(
        data.channelProfiles,
        state.selectedChannel
      );
      lastSyncedSignatureRef.current = createChannelSignature(data.channelProfiles);
      replaceUrlParams(productId, selectedChannel);
      dispatch({
        type: "load-product",
        channelProfiles: data.channelProfiles,
        selectedChannel,
      });
      setSyncState("idle");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Ürün bilgileri yüklenemedi."
      );
    } finally {
      setSelectionLoading(false);
    }
  };

  const handleChangeField = (
    channel: SalesChannel,
    field: EditableProfitPricingField,
    value: number | undefined
  ) => {
    setFeedback(null);
    dispatch({ type: "patch-field", channel, field, value });
  };

  const handleOptimize = async () => {
    if (!currentProductId) {
      return;
    }

    if (hasInvalidChannelValues(state.channelProfiles)) {
      setFeedback({
        tone: "error",
        text: "Optimizasyon için her kanalın satış fiyatı 0'dan büyük olmalı.",
      });
      return;
    }

    try {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      setSyncState("saving");
      await persistProductChannels(currentProductId, state.channelProfiles);
      lastSyncedSignatureRef.current = createChannelSignature(state.channelProfiles);
      setSyncState("saved");
      dispatch({ type: "set-optimization-ready", value: true });
      setFeedback({
        tone: "info",
        text: "Öneriler hazır. Kanal bazlı fiyat seçenekleri aşağıda üretildi.",
      });
      recommendationSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      setSyncState("error");
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Optimizasyon için ürün ayarları kaydedilemedi.",
      });
    }
  };

  const handleApplyStrategy = async (strategy: OptimizationStrategyKey) => {
    const suggestion = strategies.find((item) => item.key === strategy);
    if (!suggestion || suggestion.disabled || !currentProductId) {
      return;
    }

    const nextProfiles = state.channelProfiles.map((profile) => {
      const target = suggestion.channelTargets.find(
        (item) => item.channel === profile.channel
      );
      if (!target?.price) {
        return profile;
      }

      return {
        ...profile,
        input: {
          ...profile.input,
          salePrice: target.price,
          basePrice: target.price,
          dataSource: "mixed" as const,
        },
      };
    });

    setApplyingStrategy(strategy);
    setFeedback(null);

    try {
      await persistProductChannels(currentProductId, nextProfiles);
      lastSyncedSignatureRef.current = createChannelSignature(nextProfiles);
      setSyncState("saved");
      dispatch({
        type: "apply-profiles",
        channelProfiles: nextProfiles,
        activeStrategy: strategy,
      });
      setFeedback({
        tone: "success",
        text: `${currentProductName} ürünü için tüm kanallarda fiyat optimize edildi.`,
      });
      graphSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSyncState("error");
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kanal fiyatları optimize edilip kaydedilemedi.",
      });
    } finally {
      setApplyingStrategy(null);
    }
  };

  const activeStepIndex = state.activeStrategy
    ? 3
    : state.optimizationReady
      ? 2
      : currentProductId
        ? 1
        : 0;

  if (props.bootstrap.products.length === 0) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Kârlılık ve Fiyat Optimizasyonu"
          description="Ürünü seç, kanal fiyatlarını kontrol et, en iyi fiyat stratejisini uygula."
        />
        <ProfitPricingEmptyState />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Kârlılık ve Fiyat Optimizasyonu"
          description="Ürünü seç, kanal fiyatlarını kontrol et, en iyi fiyat stratejisini uygula."
        />
        <ProfitPricingErrorState message={loadError} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="sticky top-[76px] z-30 mb-4 sm:mb-5">
        <WorkflowStepper activeStepIndex={activeStepIndex} />
      </div>

      <PageHeader
        title="Kârlılık ve Fiyat Optimizasyonu"
        description="Ürünü seç, kanal fiyatlarını kontrol et, en iyi fiyat stratejisini uygula."
      />

      {selectionLoading ? (
        <ProfitPricingLoadingState />
      ) : (
        <div className="flex w-full flex-col gap-4">
          <section className="flex w-full flex-col gap-4">
            <ProfitPricingControlPanel
              products={props.bootstrap.products}
              channelProfiles={state.channelProfiles}
              resultsByChannel={resultsByChannel}
              selectedChannel={state.selectedChannel}
              busy={selectionLoading}
              syncState={syncState}
              optimizationReady={state.optimizationReady}
              feedback={feedback}
              onSelectProduct={handleSelectProduct}
              onSelectChannel={(channel) => {
                replaceUrlParams(currentProductId, channel);
                dispatch({ type: "select-channel", channel });
              }}
              onChangeField={handleChangeField}
              onOptimize={handleOptimize}
            />
          </section>

          <section ref={recommendationSectionRef} className="flex w-full flex-col gap-4">
            {activeResult ? (
              <OptimizationRecommendationTable
                resultsByChannel={resultsByChannel}
                selectedChannel={state.selectedChannel}
                strategies={strategies}
                activeStrategy={state.activeStrategy}
                applyingStrategy={applyingStrategy}
                onApplyStrategy={handleApplyStrategy}
              />
            ) : (
              <DeferredPanelPlaceholder title="Optimizasyon tablosu yüklenemedi." />
            )}
          </section>

          <section className="flex w-full flex-col gap-4">
            <div ref={graphSectionRef}>
              {activeResult ? (
                <PriceProfitCurve
                  result={activeResult}
                  selectedChannel={state.selectedChannel}
                  strategies={strategies}
                  activeStrategy={state.activeStrategy}
                />
              ) : (
                <DeferredPanelPlaceholder title="Fiyat talep eğrisi yüklenemedi." />
              )}
            </div>
          </section>

          {missingDataIssues.length > 0 ? (
            <MissingDataPanel issues={missingDataIssues} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function WorkflowStepper(props: { activeStepIndex: number }) {
  return (
    <GlassCard className="overflow-hidden border-border/80 bg-panel/96 px-3 py-3 shadow-[var(--shadow-panel)] backdrop-blur-2xl sm:px-4">
      <div className="flex min-w-max items-center gap-2 md:gap-3">
        {WORKFLOW_STEPS.map((step, index) => {
          const state =
            index < props.activeStepIndex
              ? "complete"
              : index === props.activeStepIndex
                ? "active"
                : "upcoming";

          return (
            <div key={step} className="flex items-center gap-2 md:gap-3">
              <div
                className={[
                  "flex min-w-[180px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                  state === "complete"
                    ? "border-profit/20 bg-profit/[0.08] text-profit"
                    : state === "active"
                      ? "border-primary/25 bg-primary/[0.1] text-primary shadow-[var(--shadow-primary)]"
                      : "border-border/80 bg-surface-container/70 text-muted",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] font-semibold",
                    state === "complete"
                      ? "border-profit/20 bg-profit/12 text-profit"
                      : state === "active"
                        ? "border-primary/20 bg-primary/16 text-primary"
                        : "border-border/70 bg-surface-soft/80 text-muted",
                  ].join(" ")}
                >
                  {state === "complete" ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
                    Adım {index + 1}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">{step}</p>
                </div>
              </div>
              {index < WORKFLOW_STEPS.length - 1 ? (
                <span className="text-muted/50" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function MissingDataPanel(props: { issues: string[] }) {
  return (
    <GlassCard className="border-warning/20 bg-warning/[0.06]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-warning/25 bg-warning/10 text-warning">
            <CircleAlert className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-warning/80">
                Veri eksik
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Kararı uygulamadan önce veri tabanını tamamlayın
              </h3>
            </div>
            <p className="text-sm leading-6 text-soft">
              Bu fiyat önerileri üretildi, ancak aşağıdaki boşluklar güven seviyesini düşürüyor.
            </p>
            <div className="flex flex-col gap-2">
              {props.issues.map((issue) => (
                <div key={issue} className="flex items-start gap-2 text-sm leading-6 text-soft">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/veri-merkezi"
          className="btn-secondary min-h-11 whitespace-nowrap px-5 text-sm"
        >
          Veri Merkezi&apos;nde tamamla
        </Link>
      </div>
    </GlassCard>
  );
}

function DeferredPanelPlaceholder(props: { title: string }) {
  return (
    <GlassCard className="border-border/70 bg-panel/72">
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-surface-container/45 px-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <LineChart className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-muted/700">{props.title}</p>
        </div>
      </div>
    </GlassCard>
  );
}
