import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Sparkles } from "lucide-react";

import { ManualAdChat } from "@/components/manual-ads/ManualAdChat";
import { PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { getManualAdCampaignDetail } from "@/lib/manual-ads/repository";
import { isManualAdReadyForReport } from "@/lib/manual-ads/conversation";
import { getAuthenticatedUserFromCookieHeader } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

async function getManualAdChatContext(campaignId: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return null;
  }

  return getManualAdCampaignDetail(user.userId, campaignId);
}

type ManualAdChatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ManualAdChatPage({ params }: ManualAdChatPageProps) {
  const { id } = await params;
  const context = await getManualAdChatContext(id);

  if (!context) {
    notFound();
  }

  const readyToReport = Boolean(context.latestReport) || isManualAdReadyForReport(context.conversationState);

  return (
    <div className="page-shell flex min-h-[calc(100dvh-52px)] flex-col overflow-y-auto xl:h-[calc(100dvh-52px)] xl:overflow-hidden">
      <PageHeader
        title="Manuel Reklam Danışmanı"
        description="Chatbot kreatif, metin, hedef kitle, bütçe ve satış sayfası bağlamını sırayla toplar."
      >
        <WarningBadge>API bağlantısı yok</WarningBadge>
        <Link
          href="/reklam-analizi"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Liste
        </Link>
        {context.latestReport ? (
          <Link
            href={`/reklam-analizi/${context.campaign.id}/report`}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
          >
            <BarChart3 className="h-4 w-4" />
            Rapor
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-soft opacity-80">
            <BarChart3 className="h-4 w-4" />
            Rapor henüz yok
          </span>
        )}
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {context.campaign.name}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-1.5 text-xs font-semibold text-soft">
          <BarChart3 className="h-3.5 w-3.5" />
          {readyToReport ? "Rapor üretilebilir" : "Bağlam toplanıyor"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ManualAdChat
          campaign={context.campaign}
          messages={context.messages}
          conversationState={context.conversationState}
          readyToReport={readyToReport}
          latestReport={context.latestReport}
        />
      </div>
    </div>
  );
}
