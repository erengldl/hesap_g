"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

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
  const tone = props.busy
    ? "border-border/80 bg-surface-container/70 text-muted"
    : props.syncState === "error"
      ? "border-danger/25 bg-danger/10 text-danger"
      : props.syncState === "saved"
        ? "border-success/25 bg-success/10 text-success"
        : props.optimizationReady
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border/80 bg-surface-container/70 text-muted";

  const label = props.busy
    ? "Ürün seçimi hazırlanıyor..."
    : props.syncState === "saving"
      ? "Veri Merkezi güncelleniyor..."
      : props.syncState === "saved"
        ? "Veri Merkezi güncel"
        : props.syncState === "error"
          ? "Kayıt hatası"
          : props.optimizationReady
            ? "Öneriler güncel"
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
      {props.syncState === "saved" && !props.busy ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

function ChannelInput(props: {
  label: string;
  value: number | undefined;
  hint: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="space-y-2">
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
      <span className="block text-[11px] leading-5 text-muted/600">{props.hint}</span>
    </label>
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

  return (
    <div
      onClick={() => props.onSelect(profile.channel)}
      className={cn(
        "cursor-pointer rounded-2xl border bg-panel/72 p-4 text-left transition-all duration-200",
        active
          ? "border-primary/35 shadow-[var(--shadow-primary)]"
          : "border-border/70 hover:border-border-strong"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {channelLabel(profile.channel)}
          </p>
          <p className="mt-1 text-[11px] text-muted/600">
            Grafikleri bu kartı seçerek değiştir.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            active
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-border/70 bg-surface-container/70 text-muted/650"
          )}
        >
          {active ? "Seçili kanal" : "Kanal"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <ChannelInput
          label="Satış fiyatı"
          value={profile.input.salePrice}
          hint="Bu kanal için güncel satış fiyatı."
          onChange={(value) => props.onChangeField(profile.channel, "salePrice", value)}
        />
        <ChannelInput
          label={isWebsite ? "Kargo fiyatı" : "Buybox fiyatı"}
          value={isWebsite ? profile.input.shippingCost : profile.input.buyboxPrice}
          hint={
            isWebsite
              ? "Web sitesi siparişlerinde kullanılan manuel kargo maliyeti."
              : "Buybox dengesi önerisi bu eşik altında kalmaya çalışır."
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

      <div className="mt-4 space-y-2">
        <div className="rounded-xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Net kâr</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatProfitPricingCurrency(result?.netProfit ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Marj</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatProfitPricingPercent(result?.profitMargin ?? null)}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-container/70 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Toplam kâr</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatProfitPricingCurrency(
              result?.priceGrid.find((point) => point.price === profile.input.salePrice)
                ?.estimatedTotalProfit ?? result?.priceScenarios[0]?.estimatedTotalProfit ?? 0
            )}
          </p>
        </div>
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
    <GlassCard className="border-border/80">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/600">
              Ürün seçimi
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Tek ürün, üç kanal, tek optimizasyon akışı
            </h2>
          </div>
          <StatusBadge
            syncState={props.syncState}
            busy={props.busy}
            optimizationReady={props.optimizationReady}
          />
        </div>

        <div className="space-y-3">
          <label className="space-y-2">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
              Ürün seç
            </span>
            <select
              aria-label="Ürün seç"
              value={activeProductId}
              onChange={(event) => props.onSelectProduct(event.target.value)}
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

          <button
            type="button"
            onClick={props.onOptimize}
            disabled={props.busy || props.channelProfiles.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Fiyatları Optimize Et
          </button>
        </div>

        {props.feedback ? (
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              props.feedback.tone === "success"
                ? "border-success/25 bg-success/10 text-success"
                : props.feedback.tone === "error"
                  ? "border-danger/25 bg-danger/10 text-danger"
                  : "border-primary/25 bg-primary/10 text-primary"
            )}
          >
            {props.feedback.text}
          </div>
        ) : null}

        <div className="space-y-4">
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
