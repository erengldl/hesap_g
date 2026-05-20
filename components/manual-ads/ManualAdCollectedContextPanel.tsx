import { CheckCircle2, ClipboardList, Gauge, MessageSquareText, TriangleAlert } from "lucide-react";

import { GlassCard, MetricBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  MANUAL_AD_CREATIVE_FORMAT_LABELS,
  type ManualAdCampaign,
  type ManualAdConversationState,
  type ManualAdMetrics,
  type ManualAdReport,
} from "@/lib/manual-ads/types";
import { MANUAL_AD_PROMPT_GROUP_LABELS } from "@/lib/manual-ads/prompts";
import { cn } from "@/lib/utils";

import { ManualAdDecisionBadge } from "./ManualAdDecisionBadge";

type ManualAdCollectedContextPanelProps = {
  campaign: ManualAdCampaign;
  conversationState: ManualAdConversationState;
  metrics: ManualAdMetrics;
  readyToReport: boolean;
  latestReport?: ManualAdReport | null;
  className?: string;
};

function renderValue(value?: string | number | null) {
  if (value === null || value === undefined || `${value}`.trim().length === 0) {
    return "Bilgi yok";
  }
  return String(value);
}

function Section({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-container p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-soft">{renderValue(value)}</p>
    </div>
  );
}

export function ManualAdCollectedContextPanel({
  campaign,
  conversationState,
  metrics,
  readyToReport,
  latestReport,
  className,
}: ManualAdCollectedContextPanelProps) {
  const creativeFormatLabel =
    conversationState.creativeFormat && conversationState.creativeFormat in MANUAL_AD_CREATIVE_FORMAT_LABELS
      ? MANUAL_AD_CREATIVE_FORMAT_LABELS[conversationState.creativeFormat]
      : null;

  return (
    <GlassCard className={cn("border border-border bg-surface-container", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Toplanan bağlam</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">Sohbetten gelen bilgiler</h3>
        </div>
        <ClipboardList className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MetricBadge label="Gün" value={`${formatNumber(metrics.campaignDays)}`} type="info" />
        <MetricBadge label="Günlük" value={formatCurrency(metrics.dailySpend)} type="default" />
        <MetricBadge label="CPA" value={metrics.costPerOrder === null ? "Hesaplanamadı" : formatCurrency(metrics.costPerOrder)} type="success" />
        <MetricBadge label="Veri" value={metrics.dataQuality.toUpperCase()} type={metrics.dataQuality === "high" ? "success" : metrics.dataQuality === "medium" ? "warning" : "error"} />
      </div>

      {latestReport ? (
        <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Son rapor</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{latestReport.summary}</p>
            </div>
            <ManualAdDecisionBadge decision={latestReport.decision} score={latestReport.score} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Section
          title={MANUAL_AD_PROMPT_GROUP_LABELS.creative}
          value={conversationState.creativeDescription || creativeFormatLabel || null}
        />
        <Section title={MANUAL_AD_PROMPT_GROUP_LABELS.copy} value={[conversationState.adHeadline, conversationState.adCopy, conversationState.callToAction, conversationState.offer].filter(Boolean).join("\n\n") || null} />
        <Section title={MANUAL_AD_PROMPT_GROUP_LABELS.audience} value={[conversationState.targetAudience, conversationState.audienceTemperature].filter(Boolean).join("\n") || null} />
        <Section
          title={MANUAL_AD_PROMPT_GROUP_LABELS.budget}
          value={[
            typeof conversationState.dailyBudget === "number" ? `${formatCurrency(conversationState.dailyBudget)}/gün` : null,
            typeof conversationState.testDurationDays === "number" ? `${conversationState.testDurationDays} gün test` : null,
            conversationState.scalingMethod,
          ]
            .filter(Boolean)
            .join("\n") || null}
        />
        <Section
          title={MANUAL_AD_PROMPT_GROUP_LABELS.landing}
          value={[
            campaign.productName,
            typeof campaign.productSalePrice === "number" ? `Fiyat: ${formatCurrency(campaign.productSalePrice)}` : null,
            typeof campaign.estimatedProductProfit === "number" ? `Net kâr: ${formatCurrency(campaign.estimatedProductProfit)}` : null,
            conversationState.landingPageNotes,
          ]
            .filter(Boolean)
            .join("\n") || null}
        />
        <Section title="Kampanya notları" value={campaign.notes || null} />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface-container p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Eksik alanlar</p>
          </div>
          {readyToReport ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Rapor oluşturulabilir
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">
              <TriangleAlert className="h-3.5 w-3.5" />
              Bağlam toplanıyor
            </span>
          )}
        </div>

        {conversationState.missingFields.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {conversationState.missingFields.slice(0, 10).map((field) => (
              <span
                key={field}
                className="rounded-full border border-border bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-soft"
              >
                {field}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Eksik alan yok. Raporu oluşturabilirsin.</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Gauge className="h-4 w-4 text-primary" />
        <span>Bu panel yalnızca manuel veri ve sohbetten gelen bağlamı gösterir.</span>
      </div>
    </GlassCard>
  );
}
