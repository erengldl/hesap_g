import type { SalesChannel } from "@/lib/profit-pricing/types";
import { buildProfitPricingBootstrap } from "@/lib/profit-pricing/server";

import ProfitPricingPage from "@/components/profit-pricing/ProfitPricingPage";
import ProfitPricingErrorState from "@/components/profit-pricing/ProfitPricingErrorState";
import { PageHeader } from "@/components/ui-custom/GlassComponents";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProductId(value: string | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
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

async function resolveBootstrap(searchParams: SearchParams) {
  try {
    return {
      bootstrap: await buildProfitPricingBootstrap({
        productId: parseProductId(readFirstValue(searchParams.productId)),
        channel: resolveChannel(searchParams),
      }),
      error: null,
    };
  } catch (error) {
    console.error("Profit pricing page bootstrap error:", error);
    return {
      bootstrap: null,
      error: "Kârlılık ekranı hazırlanamadı. Veri kaynağına erişim tekrar denenmeli.",
    };
  }
}

export default async function ProfitPricingRoute(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { bootstrap, error } = await resolveBootstrap(searchParams);

  if (bootstrap) {
    return <ProfitPricingPage bootstrap={bootstrap} />;
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Karar ekranı"
        title="Kârlılık ve Fiyat Optimizasyonu"
        description="Ürünün gerçek maliyetini hesapla, kârlı fiyat aralığını aynı ekranda gör."
      />
      <ProfitPricingErrorState
        message={error ?? "Kârlılık ekranı hazırlanamadı. Veri kaynağına erişim tekrar denenmeli."}
      />
    </div>
  );
}
