import Link from "next/link";
import { Megaphone, Sparkles, TrendingUp, Wallet } from "lucide-react";

import { EmptyState, GlassCard, MetricBadge, PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { formatNumber } from "@/lib/formatters";
import type { ManualAdCampaignSummary } from "@/lib/manual-ads/types";

import { ManualAdCampaignCard } from "./ManualAdCampaignCard";

type ManualAdsPageProps = {
  campaigns: ManualAdCampaignSummary[];
};

export function ManualAdsPage({ campaigns }: ManualAdsPageProps) {
  const latestCampaign = campaigns[0] ?? null;
  const scoredCampaigns = campaigns.filter((campaign) => typeof campaign.latestScore === "number");
  const averageScore =
    scoredCampaigns.length > 0
      ? Math.round(scoredCampaigns.reduce((sum, campaign) => sum + (campaign.latestScore as number), 0) / scoredCampaigns.length)
      : null;

  return (
    <div className="page-shell">
      <PageHeader
        title="Manuel Reklam Danışmanı"
        description="Reklam verini gir, kreatifini anlat, bütçe kararını netleştir."
      >
        <MetricBadge label="Akış" value="Manuel akış" type="success" />
        <MetricBadge label="Kayıt" value={`${formatNumber(campaigns.length)}`} type="info" />
        <WarningBadge>Kampanyalar silinebilir</WarningBadge>
        <WarningBadge>API bağlantısı yok</WarningBadge>
      </PageHeader>

      <GlassCard className="border border-primary/20 bg-primary/[0.04]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Manuel analiz</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Reklam verisi elden girilir, sistem metrikleri hesaplar, yapay zeka yorumlar.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Kampanya kartından doğrudan chat akışına geçip kreatif, metin, hedef kitle, bütçe ve açılış sayfası bağlamını toplarsın.
              Sonrasında kural tabanlı karar motoru ve yapay zeka destekli rapor birlikte çalışır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <MetricBadge label="Yapay Zeka" value="Kural + Gemini" type="info" />
            <MetricBadge label="Son skor" value={averageScore === null ? "Hesaplanamadı" : `${averageScore}/100`} type="success" />
            <WarningBadge>Manuel veri</WarningBadge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Ne yapar?</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-soft">
              Manuel reklam verisini yorumlar, CPA ve kârlılık sinyallerini çıkarır, öneri üretir.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Ne yapmaz?</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-soft">
              Reklam hesabına bağlanmaz, otomatik kampanya çekmez, access token veya worker istemez.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-container p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Ne öne çıkar?</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-soft">
              Karar kartı, test planı ve sonraki aksiyonları ilk bakışta net gösterir.
            </p>
          </div>
        </div>

        {campaigns.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/reklam-analizi/new"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
            >
              <Megaphone className="h-4 w-4" />
              Yeni Kampanya Oluştur
            </Link>
            {latestCampaign ? (
              <Link
                href={`/reklam-analizi/${latestCampaign.id}/chat`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
              >
                <Sparkles className="h-4 w-4" />
                Son analize devam et
              </Link>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <div className="mt-6">
        {campaigns.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={Megaphone}
              title="Henüz manuel analiz yok"
              description="İlk kampanyayı oluşturarak veri girişini ve sohbet akışını başlat."
              action={
                <Link
                  href="/reklam-analizi/new"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
                >
                  <Megaphone className="h-4 w-4" />
                  Yeni Kampanya Oluştur
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <ManualAdCampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
