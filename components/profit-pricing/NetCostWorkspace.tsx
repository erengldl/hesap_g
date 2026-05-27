import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Percent,
  ShieldCheck,
  Target,
  Truck,
} from "lucide-react";

import NetCostBarCharts from "@/components/net-cost/NetCostBarCharts";
import NetCostBreakdownTable from "@/components/net-cost/NetCostBreakdownTable";
import NetCostDonutChart from "@/components/net-cost/NetCostDonutChart";
import NetCostKpiCards from "@/components/net-cost/NetCostKpiCards";
import NetCostRecommendationCard from "@/components/net-cost/NetCostRecommendationCard";
import NetCostWaterfallChart from "@/components/net-cost/NetCostWaterfallChart";
import TrafficThresholdCard from "@/components/net-cost/TrafficThresholdCard";
import { EmptyState, EyebrowBadge, GlassCard, PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import type { TrafficThreshold } from "@/lib/cost-engine";
import type { ChannelCostResult } from "@/lib/types";
import type { NetCostBootstrap } from "@/lib/profit-pricing/workspace-types";
import { cn } from "@/lib/utils";

type NetCostWorkspaceProps = {
  bootstrap: NetCostBootstrap | null;
  results: ChannelCostResult[] | null;
  selectedProductId?: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function NetCostWorkspace({
  bootstrap,
  results,
  selectedProductId,
}: NetCostWorkspaceProps) {
  const selectedProduct = bootstrap?.selectedProduct ?? null;
  const productList = bootstrap?.products ?? [];
  const marketplaces = bootstrap?.marketplaces ?? [];
  const computedResults = results ?? [];
  const bestResult = [...computedResults].sort((left, right) => right.net_profit - left.net_profit)[0] ?? null;
  const websiteResult = computedResults.find((item) => item.channel_name === "Kendi Websitem") ?? null;
  const trafficThresholds: TrafficThreshold[] = websiteResult?.gross_net_profit_without_traffic !== undefined
    ? computedResults
        .filter((item) => item.channel_name !== "Kendi Websitem")
        .map((item) => ({
          vsChannel: item.channel_name,
          maxTrafficCost: round2((websiteResult.gross_net_profit_without_traffic ?? 0) - item.net_profit),
        }))
    : [];

  if (!bootstrap || !selectedProduct) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Net Maliyet"
          title="Kanal bazlı net maliyet"
          description="Ürün seçimi ve maliyet verisi hazır olduğunda bu alan üç kanalın gerçek maliyetini gösterir."
        />
        <EmptyState
          icon={Calculator}
          title="Net maliyet verisi hazır değil"
          description="Kâr modülü için önce bir ürün ve hesaplama sonucu gerekir."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/veri-merkezi" className="btn-primary">
                Veri Merkezi
              </Link>
              <Link href="/profit-pricing?tab=pricing" className="btn-secondary">
                Fiyat Optimizasyonu
              </Link>
            </div>
          )}
        />
      </div>
    );
  }

  if (computedResults.length === 0 || !bestResult) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Net Maliyet"
          title="Kanal bazlı net maliyet"
          description="Seçili ürün için maliyet sonuçları henüz üretilemedi."
        />
        <EmptyState
          icon={BarChart3}
          title="Sonuç yok"
          description="Bu ürün için yeniden hesaplama yapılınca grafikler ve tablolar burada görünecek."
          action={(
            <Link href="/profit-pricing?tab=pricing" className="btn-primary">
              Fiyat Optimizasyonuna dön
            </Link>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Net Maliyet"
        title="Kanal bazlı gerçek toplam maliyet"
        description="Bir ürün seç ve Trendyol, Hepsiburada ile kendi sitendeki tüm kesintileri tek bakışta gör."
      >
        <EyebrowBadge variant="primary" className="gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          {computedResults.length} kanal
        </EyebrowBadge>
        <WarningBadge>
          Ürün değiştirince sayfa yeniden hesaplanır
        </WarningBadge>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Tek ürün / üç kanal
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[2rem]">
                Ürün seç, maliyeti gör, karar ver
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-soft">
                Bu ekran, satış fiyatından ürün maliyetine kadar tüm kalemleri toplar ve hangi kanalın gerçekten avantajlı olduğunu netleştirir.
              </p>
            </div>

            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:min-w-[320px]">
              <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Lider kanal</p>
                <p className="mt-1 truncate text-sm font-semibold text-primary">{bestResult.channel_name}</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Sabit gider payı</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(bootstrap.unitFixedCost)}</p>
              </div>
            </div>
          </div>

          <form action="/profit-pricing" method="get" className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <input type="hidden" name="tab" value="net-cost" />
            <label className="space-y-2">
              <span className="ml-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Ürün seç
              </span>
              <select
                name="productId"
                defaultValue={selectedProductId ?? selectedProduct.id}
                className="form-select"
              >
                {productList.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `· ${product.sku}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn-primary self-end justify-center px-5">
              Yeniden hesapla
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Ürün</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedProduct.name}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">SKU</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedProduct.sku || "—"}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Desi</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedProduct.desi} desi</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Ürün + paketleme</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatCurrency(selectedProduct.cost + selectedProduct.packaging_cost)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Nasıl okunur?
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                İlk bakış rehberi
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                label: "1. Kanal kıyasla",
                text: "Tablo ve bar grafik, hangi kanalın en yüksek net kâr verdiğini gösterir.",
              },
              {
                label: "2. Eşiği kontrol et",
                text: "Web sitesi için trafik maliyeti limiti aşılırsa kanal avantajını kaybeder.",
              },
              {
                label: "3. Kararı uygula",
                text: "En iyi kanal kartı, bir sonraki fiyat veya reklam aksiyonunu işaret eder.",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-soft">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Hesaplanan kanallar
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {marketplaces.map((marketplace) => (
                <span
                  key={marketplace.id}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    marketplace.slug === "own_website"
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border/80 bg-background/60 text-muted/70"
                  )}
                >
                  {marketplace.name}
                </span>
              ))}
            </div>
          </div>

          <Link
            href={`/urun/${selectedProduct.id}`}
            className="btn-secondary w-full justify-center"
          >
            Ürün detayına git
            <ArrowRight className="h-4 w-4" />
          </Link>
        </GlassCard>
      </div>

      <NetCostKpiCards result={bestResult} />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Kâr kararı
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                En iyi kanal {bestResult.channel_name}
              </h3>
              <p className="max-w-xl text-sm leading-6 text-soft">
                En yüksek net kârı ve marjı veren kanal, fiyat optimizasyonu için referans noktasıdır.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Calculator className="h-5 w-5" />
            </div>
          </div>

          <NetCostRecommendationCard
            bestChannelName={bestResult.channel_name}
            bestMargin={bestResult.profit_margin_percent}
            results={computedResults}
            trafficThresholds={trafficThresholds}
            currentTrafficCost={websiteResult?.traffic_ad_cost ?? 0}
          />
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Trafik sınırı
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Web sitesi eşiği
              </h3>
              <p className="max-w-xl text-sm leading-6 text-soft">
                Kendi siten için trafik maliyeti sınırı aşıldığında pazaryeri kanalları matematiksel olarak öne geçer.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/20 bg-warning/10 text-warning">
              <Truck className="h-5 w-5" />
            </div>
          </div>

          {trafficThresholds.length > 0 ? (
            <TrafficThresholdCard
              thresholds={trafficThresholds}
              currentTrafficCost={websiteResult?.traffic_ad_cost ?? 0}
              bestChannelName={bestResult.channel_name}
            />
          ) : (
            <div className="rounded-2xl border border-border/80 bg-surface-container p-5">
              <p className="text-sm leading-6 text-soft">
                Bu üründe web sitesi kanalına ait trafik eşiği üretilemedi. Yine de aşağıdaki grafikler ve tablo kanal kârlılığını net biçimde gösterir.
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Maliyet akışı
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Her liranın gittiği yer
              </h3>
              <p className="max-w-xl text-sm leading-6 text-soft">
                Bu waterfall grafik, satış fiyatından net kâra kadar olan kesintileri sırayla gösterir.
              </p>
            </div>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Net görünüm
            </div>
          </div>
          <NetCostWaterfallChart data={bestResult} />
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Kâr kompozisyonu
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Kâr ve maliyet dağılımı
              </h3>
              <p className="max-w-xl text-sm leading-6 text-soft">
                Donut grafik, toplam maliyetin hangi bileşenlerden oluştuğunu hızlıca anlatır.
              </p>
            </div>
            <Percent className="h-5 w-5 text-primary" />
          </div>
          <NetCostDonutChart data={bestResult} />
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Kanal karşılaştırması
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              Kâr tablosu
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-soft">
              Üç kanalın net kâr, toplam maliyet ve marj farklarını aynı tabloda izleyin.
            </p>
          </div>
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <NetCostBarCharts results={computedResults} />
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Kapsamlı döküm
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              Maliyet kırılımı
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-soft">
              Bu tablo, temel maliyetlerden vergilere kadar tüm kalemleri yan yana gösterir.
            </p>
          </div>
        </div>
        <NetCostBreakdownTable results={computedResults} bestChannelName={bestResult.channel_name} />
      </GlassCard>
    </div>
  );
}
