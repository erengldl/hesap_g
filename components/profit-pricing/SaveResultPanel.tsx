"use client";

import { Clock3, Save, ShieldCheck } from "lucide-react";

import { EmptyState, GlassCard } from "@/components/ui-custom/GlassComponents";
import { formatProfitPricingCurrency } from "@/lib/profit-pricing/formatters";
import type { ProfitPricingResult } from "@/lib/profit-pricing/types";
import { channelLabel, decisionLabel } from "@/lib/profit-pricing/utils";

type RecentRun = {
  runId: string;
  productId: string;
  productName: string;
  channel: string;
  decision: string;
  dataQuality: string;
  recommendedPreferred: number | null;
  createdAt: string;
  appliedAt: string | null;
};

export default function SaveResultPanel(props: {
  result: ProfitPricingResult;
  selectedPrice: number | null;
  note: string;
  recentRuns: RecentRun[];
  saveState: "idle" | "saving" | "saved" | "error";
  applyState: "idle" | "confirm" | "applying" | "applied" | "error";
  message: string | null;
  error: string | null;
  onNoteChange: (note: string) => void;
  onSave: () => void;
  onStartApply: () => void;
  onCancelApply: () => void;
  onConfirmApply: () => void;
}) {
  const targetPrice = props.selectedPrice ?? props.result.recommendedPriceRange?.preferred ?? null;

  return (
    <GlassCard className="border-border/80">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Kaydet ve uygula</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">Analizi sakla, fiyatı ayrı onayla</h3>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface-container/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{decisionLabel(props.result.decision)}</p>
              <p className="mt-1 text-xs text-soft">{channelLabel(props.result.input.channel)} · {props.result.input.productName ?? "Ürün"}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">Seçili fiyat</p>
              <p className="mt-2 text-lg font-semibold text-primary">{formatProfitPricingCurrency(targetPrice)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={props.onSave} className="btn-secondary h-11 px-4" disabled={props.saveState === "saving"}>
            <Save className="h-4 w-4" />
            {props.saveState === "saving" ? "Sonuç kaydediliyor..." : "Sonucu Kaydet"}
          </button>
          <button type="button" onClick={props.onStartApply} className="btn-primary h-11 px-4" disabled={targetPrice === null || props.applyState === "applying"}>
            <ShieldCheck className="h-4 w-4" />
            {props.applyState === "applying" ? "Uygulanıyor..." : "Ürün Fiyatına Uygula"}
          </button>
        </div>

        <label className="space-y-2">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
            Kullanıcı notu
          </span>
          <textarea
            aria-label="Kullanıcı notu"
            value={props.note}
            onChange={(event) => props.onNoteChange(event.target.value)}
            rows={3}
            placeholder="Bu analize kısa bir not ekleyin..."
            className="form-input min-h-[96px] resize-y"
          />
        </label>

        {props.applyState === "confirm" && targetPrice !== null && (
          <div className="rounded-2xl border border-warning/20 bg-warning/8 p-4">
            <p className="text-sm font-semibold text-foreground">Bu fiyat ürün ayarına uygulanacak.</p>
            <p className="mt-2 text-sm text-soft">Eski fiyat sistemdeki kanal fiyatından okunur. Yeni fiyat: {formatProfitPricingCurrency(targetPrice)}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={props.onConfirmApply} className="btn-primary h-10 px-4">
                Onayla ve uygula
              </button>
              <button type="button" onClick={props.onCancelApply} className="btn-secondary h-10 px-4">
                Vazgeç
              </button>
            </div>
          </div>
        )}

        {props.message && <p className="text-sm text-success">{props.message}</p>}
        {props.error && <p className="text-sm text-danger">{props.error}</p>}

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Son analizler</p>
          </div>
          <div className="space-y-2">
            {props.recentRuns.length > 0 ? (
              props.recentRuns.map((run) => (
                <div key={run.runId} className="rounded-2xl border border-border/70 bg-surface-container px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{run.productName}</p>
                      <p className="mt-1 text-xs text-soft">{channelLabel(run.channel as ProfitPricingResult["input"]["channel"])} · {decisionLabel(run.decision as ProfitPricingResult["decision"])}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">{formatProfitPricingCurrency(run.recommendedPreferred)}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                variant="inline"
                icon={Clock3}
                title="Henüz kayıtlı analiz yok"
                description="İlk sonucu kaydedin, analiz geçmişiniz burada görünsün."
                className="mx-auto max-w-md py-4"
                action={
                  <button type="button" onClick={props.onSave} className="btn-primary h-10 px-4">
                    <Save className="h-4 w-4" />
                    Sonucu Kaydet
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
