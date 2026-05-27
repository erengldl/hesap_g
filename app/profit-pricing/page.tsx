import type { SalesChannel } from "@/lib/profit-pricing/types";
import { buildProfitPricingBootstrap } from "@/lib/profit-pricing/server";
import { buildCostBootstrap, recalculateCostResultsForProductFromDatabase } from "@/lib/cost-engine";

import ProfitPricingWorkspace from "@/components/profit-pricing/ProfitPricingWorkspace";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProductId(value: string | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
}

function parseTab(value: string | undefined) {
  return value === "net-cost" ? "net-cost" : "pricing";
}

function resolveChannel(params: SearchParams): SalesChannel | undefined {
  const explicitChannel = readFirstValue(params.channel);
  if (explicitChannel === "trendyol" || explicitChannel === "hepsiburada" || explicitChannel === "website") {
    return explicitChannel;
  }

  const marketplaceId = Number(readFirstValue(params.marketplaceId));
  if (marketplaceId === 1) return "trendyol";
  if (marketplaceId === 2) return "hepsiburada";
  if (marketplaceId === 3) return "website";

  return undefined;
}

async function resolvePricingBootstrap(searchParams: SearchParams) {
  try {
    return {
      bootstrap: await buildProfitPricingBootstrap({
        productId: parseProductId(readFirstValue(searchParams.productId)),
        channel: resolveChannel(searchParams),
      }),
      error: null as string | null,
    };
  } catch (error) {
    console.error("Profit pricing page bootstrap error:", error);
    return {
      bootstrap: null,
      error: "Fiyat optimizasyonu için gerekli veri hazırlanamadı. Veri kaynağına erişim tekrar denenmeli.",
    };
  }
}

async function resolveNetCostBootstrap(searchParams: SearchParams) {
  const productId = parseProductId(readFirstValue(searchParams.productId));

  try {
    const [bootstrap, results] = await Promise.all([
      buildCostBootstrap(productId),
      recalculateCostResultsForProductFromDatabase(productId),
    ]);

    return {
      bootstrap,
      results,
      error: null as string | null,
      selectedProductId: productId ?? bootstrap.selectedProduct?.id,
    };
  } catch (error) {
    console.error("Net cost page bootstrap error:", error);
    return {
      bootstrap: null,
      results: null,
      error: "Net maliyet ekranı hazırlanamadı. Veri kaynağına erişim tekrar denenmeli.",
      selectedProductId: productId,
    };
  }
}

export default async function ProfitPricingRoute(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const activeTab = parseTab(readFirstValue(searchParams.tab));
  const selectedProductId = parseProductId(readFirstValue(searchParams.productId));
  const channel = resolveChannel(searchParams);
  const marketplaceIdValue = Number(readFirstValue(searchParams.marketplaceId));
  const marketplaceId = Number.isFinite(marketplaceIdValue) && marketplaceIdValue > 0 ? marketplaceIdValue : undefined;

  if (activeTab === "net-cost") {
    const { bootstrap, results, error, selectedProductId: resolvedProductId } = await resolveNetCostBootstrap(searchParams);

    return (
      <ProfitPricingWorkspace
        activeTab="net-cost"
        bootstrap={null}
        costBootstrap={bootstrap}
        costResults={results}
        selectedProductId={resolvedProductId}
        channel={channel}
        marketplaceId={marketplaceId}
        error={error}
      />
    );
  }

  const { bootstrap, error } = await resolvePricingBootstrap(searchParams);

  return (
    <ProfitPricingWorkspace
      activeTab="pricing"
      bootstrap={bootstrap}
      costBootstrap={null}
      costResults={null}
      selectedProductId={selectedProductId}
      channel={channel}
      marketplaceId={marketplaceId}
      error={error}
    />
  );
}
