"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import type {
  EditableProfitPricingField,
  ProfitPricingBootstrapProduct,
  ProfitPricingChannelProfile,
  SalesChannel,
} from "@/lib/profit-pricing/types";
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
    ? "border-slate-200 bg-white text-slate-500"
    : props.syncState === "error"
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : props.syncState === "saved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
        : props.optimizationReady
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-slate-200 bg-white text-slate-500";

  const label = props.busy
    ? "Hazirlaniyor"
    : props.syncState === "saving"
      ? "Kaydediliyor"
      : props.syncState === "saved"
        ? "Guncel"
        : props.syncState === "error"
          ? "Hata"
          : props.optimizationReady
            ? "Oneriler hazir"
            : "Canli onizleme";

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
    <label className="space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {props.label}
      </span>
      <input
        aria-label={props.label}
        type="number"
        step="0.01"
        value={toInputValue(props.value)}
        onChange={(event) => createNumberParser(props.onChange, true)(event.target.value)}
        className="form-input"
      />
      <span className="block text-[11px] leading-5 text-slate-500">{props.hint}</span>
    </label>
  );
}

function ChannelCard(props: {
  profile: ProfitPricingChannelProfile;
  active: boolean;
  onSelect: (channel: SalesChannel) => void;
  onChangeField: (
    channel: SalesChannel,
    field: EditableProfitPricingField,
    value: number | undefined
  ) => void;
}) {
  const { profile, active } = props;
  const isWebsite = profile.channel === "website";

  return (
    <button
      type="button"
      onClick={() => props.onSelect(profile.channel)}
      className={cn(
        "h-full rounded-[24px] border p-4 text-left transition-all duration-200",
        active
          ? "border-primary/30 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{channelLabel(profile.channel)}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Grafigi ve maliyet dagilimini bu kanal belirler.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]",
            active
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-slate-200 bg-slate-50 text-slate-500"
          )}
        >
          {active ? "Secili" : "Kanal"}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <ChannelInput
          label="Satis fiyati"
          value={profile.input.salePrice}
          hint="Bu kanal icin aktif satis fiyati."
          onChange={(value) => props.onChangeField(profile.channel, "salePrice", value)}
        />
        <ChannelInput
          label={isWebsite ? "Kargo maliyeti" : "Buybox fiyati"}
          value={isWebsite ? profile.input.shippingCost : profile.input.buyboxPrice}
          hint={
            isWebsite
              ? "Web sitesi siparislerinde kullanilan manuel kargo maliyeti."
              : "Buybox dengesi bu esigin altinda kalmaya calisir."
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
    </button>
  );
}

export default function ProfitPricingControlPanel(props: {
  products: ProfitPricingBootstrapProduct[];
  channelProfiles: ProfitPricingChannelProfile[];
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
    <GlassCard className="rounded-[30px] border border-slate-200 bg-white">
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Kontrol merkezi
            </p>
            <h2 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] text-slate-900">
              Tek urun, coklu kanal, tek optimizasyon akisi
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              Urunu sec, kanal fiyatlarini duzenle ve onerileri tek butonla olustur.
            </p>
          </div>
          <StatusBadge
            syncState={props.syncState}
            busy={props.busy}
            optimizationReady={props.optimizationReady}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-2">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Urun sec
            </span>
            <select
              aria-label="Urun sec"
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
            className="btn-primary h-[52px] w-full self-end px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Fiyatlari Optimize Et
          </button>
        </div>

        {props.feedback ? (
          <div
            className={cn(
              "rounded-[22px] border px-4 py-3 text-sm",
              props.feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : props.feedback.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
            )}
          >
            {props.feedback.text}
          </div>
        ) : null}

        <div className="grid w-full gap-3 xl:grid-cols-3">
          {props.channelProfiles.map((profile) => (
            <ChannelCard
              key={profile.channel}
              profile={profile}
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
