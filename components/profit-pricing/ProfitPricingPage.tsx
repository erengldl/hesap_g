"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertTriangle, LineChart, ShieldCheck } from "lucide-react";

import ModuleHero from "@/components/layout/ModuleHero";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import {
  formatProfitPricingCurrency,
  formatProfitPricingPercent,
} from "@/lib/profit-pricing/formatters";
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
import { channelLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

import ChannelCostWaterfall from "./ChannelCostWaterfall";
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
    throw new Error(data?.error ?? "Kanal fiyatlari kaydedilemedi.");
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

function pickSelectableChannel(
  channelProfiles: ProfitPricingChannelProfile[],
  fallback?: SalesChannel
) {
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
    selectedResult ?? (selectedProfile ? calculateProfitPricing(selectedProfile.input) : null);

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
              error instanceof Error ? error.message : "Veri Merkezi guncellenemedi.",
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
    state.channelProfiles[0]?.input.productName ?? props.bootstrap.products[0]?.label ?? "Urun";

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
        throw new Error(data.error ?? "Urun verisi yuklenemedi.");
      }

      const selectedChannel = pickSelectableChannel(data.channelProfiles, state.selectedChannel);
      lastSyncedSignatureRef.current = createChannelSignature(data.channelProfiles);
      replaceUrlParams(productId, selectedChannel);
      dispatch({
        type: "load-product",
        channelProfiles: data.channelProfiles,
        selectedChannel,
      });
      setSyncState("idle");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Urun bilgileri yuklenemedi.");
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
        text: "Optimizasyon icin her kanalin satis fiyati 0'dan buyuk olmali.",
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
        text: "Oneriler hazir. Kanal bazli fiyat secenekleri asagida uretildi.",
      });
      graphSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSyncState("error");
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Optimizasyon icin urun ayarlari kaydedilemedi.",
      });
    }
  };

  const handleApplyStrategy = async (strategy: OptimizationStrategyKey) => {
    const suggestion = strategies.find((item) => item.key === strategy);
    if (!suggestion || suggestion.disabled || !currentProductId) {
      return;
    }

    const nextProfiles = state.channelProfiles.map((profile) => {
      const target = suggestion.channelTargets.find((item) => item.channel === profile.channel);
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
        text: `${currentProductName} urunu icin tum kanallarda fiyat optimize edildi.`,
      });
      waterfallSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSyncState("error");
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kanal fiyatlari optimize edilip kaydedilemedi.",
      });
    } finally {
      setApplyingStrategy(null);
    }
  };

  if (props.bootstrap.products.length === 0) {
    return (
      <div className="space-y-6">
        <ModuleHero
          eyebrow="Karar ekrani"
          title="Karlilik ve Fiyat Optimizasyonu"
          description="Urun, kanal ve fiyat kararlarini tek bir operasyon panelinde yonet."
          badges={["Canli fiyat yonetimi", "Kanal bazli optimizasyon", "Veri merkezi senkronu"]}
        />
        <ProfitPricingEmptyState />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <ModuleHero
          eyebrow="Karar ekrani"
          title="Karlilik ve Fiyat Optimizasyonu"
          description="Urun, kanal ve fiyat kararlarini tek bir operasyon panelinde yonet."
          badges={["Canli fiyat yonetimi", "Kanal bazli optimizasyon", "Veri merkezi senkronu"]}
        />
        <ProfitPricingErrorState message={loadError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHero
        eyebrow="Karar ekrani"
        title="Karlilik ve Fiyat Optimizasyonu"
        description="Urunu sec, kanal etkisini aninda gor ve onerilen fiyat stratejisini kontrollu sekilde uygula."
        badges={[
          syncState === "saving"
            ? "Veri merkezi guncelleniyor"
            : syncState === "saved"
              ? "Veri merkezi guncel"
              : "Canli fiyat yonetimi",
          `${state.channelProfiles.length} kanal aktif`,
          currentProductName,
        ]}
      />

      <GlassCard className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Canli karar paneli
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-slate-900">
              {currentProductName}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Secili kanal: {selectedProfile ? channelLabel(selectedProfile.channel) : "Hazir degil"}.
              Ustte fiyatlari duzenle, altta karlilik egri ve maliyet dagilimini incele.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {syncState === "saving"
              ? "Veri merkezi guncelleniyor"
              : syncState === "saved"
                ? "Veri merkezi guncel"
                : "Canli fiyat yonetimi"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SnapshotStat
            label="Satis fiyati"
            value={
              activeResult
                ? formatProfitPricingCurrency(activeResult.input.salePrice)
                : "Hesaplanamadi"
            }
            hint="Secili kanal fiyati"
          />
          <SnapshotStat
            label="Net maliyet"
            value={activeResult ? formatProfitPricingCurrency(activeResult.netCost) : "Hesaplanamadi"}
            hint="Siparis basi toplam maliyet"
          />
          <SnapshotStat
            label="Net kar"
            value={activeResult ? formatProfitPricingCurrency(activeResult.netProfit) : "Hesaplanamadi"}
            hint="Birim bazli sonuc"
            tone={activeResult && activeResult.netProfit < 0 ? "danger" : "success"}
          />
          <SnapshotStat
            label="Marj"
            value={activeResult ? formatProfitPricingPercent(activeResult.profitMargin) : "Hesaplanamadi"}
            hint={
              activeResult
                ? `${activeResult.warnings.length} uyari · ${activeResult.missingFields.length} eksik alan`
                : "Veri bekleniyor"
            }
          />
        </div>
      </GlassCard>

      {selectionLoading ? (
        <ProfitPricingLoadingState />
      ) : (
        <div className="flex w-full flex-col gap-5">
          <section className="flex w-full flex-col gap-4">
            <ProfitPricingControlPanel
              products={props.bootstrap.products}
              channelProfiles={state.channelProfiles}
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

          <section className="flex w-full flex-col gap-4">
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
                <DeferredPanelPlaceholder title="Fiyat talep egrisi yuklenemedi." />
              )}
            </div>
          </section>

          <section className="flex w-full flex-col gap-4">
            <div ref={waterfallSectionRef}>
              {activeResult ? (
                <ChannelCostWaterfall result={activeResult} />
              ) : (
                <DeferredPanelPlaceholder title="Waterfall maliyet grafigi yuklenemedi." />
              )}
            </div>
          </section>

          {activeResult &&
          (activeResult.warnings.length > 0 || activeResult.missingFields.length > 0) ? (
            <GlassCard className="rounded-[26px] border border-amber-200 bg-amber-50/70">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Veri kalitesi dikkat istiyor</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Eksik alanlar ve varsayimlar karar ciktilarini etkileyebilir. Once urun
                    maliyeti, komisyon ve kargo alanlarini dogrulayin.
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
    <GlassCard className="rounded-[26px] border border-slate-200 bg-white">
      <div className="flex min-h-[320px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <LineChart className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-500">{props.title}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function SnapshotStat(props: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "danger";
}) {
  const valueClassName =
    props.tone === "success"
      ? "text-emerald-600"
      : props.tone === "danger"
        ? "text-rose-600"
        : "text-slate-900";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {props.label}
      </p>
      <p className={cn("mt-3 text-2xl font-semibold tracking-[-0.04em]", valueClassName)}>
        {props.value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{props.hint}</p>
    </div>
  );
}
