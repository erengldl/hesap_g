"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AlertTriangle, LineChart, ShieldCheck } from "lucide-react";

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

import ChannelCostWaterfall from "./ChannelCostWaterfall";
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
  const graphSectionRef = useRef<HTMLDivElement | null>(null);
  const waterfallSectionRef = useRef<HTMLDivElement | null>(null);

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
      graphSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      waterfallSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (props.bootstrap.products.length === 0) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Karar ekranı"
          title="Kârlılık ve Fiyat Optimizasyonu"
          description="Ürünün gerçek maliyetini hesapla, kârlı fiyat aralığını aynı ekranda gör."
        />
        <ProfitPricingEmptyState />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Karar ekranı"
          title="Kârlılık ve Fiyat Optimizasyonu"
          description="Ürünün gerçek maliyetini hesapla, kârlı fiyat aralığını aynı ekranda gör."
        />
        <ProfitPricingErrorState message={loadError} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Karar ekranı"
        title="Kârlılık ve Fiyat Optimizasyonu"
        description="Ürünü seç, üç kanalın fiyatını aynı anda yönet ve tek tıkla optimize et."
      >
        <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          {syncState === "saving"
            ? "Veri Merkezi güncelleniyor..."
            : syncState === "saved"
              ? "Veri Merkezi güncel"
              : "Canlı fiyat yönetimi"}
        </div>
      </PageHeader>

      {selectionLoading ? (
        <ProfitPricingLoadingState />
      ) : (
        <div className="space-y-5">
          <section className="space-y-5">
            <div>
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
            </div>

            <div className="space-y-5">
              <div className="px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/600">
                  Grafikler
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Fiyat talep eğrisi ve waterfall maliyet grafiği
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-soft">
                  Seçili kanalın fiyat, talep, toplam kâr ve net maliyet akışı burada canlı
                  görünür. Kanal kartına bastığında grafikler anında o kanala geçer.
                </p>
              </div>

              <div ref={graphSectionRef}>
                {activeResult ? (
                  <PriceProfitCurve
                    result={activeResult}
                    selectedChannel={state.selectedChannel}
                    strategies={strategies}
                    activeStrategy={state.activeStrategy}
                    applyingStrategy={applyingStrategy}
                    onApplyStrategy={handleApplyStrategy}
                  />
                ) : (
                  <DeferredPanelPlaceholder title="Fiyat talep eğrisi yüklenemedi." />
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            {activeResult ? (
              <OptimizationRecommendationTable
                resultsByChannel={resultsByChannel}
                strategies={strategies}
                activeStrategy={state.activeStrategy}
                applyingStrategy={applyingStrategy}
                onApplyStrategy={handleApplyStrategy}
              />
            ) : (
              <DeferredPanelPlaceholder title="Optimizasyon tablosu yüklenemedi." />
            )}

            <div ref={waterfallSectionRef}>
              {activeResult ? (
                <ChannelCostWaterfall result={activeResult} />
              ) : (
                <DeferredPanelPlaceholder title="Waterfall maliyet grafiği yüklenemedi." />
              )}
            </div>
          </section>

          {activeResult &&
          (activeResult.warnings.length > 0 || activeResult.missingFields.length > 0) ? (
            <GlassCard className="border-warning/20 bg-warning/5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/20 bg-warning/10 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Veri kalitesi dikkat istiyor
                  </p>
                  <p className="mt-2 text-sm leading-6 text-soft">
                    Eksik alanlar ve varsayımlar karar çıktısını etkileyebilir. Önce ürün
                    maliyeti, komisyon ve kargo alanlarını doğrulayın.
                  </p>
                </div>
              </div>
            </GlassCard>
          ) : null}
        </div>
      )}
    </div>
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
