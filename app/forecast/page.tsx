"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, RotateCw, Sparkles } from "lucide-react";
import ForecastControlPanel from "@/components/forecast/ForecastControlPanel";
import ForecastKpiCards from "@/components/forecast/ForecastKpiCards";
import ForecastChartsAndTable from "@/components/forecast/ForecastChartsAndTable";
import ForecastLoadingState from "@/components/forecast/ForecastLoadingState";
import { EmptyState, ErrorStateCard, GlassCard } from "@/components/ui-custom/GlassComponents";
import type {
  DemandForecastBootstrapResponse,
  DemandForecastResult,
  DemandForecastSelection,
  ForecastHorizon,
} from "@/lib/demand-forecast-types";
import { formatNumber } from "@/lib/formatters";

function parseNumberParam(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseHorizonParam(value: string | null): ForecastHorizon | undefined {
  const parsed = Number(value);
  if (parsed === 7 || parsed === 14 || parsed === 30) return parsed;
  return undefined;
}

export default function ForecastPage() {
  return (
    <Suspense
      fallback={<ForecastLoadingState />}
    >
      <ForecastPageContent />
    </Suspense>
  );
}

function ForecastPageContent() {
  const searchParams = useSearchParams();
  const initialProductId = parseNumberParam(searchParams.get("productId"));
  const initialMarketplaceId = parseNumberParam(searchParams.get("marketplaceId"));
  const initialHorizonDays = parseHorizonParam(searchParams.get("horizonDays"));

  const [bootstrap, setBootstrap] = useState<DemandForecastBootstrapResponse | null>(null);
  const [result, setResult] = useState<DemandForecastResult | null>(null);
  const [selection, setSelection] = useState<DemandForecastSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrapRequestRef = useRef<AbortController | null>(null);
  const bootstrapRequestSeqRef = useRef(0);
  const forecastRequestRef = useRef<AbortController | null>(null);
  const forecastRequestSeqRef = useRef(0);

  const loadBootstrap = async (nextSelection?: Partial<DemandForecastSelection>) => {
    bootstrapRequestRef.current?.abort();
    forecastRequestRef.current?.abort();
    const requestId = bootstrapRequestSeqRef.current + 1;
    bootstrapRequestSeqRef.current = requestId;
    const controller = new AbortController();
    bootstrapRequestRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const effective = {
        productId: nextSelection?.productId ?? selection?.productId ?? initialProductId,
        marketplaceId: nextSelection?.marketplaceId ?? selection?.marketplaceId ?? initialMarketplaceId,
        horizonDays: nextSelection?.horizonDays ?? selection?.horizonDays ?? initialHorizonDays,
      };

      if (effective.productId) params.set("productId", String(effective.productId));
      if (effective.marketplaceId) params.set("marketplaceId", String(effective.marketplaceId));
      if (effective.horizonDays) params.set("horizonDays", String(effective.horizonDays));

      const response = await fetch(`/api/v1/forecast/generate${params.toString() ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const data = (await response.json()) as DemandForecastBootstrapResponse & { success?: boolean; error?: string };
      if (controller.signal.aborted || bootstrapRequestSeqRef.current !== requestId) {
        return;
      }
      if (!response.ok || data.success === false) {
        throw new Error(data.error ?? "Tahmin alınamadı.");
      }

      setBootstrap(data);
      setResult(data.result);
      setSelection(data.defaults);
    } catch (fetchError) {
      if (controller.signal.aborted || bootstrapRequestSeqRef.current !== requestId) {
        return;
      }
      const message = fetchError instanceof Error ? fetchError.message : "Bilinmeyen hata";
      setError(message);
    } finally {
      if (bootstrapRequestSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadBootstrap({
      productId: initialProductId,
      marketplaceId: initialMarketplaceId,
      horizonDays: initialHorizonDays,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      bootstrapRequestRef.current?.abort();
      forecastRequestRef.current?.abort();
    };
  }, []);

  const handleRunForecast = async () => {
    if (!selection) return;

    forecastRequestRef.current?.abort();
    const requestId = forecastRequestSeqRef.current + 1;
    forecastRequestSeqRef.current = requestId;
    const controller = new AbortController();
    forecastRequestRef.current = controller;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/forecast/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(selection),
      });

      const data = (await response.json()) as { success?: boolean; result?: DemandForecastResult; error?: string };
      if (controller.signal.aborted || forecastRequestSeqRef.current !== requestId) {
        return;
      }
      if (!response.ok || data.success === false || !data.result) {
        throw new Error(data.error ?? "Tahmin oluşturulamadı.");
      }

      setResult(data.result);
      if (bootstrap) {
        setBootstrap({
          ...bootstrap,
          result: data.result,
          defaults: selection,
          selectedProduct: bootstrap.products.find((product) => product.id === selection.productId) ?? bootstrap.selectedProduct,
          selectedMarketplace:
            bootstrap.marketplaces.find((marketplace) => marketplace.id === selection.marketplaceId) ?? bootstrap.selectedMarketplace,
        });
      }
    } catch (runError) {
      if (controller.signal.aborted || forecastRequestSeqRef.current !== requestId) {
        return;
      }
      const message = runError instanceof Error ? runError.message : "Hesaplama hatası";
      setError(message);
    } finally {
      if (forecastRequestSeqRef.current === requestId) {
        setSubmitting(false);
      }
    }
  };

  const handleSelectionChange = async (nextSelection: Partial<DemandForecastSelection>) => {
    const merged: DemandForecastSelection = {
      productId: nextSelection.productId ?? selection?.productId ?? bootstrap?.defaults.productId ?? initialProductId ?? bootstrap?.selectedProduct?.id ?? 0,
      marketplaceId: nextSelection.marketplaceId ?? selection?.marketplaceId ?? bootstrap?.defaults.marketplaceId ?? initialMarketplaceId ?? bootstrap?.selectedMarketplace?.id ?? 1,
      horizonDays: nextSelection.horizonDays ?? selection?.horizonDays ?? bootstrap?.defaults.horizonDays ?? initialHorizonDays ?? 14,
    };

    setSelection(merged);
    await loadBootstrap(merged);
  };

  if (loading && !bootstrap) {
    return <ForecastLoadingState />;
  }

  if (error && !bootstrap) {
    return (
      <div className="page-shell">
        <ErrorStateCard
          className="mx-auto max-w-2xl"
          title="Talep tahmini yüklenemedi"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void loadBootstrap()}
              className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              <RotateCw className="h-4 w-4" />
              Tekrar dene
            </button>
          }
        />
      </div>
    );
  }

  if (bootstrap && (bootstrap.products.length === 0 || bootstrap.marketplaces.length === 0)) {
    return (
      <div className="page-shell">
        <EmptyState
          icon={Package}
          title="Tahmin için yeterli veri yok"
          description="Talep tahmini başlatmak için önce ürün ve pazar verilerini ekleyin."
          className="mx-auto max-w-md"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/veri-merkezi"
                className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
              >
                <Package className="h-4 w-4" />
                Veri Merkezine Git
              </Link>
              <button
                type="button"
                onClick={() => void loadBootstrap()}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
              >
                <RotateCw className="h-4 w-4" />
                Yenile
              </button>
            </div>
          }
        />
      </div>
    );
  }

  const selectedProduct = bootstrap?.products.find((product) => product.id === selection?.productId) ?? bootstrap?.selectedProduct ?? null;
  const selectedMarketplace = bootstrap?.marketplaces.find((marketplace) => marketplace.id === selection?.marketplaceId) ?? bootstrap?.selectedMarketplace ?? null;
  const activeResult = result ?? bootstrap?.result ?? null;

  const headerStats = [
    {
      label: "Tahmin modeli",
      value: activeResult?.summary.modelName ? "İstatistiksel model" : "Seçilmedi",
    },
    {
      label: "Aktif ürün",
      value: selectedProduct?.name ?? "Seçilmedi",
    },
    {
      label: "Pazar",
      value: selectedMarketplace?.name ?? "Seçilmedi",
    },
    {
      label: "Veri geçmişi",
      value: bootstrap?.historyDepthDays ? `${formatNumber(bootstrap.historyDepthDays)} gün` : "Belirlenmedi",
    },
  ];

  return (
    <div className="page-shell">
      <div>
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Tahmin alanı
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Talep Tahmini
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Ürün, pazar ve tahmin ufku tek yerde. Seçim değişince sonuç aynı akış içinde yenilenir.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[520px] xl:grid-cols-4">
            {headerStats.map((stat) => (
              <MiniStat key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>

        {error && (
          <GlassCard className="mb-6 border-danger/40 bg-danger/5 p-4">
            <p className="text-sm font-semibold text-danger">{error}</p>
          </GlassCard>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 min-w-0">
            <ForecastKpiCards result={activeResult} />
            <ForecastChartsAndTable result={activeResult} />
          </div>

          <ForecastControlPanel
            className="self-start xl:sticky xl:top-[76px]"
            products={bootstrap?.products ?? []}
            marketplaces={bootstrap?.marketplaces ?? []}
            selection={selection ?? bootstrap?.defaults ?? { productId: 0, marketplaceId: 1, horizonDays: 14 }}
            selectedMarketplaceId={selection?.marketplaceId ?? bootstrap?.defaults.marketplaceId ?? 0}
            selectedProduct={selectedProduct}
            selectedMarketplace={selectedMarketplace}
            result={activeResult}
            onProductChange={(productId) => {
              void handleSelectionChange({ productId });
            }}
            onMarketplaceChange={(marketplaceId) => {
              void handleSelectionChange({ marketplaceId });
            }}
            onHorizonChange={(horizonDays) => {
              void handleSelectionChange({ horizonDays });
            }}
            onRunForecast={handleRunForecast}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-container px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
