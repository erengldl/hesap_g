"use client";

import Link from "next/link";
import { Clock3, History, ArrowUpRight, Repeat2 } from "lucide-react";
import { EmptyState, ErrorStateCard, GlassCard, SkeletonCard } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { PriceOptimizationRunSummary } from "@/lib/price-optimization-types";

interface OptimizationRunHistoryProps {
  runs: PriceOptimizationRunSummary[];
  loading?: boolean;
  error?: string | null;
}

function confidenceStyles(confidence: PriceOptimizationRunSummary["confidence_score"]) {
  switch (confidence) {
    case "High":
      return "border-primary/20 bg-primary/10 text-primary";
    case "Medium":
      return "border-warning/20 bg-warning/10 text-warning";
    default:
      return "border-danger/20 bg-danger/10 text-danger";
  }
}

function statusStyles(status: PriceOptimizationRunSummary["status"]) {
  switch (status) {
    case "PUBLISHED":
      return "border-primary/20 bg-primary/10 text-primary";
    default:
      return "border-warning/20 bg-warning/10 text-warning";
  }
}

export default function OptimizationRunHistory({ runs, loading = false, error = null }: OptimizationRunHistoryProps) {
  return (
    <GlassCard className="border-border bg-surface-container">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            <History className="w-3.5 h-3.5" />
            Hesap Geçmişi
          </div>
          <h3 className="text-base font-bold text-foreground">Son hesaplamalar</h3>
          <p className="text-[11px] text-muted">
            Kaydedilen sonuçlar ve hızlı geri dönüş
          </p>
        </div>

        <Link
          href="/optimization"
          className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary transition-colors duration-200 hover:bg-primary/15"
        >
          <Repeat2 className="w-3.5 h-3.5" />
          Yeni Hesaplama
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} variant="card" height={72} delayIndex={index} className="w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorStateCard
          title="Geçmiş yüklenemedi"
          description={error}
          action={
            <Link
              href="/optimization"
              className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
            >
              <Repeat2 className="h-4 w-4" />
              Tekrar dene
            </Link>
          }
        />
      ) : runs.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={Clock3}
          title="Henüz kaydedilmiş fiyat kararı yok"
          description="İlk hesaplamadan sonra sonuçlar burada görünür. Kayıtlı geçmişi görmek için yeni bir fiyat kararı oluşturun."
          className="mx-auto max-w-md py-4"
          action={
            <Link
              href="/veri-merkezi"
              className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
            >
              <ArrowUpRight className="h-4 w-4" />
              Veri Merkezini Aç
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.run_id}
              className="rounded-md border border-border bg-surface-container px-3 py-3 transition-colors duration-200 hover:border-primary/20"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground">{run.product_name}</span>
                    <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      {run.marketplace_name}
                    </span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]", statusStyles(run.status))}>
                      {run.status === "PUBLISHED" ? "UYGULANDI" : "TASLAK"}
                    </span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]", confidenceStyles(run.confidence_score))}>
                      {run.confidence_score}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                    <span>
                      {formatCurrency(run.current_price)}
                      {" -> "}
                      {formatCurrency(run.recommended_price)}
                    </span>
                    <span>|</span>
                    <span className={run.profit_change_percent !== null && run.profit_change_percent >= 0 ? "text-primary" : "text-danger"}>
                      {run.profit_change_percent !== null ? formatPercent(run.profit_change_percent) : "0%"} net kâr farkı
                    </span>
                    <span>|</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {run.status === "PUBLISHED" && run.published_at
                        ? `Uygulandı ${new Date(run.published_at).toLocaleString("tr-TR")}`
                        : `Kaydedildi ${new Date(run.created_at).toLocaleString("tr-TR")}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-md border border-border bg-surface-container px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Mevcut Kâr</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{formatCurrency(run.expected_profit_current)}</p>
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/70">Önerilen Kâr</p>
                    <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(run.expected_profit_recommended)}</p>
                  </div>
                  <ArrowUpRight className="hidden h-5 w-5 text-primary lg:block" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
