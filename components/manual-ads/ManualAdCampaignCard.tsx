"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, Coins, Loader2, MessageSquareText, ShoppingCart, Sparkles, Trash2 } from "lucide-react";

import { GlassCard, MetricBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import {
  MANUAL_AD_PLATFORM_LABELS,
  type ManualAdCampaignSummary,
} from "@/lib/manual-ads/types";
import { cn } from "@/lib/utils";

import { ManualAdDecisionBadge } from "./ManualAdDecisionBadge";

type ManualAdCampaignCardProps = {
  campaign: ManualAdCampaignSummary;
  className?: string;
};

function formatDateRange(startDate: string, endDate: string) {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatNullableCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "Hesaplanamadı";
}

export function ManualAdCampaignCard({ campaign, className }: ManualAdCampaignCardProps) {
  const router = useRouter();
  const reportHref = campaign.latestReportId ? `/reklam-analizi/${campaign.id}/report` : `/reklam-analizi/${campaign.id}/chat`;
  const chatHref = `/reklam-analizi/${campaign.id}/chat`;
  const costPerOrder = campaign.ordersFromAds > 0 ? campaign.totalSpend / campaign.ordersFromAds : null;
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `"${campaign.name}" kampanyasını silmek istiyor musun? Bu işlem geri alınamaz.`
    );
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/manual-ads/${campaign.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Kampanya silinemedi.");
      }

      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Kampanya silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <GlassCard className={cn("border border-border bg-surface-container transition-colors duration-200 hover:border-primary/20 hover:bg-surface-container", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                {MANUAL_AD_PLATFORM_LABELS[campaign.platform]}
              </p>
              <MetricBadge label="Mesaj" value={`${formatNumber(campaign.messageCount)}`} type="default" />
              <MetricBadge label="Rapor" value={`${formatNumber(campaign.reportCount)}`} type="info" />
            </div>
            <h3 className="truncate text-lg font-semibold text-foreground">{campaign.name}</h3>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-container px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                {formatDateRange(campaign.startDate, campaign.endDate)}
              </span>
              {campaign.productName ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-container px-2.5 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Ürün: {campaign.productName}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-container px-2.5 py-1">
                <Coins className="h-3.5 w-3.5 text-primary" />
                Harcama: {formatCurrency(campaign.totalSpend)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-container px-2.5 py-1">
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                Sipariş: {formatNumber(campaign.ordersFromAds)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
            <ManualAdDecisionBadge decision={campaign.latestDecision} score={campaign.latestScore} />
            <p className="text-xs text-muted">
              Sipariş başı maliyet: <span className="font-semibold text-foreground">{formatNullableCurrency(costPerOrder)}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Toplam harcama</p>
            <p className="mt-2 text-base font-semibold text-foreground">{formatCurrency(campaign.totalSpend)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Sipariş</p>
            <p className="mt-2 text-base font-semibold text-foreground">{formatNumber(campaign.ordersFromAds)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">CPA</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {formatNullableCurrency(costPerOrder)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Skor</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {typeof campaign.latestScore === "number" ? `${Math.round(campaign.latestScore)}/100` : "Bekleniyor"}
            </p>
          </div>
        </div>

        {campaign.latestSummary ? (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Yapay zeka özeti</p>
            <p className="mt-2 text-sm leading-6 text-soft">{campaign.latestSummary}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface-container p-4 text-sm text-muted">
            Bu kampanya için henüz analiz raporu oluşturulmadı. Sohbeti tamamlayıp ilk raporu üret.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            href={chatHref}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
          >
            <MessageSquareText className="h-4 w-4" />
            Sohbete git
          </Link>
          <Link
            href={reportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
          >
            <ArrowUpRight className="h-4 w-4" />
            {campaign.latestReportId ? "Raporu görüntüle" : "Sohbette devam et"}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="action-inline-button-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Sil
          </button>
        </div>
        {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}
      </div>
    </GlassCard>
  );
}
