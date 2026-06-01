"use client";

import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import type {
  EditableProfitPricingField,
  ProfitPricingBootstrapProduct,
  ProfitPricingChannelProfile,
  ProfitPricingResult,
  SalesChannel,
} from "@/lib/profit-pricing/types";
import {
  formatProfitPricingCurrency,
  formatProfitPricingPercent,
} from "@/lib/profit-pricing/formatters";
import { channelLabel } from "@/lib/profit-pricing/utils";
import { cn } from "@/lib/utils";

type SyncState = "idle" | "saving" | "saved" | "error";

type Feedback = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

function toInputValue(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? "" : String(value);
}

function createNumberParser(
  onChange: (value: number | undefined) => void,
  allowUndefined: boolean
) {
  return (raw: string) => {
    if (raw.trim() === "") {
      onChange(allowUndefined ? undefined : Number.NaN);
      return;
    }

    const next = Number(raw);
    onChange(Number.isFinite(next) ? next : Number.NaN);
  };
}

function StatusBadge(props: {
  syncState: SyncState;
  busy: boolean;
  optimizationReady: boolean;
}) {
  const tone =
    props.busy || props.syncState === "saving"
      ? "border-primary/25 bg-primary/10 text-primary"
      : props.syncState === "error"
        ? "border-danger/25 bg-danger/10 text-danger"
        : props.syncState === "saved" || props.optimizationReady
          ? "border-success/25 bg-success/10 text-success"
          : "border-border/80 bg-surface-container/70 text-muted";

  const label =
    props.busy || props.syncState === "saving"
      ? "Kaydediliyor"
      : props.syncState === "error"
        ? "Hata"
        : props.syncState === "saved" || props.optimizationReady
          ? "Güncel"
          : "Canlı önizleme";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
        tone
      )}
    >
      {(props.busy || props.syncState === "saving") && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      )}
      {(props.syncState === "saved" || props.optimizationReady) &&
      !props.busy &&
      props.syncState !== "saving" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : null}
      {label}
    </span>
  );
}

function cockpitChannelLabel(channel: SalesChannel) {
  return channel === "website" ? "Kendi Websitem" : channelLabel(channel);
}

function findCurrentTotalProfit(result: ProfitPricingResult | undefined, salePrice: number) {
  if (!result) {
    return null;
  }

  const currentScenario =
    result.priceScenarios.find((scenario) => scenario.key === "current") ??
    result.priceScenarios.find((scenario) =>
      scenario.label.toLocaleLowerCase("tr-TR").includes("mevcut")
    );

  if (currentScenario?.estimatedTotalProfit !== undefined) {
    return currentScenario.estimatedTotalProfit ?? null;
  }

  const currentPoint = result.priceGrid.find(
    (point) => Math.abs(point.price - salePrice) < 0.01
  );

  return currentPoint?.estimatedTotalProfit ?? null;
}

function moneyTone(value: number | null | undefined, margin?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "neutral";
  }

  if (value <= 0) {
    return "loss";
  }

  if (margin !== null && margin !== undefined && Number.isFinite(margin) && margin < 0.15) {
    return "warning";
  }

  return "profit";
}

function marginTone(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "neutral";
  }

  if (value <= 0) {
    return "loss";
  }

  if (value < 0.15) {
    return "warning";
  }

  return "profit";
}

function metricToneClasses(tone: "profit" | "warning" | "loss" | "neutral") {
  switch (tone) {
    case "profit":
      return "border-profit/20 bg-profit/[0.08] text-profit";
    case "warning":
      return "border-warning/20 bg-warning/[0.08] text-warning";
    case "loss":
      return "border-loss/20 bg-loss/[0.08] text-loss";
    default:
      return "border-border/70 bg-surface-container/70 text-foreground";
  }
}

function ChannelInput(props: {
  label: string;
  value: number | undefined;
  hint: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
        {props.label}
      </span>
      <input
        aria-label={props.label}
        type="number"
        step="0.01"
        value={toInputValue(props.value)}
        onChange={(event) =>
          createNumberParser(props.onChange, true)(event.target.value)
        }
        className="form-input"
      />
      <span className="block text-[10px] leading-4 text-muted/600">{props.hint}</span>
    </label>
  );
}

function MetricStat(props: {
  label: string;
  value: string;
  tone: "profit" | "warning" | "loss" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5 transition-colors",
        metricToneClasses(props.tone)
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted/70">
        {props.label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{props.value}</p>
    </div>
  );
}

function ChannelCard(props: {
  profile: ProfitPricingChannelProfile;
  result: ProfitPricingResult | undefined;
  active: boolean;
  onSelect: (channel: SalesChannel) => void;
  onChangeField: (
    channel: SalesChannel,
    field: EditableProfitPricingField,
    value: number | undefined
  ) => void;
}) {
  const { profile, result, active } = props;
  const isWebsite = profile.channel === "website";
  const currentTotalProfit = findCurrentTotalProfit(result, profile.input.salePrice);
  const cardTone = moneyTone(result?.netProfit ?? null, result?.profitMargin ?? null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(profile.channel)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect(profile.channel);
        }
      }}
      className={cn(
        "relative h-full rounded-2xl border bg-panel/78 p-4 text-left transition-all duration-200",
        active
          ? "border-primary/35 bg-primary/[0.05] shadow-[var(--shadow-primary)]"
          : "cursor-pointer border-border/70 hover:border-border-strong"
      )}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {cockpitChannelLabel(profile.channel)}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted/650">
            {isWebsite
              ? "Kargo maliyetini ve web fiyatını birlikte yönet."
              : "Satış fiyatını ve buybox baskısını birlikte izle."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]",
            active
              ? "border-primary/25 bg-primary/10 text-primary"
              : cardTone === "profit"
                ? "border-profit/20 bg-profit/10 text-profit"
                : cardTone === "loss"
                  ? "border-loss/20 bg-loss/10 text-loss"
                  : cardTone === "warning"
                    ? "border-warning/20 bg-warning/10 text-warning"
                    : "border-border/70 bg-surface-container/70 text-muted/650"
          )}
        >
          {active ? "Aktif kanal" : "Kanal"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ChannelInput
          label="Satış fiyatı"
          value={profile.input.salePrice}
          hint="Bu kanalda gösterilen güncel satış fiyatı."
          onChange={(value) => props.onChangeField(profile.channel, "salePrice", value)}
        />
        <ChannelInput
          label={isWebsite ? "Kargo maliyeti" : "Buybox fiyatı"}
          value={isWebsite ? profile.input.shippingCost : profile.input.buyboxPrice}
          hint={
            isWebsite
              ? "Web siparişi için sipariş başı manuel kargo maliyeti."
              : "Buybox Balance önerisi bu seviyeyi referans alır."
          }
          onChange={(value) =>
            props.onChangeField(
              profile.channel,
              isWebsite ? "shippingCost" : "buyboxPrice",
              value
            )
          }
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricStat
          label="Net kâr"
          value={formatProfitPricingCurrency(result?.netProfit)}
          tone={moneyTone(result?.netProfit ?? null, result?.profitMargin ?? null)}
        />
        <MetricStat
          label="Marj"
          value={formatProfitPricingPercent(result?.profitMargin ?? null)}
          tone={marginTone(result?.profitMargin ?? null)}
        />
        <MetricStat
          label="Toplam kâr tahmini"
          value={formatProfitPricingCurrency(currentTotalProfit)}
          tone={moneyTone(currentTotalProfit, result?.profitMargin ?? null)}
        />
      </div>
    </div>
  );
}

export default function ProfitPricingControlPanel(props: {
  products: ProfitPricingBootstrapProduct[];
  channelProfiles: ProfitPricingChannelProfile[];
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>;
  selectedChannel: SalesChannel;
  busy: boolean;
  syncState: SyncState;
  optimizationReady: boolean;
  feedback: Feedback;
  onSelectProduct: (productId: string) => void;
  onSelectChannel: (channel: SalesChannel) => void;
  onChangeField: (
    channel: SalesChannel,
    field: EditableProfitPricingField,
    value: number | undefined
  ) => void;
  onOptimize: () => void;
}) {
  const activeProductId = props.channelProfiles[0]?.input.productId ?? "";

  return (
    <GlassCard className="overflow-hidden border-border/80 bg-gradient-to-b from-panel/96 to-surface/88">
      <div className="flex w-full flex-col gap-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_auto_minmax(220px,0.9fr)] xl:items-end">
          <label className="space-y-2">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
              Ürün
            </span>
            <select
              aria-label="Ürün seç"
              value={activeProductId}
              onChange={(event) => props.onSelectProduct(event.target.value)}
              disabled={props.busy}
              className="form-select"
            >
              {props.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                  {product.sku ? ` • ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 xl:items-start">
            <StatusBadge
              syncState={props.syncState}
              busy={props.busy}
              optimizationReady={props.optimizationReady}
            />
            <p className="text-[11px] leading-5 text-muted/650">
              Kanal değişiklikleri otomatik kaydedilir. Optimize işlemi öneri kartlarını yeniler.
            </p>
          </div>

          <button
            type="button"
            onClick={props.onOptimize}
            disabled={props.busy || props.channelProfiles.length === 0}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Fiyatları Optimize Et
          </button>
        </div>

        {props.feedback ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-6",
              props.feedback.tone === "success"
                ? "border-success/25 bg-success/10 text-success"
                : props.feedback.tone === "error"
                  ? "border-danger/25 bg-danger/10 text-danger"
                  : "border-primary/25 bg-primary/10 text-primary"
            )}
          >
            {props.feedback.tone === "error" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : props.feedback.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {props.feedback.text}
          </div>
        ) : null}

        <div className="grid w-full gap-3 xl:grid-cols-3">
          {props.channelProfiles.map((profile) => (
            <ChannelCard
              key={profile.channel}
              profile={profile}
              result={props.resultsByChannel[profile.channel]}
              active={props.selectedChannel === profile.channel}
              onSelect={props.onSelectChannel}
              onChangeField={props.onChangeField}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
