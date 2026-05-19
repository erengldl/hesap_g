import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Sparkles } from "lucide-react";

import { ManualAdReportView } from "@/components/manual-ads/ManualAdReportView";
import { PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { getManualAdCampaignDetail, getLatestManualAdReport } from "@/lib/manual-ads/repository";
import { getAuthenticatedUserFromCookieHeader } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

async function getManualAdReportContext(campaignId: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return null;
  }

  const detail = getManualAdCampaignDetail(user.userId, campaignId);
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    latestReport: detail.latestReport ?? getLatestManualAdReport(campaignId),
  };
}

type ManualAdReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ManualAdReportPage({ params }: ManualAdReportPageProps) {
  const { id } = await params;
  const context = await getManualAdReportContext(id);

  if (!context?.latestReport) {
    notFound();
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Manuel Reklam Danışmanı"
        description="Kısa karar, metrikler ve test planı tek raporda."
      >
        <WarningBadge>API bağlantısı yok</WarningBadge>
        <Link
          href="/reklam-analizi"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Liste
        </Link>
        <Link
          href={`/reklam-analizi/${context.campaign.id}/chat`}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
        >
          <Sparkles className="h-4 w-4" />
          Sohbet
        </Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
          {context.campaign.name}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-1.5 text-xs font-semibold text-soft">
          <Sparkles className="h-3.5 w-3.5" />
          Son analiz
        </span>
      </div>

      <ManualAdReportView campaign={context.campaign} report={context.latestReport} />
    </div>
  );
}
