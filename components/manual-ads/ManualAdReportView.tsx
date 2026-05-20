import type { ElementType, ReactNode } from "react";
import { BarChart3, Lightbulb, ShieldAlert, Sparkles, Target, Wallet } from "lucide-react";

import { GlassCard, MetricBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatDecimal, formatNumber } from "@/lib/formatters";
import { MANUAL_AD_DECISION_LABELS, type ManualAdCampaign, type ManualAdReport } from "@/lib/manual-ads/types";
import { cn } from "@/lib/utils";

import { ManualAdDecisionBadge } from "./ManualAdDecisionBadge";

type ManualAdReportViewProps = {
  campaign: ManualAdCampaign;
  report: ManualAdReport;
  className?: string;
};

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <GlassCard className="border border-border bg-surface-container">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <div className="mt-3 text-sm leading-6 text-soft">{children}</div>
        </div>
      </div>
    </GlassCard>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-container p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Bilgi bulunmuyor.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatMaybeCurrency(value: number | null) {
  return value === null ? "Hesaplanamadı" : formatCurrency(value);
}

function formatMaybeNumber(value: number | null) {
  return value === null ? "Hesaplanamadı" : formatNumber(value);
}

export function ManualAdReportView({ campaign, report, className }: ManualAdReportViewProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <GlassCard className="border border-primary/20 bg-primary/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Kısa karar</p>
              <ManualAdDecisionBadge decision={report.decision} score={report.score} />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">{campaign.name}</h2>
            <p className="max-w-3xl text-sm leading-6 text-soft">{report.summary}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px] lg:grid-cols-2 xl:grid-cols-3">
            <MetricBadge label="Karar" value={MANUAL_AD_DECISION_LABELS[report.decision]} type="info" />
            <MetricBadge label="Skor" value={`${report.score}/100`} type="success" />
            <MetricBadge label="Veri" value={report.metrics.dataQuality.toUpperCase()} type="default" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-border bg-surface-container">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Temel metrikler</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Hesaplanan performans</h3>
          </div>
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile label="Reklam süresi" value={`${formatMaybeNumber(report.metrics.campaignDays)} gün`} />
          <MetricTile label="Günlük harcama" value={formatCurrency(report.metrics.dailySpend)} />
          <MetricTile label="Sipariş başı maliyet" value={report.metrics.costPerOrder === null ? "Hesaplanamadı" : formatCurrency(report.metrics.costPerOrder)} />
          <MetricTile label="ROAS" value={report.metrics.roas === null ? "Hesaplanamadı" : `${formatDecimal(report.metrics.roas, 2, 2)}x`} />
          <MetricTile label="Ciro" value={formatMaybeCurrency(report.metrics.estimatedRevenue)} />
          <MetricTile label="Kâr sonrası" value={report.metrics.estimatedProfitAfterAds === null ? "Hesaplanamadı" : formatCurrency(report.metrics.estimatedProfitAfterAds)} />
          <MetricTile label="Break-even CPA" value={report.metrics.breakEvenCPA === null ? "Hesaplanamadı" : formatCurrency(report.metrics.breakEvenCPA)} />
          <MetricTile label="Veri kalitesi" value={report.metrics.dataQuality.toUpperCase()} />
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Verimlilik değerlendirmesi" icon={Target}>
          <p>{report.analysis.efficiencyAssessment}</p>
          <div className="mt-4 rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Karar gerekçesi</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-soft">{report.analysis.decisionRationale}</p>
          </div>
        </SectionCard>

        <SectionCard title="Kreatif yorumu" icon={Sparkles}>
          <p className="whitespace-pre-line">{report.analysis.creativeCommentary}</p>
        </SectionCard>

        <SectionCard title="Reklam metni yorumu" icon={Lightbulb}>
          <p className="whitespace-pre-line">{report.analysis.copyCommentary}</p>
        </SectionCard>

        <SectionCard title="Hedef kitle yorumu" icon={Target}>
          <p className="whitespace-pre-line">{report.analysis.audienceCommentary}</p>
        </SectionCard>

        <SectionCard title="Bütçe ve ölçekleme yorumu" icon={Wallet}>
          <p className="whitespace-pre-line">{report.analysis.budgetCommentary}</p>
        </SectionCard>

        <SectionCard title="Satış sayfası / ürün yorumu" icon={ShieldAlert}>
          <p className="whitespace-pre-line">{report.analysis.landingPageCommentary}</p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="border border-border bg-surface-container">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">Riskler ve dikkat edilmesi gerekenler</h3>
              <div className="mt-3">{renderList(report.analysis.riskNotes)}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border border-border bg-surface-container">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">Sonraki aksiyonlar</h3>
              <div className="mt-3">{renderList(report.analysis.nextActions)}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="border border-border bg-surface-container">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Yeni test planı</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Bir sonraki deneme neye odaklanmalı?</h3>
          </div>
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Bütçe planı</p>
            <p className="mt-2 text-sm leading-6 text-soft">{report.recommendations.budgetPlan}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Minimum test süresi</p>
            <p className="mt-2 text-sm leading-6 text-soft">{formatNumber(report.recommendations.minimumTestDays)} gün</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Başarı kriteri</p>
            <p className="mt-2 text-sm leading-6 text-soft">{report.recommendations.successCriteria}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Sonraki aksiyonlar</p>
            <div className="mt-2">{renderList(report.recommendations.nextActions)}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Test edilecek 3 kreatif açısı</p>
            <div className="mt-2">{renderList(report.recommendations.creativeAngles)}</div>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Test edilecek 3 reklam metni açısı</p>
            <div className="mt-2">{renderList(report.recommendations.copyAngles)}</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
