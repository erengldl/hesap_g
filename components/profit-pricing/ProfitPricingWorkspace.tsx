import Link from "next/link";
import { ArrowRightLeft, Calculator, CircleDot, ListChecks, Sparkles } from "lucide-react";
import type { ElementType } from "react";

import ProfitPricingErrorState from "@/components/profit-pricing/ProfitPricingErrorState";
import ProfitPricingPage from "@/components/profit-pricing/ProfitPricingPage";
import NetCostWorkspace from "@/components/profit-pricing/NetCostWorkspace";
import { GlassCard, PageHeader, EyebrowBadge, WarningBadge } from "@/components/ui-custom/GlassComponents";
import type { ChannelCostResult } from "@/lib/types";
import type { ProfitPricingBootstrap } from "@/lib/profit-pricing/types";
import type { NetCostBootstrap, ProfitPricingTab } from "@/lib/profit-pricing/workspace-types";
import type { SalesChannel } from "@/lib/profit-pricing/types";
import { cn } from "@/lib/utils";

type ProfitPricingWorkspaceProps = {
  activeTab: ProfitPricingTab;
  bootstrap: ProfitPricingBootstrap | null;
  costBootstrap: NetCostBootstrap | null;
  costResults: ChannelCostResult[] | null;
  selectedProductId?: number;
  channel?: SalesChannel;
  marketplaceId?: number;
  error?: string | null;
};

function buildTabHref(params: {
  tab: ProfitPricingTab;
  productId?: number;
  channel?: SalesChannel;
  marketplaceId?: number;
}) {
  const search = new URLSearchParams();
  search.set("tab", params.tab);

  if (params.productId) {
    search.set("productId", String(params.productId));
  }

  if (params.tab === "pricing") {
    if (params.channel) {
      search.set("channel", params.channel);
    }
    if (params.marketplaceId) {
      search.set("marketplaceId", String(params.marketplaceId));
    }
  }

  const query = search.toString();
  return `/profit-pricing${query ? `?${query}` : ""}`;
}

function TabButton({
  href,
  active,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  active: boolean;
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
        active
          ? "border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-primary)]"
          : "border-border/80 bg-surface-container text-muted hover:border-primary/20 hover:bg-surface-soft hover:text-foreground"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200",
          active
            ? "border-primary/20 bg-primary text-primary-foreground"
            : "border-border/80 bg-background/70 text-muted group-hover:text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</p>
          {active && (
            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
              Aktif
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-5 text-soft">{description}</p>
      </div>
    </Link>
  );
}

export default function ProfitPricingWorkspace({
  activeTab,
  bootstrap,
  costBootstrap,
  costResults,
  selectedProductId,
  channel,
  marketplaceId,
  error,
}: ProfitPricingWorkspaceProps) {
  const fallbackProductId = Number(bootstrap?.initialInput.productId ?? 0);
  const resolvedProductId =
    selectedProductId ??
    costBootstrap?.selectedProduct?.id ??
    (Number.isFinite(fallbackProductId) && fallbackProductId > 0 ? fallbackProductId : undefined);

  const pricingHref = buildTabHref({
    tab: "pricing",
    productId: resolvedProductId,
    channel,
    marketplaceId,
  });
  const netCostHref = buildTabHref({
    tab: "net-cost",
    productId: resolvedProductId,
  });

  return (
    <div className="page-shell space-y-5">
      <PageHeader
        eyebrow="Kârlılık"
        title="Kârlılık çalışma alanı"
        description="Fiyat Optimizasyonu ile en kârlı fiyat aralığını gör, Net Maliyet ile aynı ürünün tüm kesintilerini tek tabloda incele."
      >
        <EyebrowBadge variant="primary" className="gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          {activeTab === "pricing" ? "Fiyat Optimizasyonu" : "Net Maliyet"}
        </EyebrowBadge>
        <WarningBadge>
          Tek ürün, tek karar akışı
        </WarningBadge>
      </PageHeader>

      <GlassCard className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/60">
              Sekmeli karar alanı
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[2rem]">
              Önce fiyatı optimize et, sonra net maliyeti doğrula
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-soft">
              Bu ekran iki sekmeye ayrılır. İlk sekme fiyatı ve marjı optimize eder, ikinci sekme aynı ürünün kanal bazlı gerçek maliyetini gösterir.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[460px]">
            <TabButton
              href={pricingHref}
              active={activeTab === "pricing"}
              icon={Sparkles}
              title="Fiyat Optimizasyonu"
              description="En kârlı fiyat aralığı, kanal kararları ve optimizasyon önerileri."
            />
            <TabButton
              href={netCostHref}
              active={activeTab === "net-cost"}
              icon={Calculator}
              title="Net Maliyet"
              description="Trendyol, Hepsiburada ve kendi siten için gerçek toplam maliyet."
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: CircleDot,
              title: "1. Ürün seç",
              text: "Doğru ürün ve kanal seçimi, karar kalitesini doğrudan yükseltir.",
            },
            {
              icon: ListChecks,
              title: "2. Sonucu oku",
              text: "Grafik ve tablo başlıkları, verinin ne anlattığını açıkça söyler.",
            },
            {
              icon: ArrowRightLeft,
              title: "3. Aksiyonu uygula",
              text: "En iyi kanal veya fiyat aralığına göre bir sonraki adımı al.",
            },
          ].map((step) => (
            <div key={step.title} className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold tracking-tight text-foreground">{step.title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-soft">{step.text}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {error ? (
        <GlassCard className="border-warning/20 bg-warning/10">
          <p className="text-sm font-semibold text-warning">Uyarı</p>
          <p className="mt-2 text-sm leading-6 text-soft">{error}</p>
        </GlassCard>
      ) : null}

      {activeTab === "pricing" ? (
        bootstrap ? (
          <ProfitPricingPage bootstrap={bootstrap} />
        ) : (
          <ProfitPricingErrorState message="Fiyat optimizasyonu için gerekli veri bulunamadı." />
        )
      ) : (
        <NetCostWorkspace
          bootstrap={costBootstrap}
          results={costResults}
          selectedProductId={resolvedProductId}
        />
      )}
    </div>
  );
}
