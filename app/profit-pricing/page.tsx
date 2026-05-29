import ProfitPricingErrorState from "@/components/profit-pricing/ProfitPricingErrorState";
import ProfitPricingPage from "@/components/profit-pricing/ProfitPricingPage";
import { buildProfitPricingBootstrap } from "@/lib/profit-pricing/server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProductId(value: string | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
}

async function resolveProfitPricingBootstrap(searchParams: SearchParams) {
  const productId = parseProductId(readFirstValue(searchParams.productId));
  const channel = readFirstValue(searchParams.channel);

  try {
    const bootstrap = await buildProfitPricingBootstrap({
      productId,
      channel,
    });

    return {
      bootstrap,
      error: null as string | null,
    };
  } catch (error) {
    console.error("Profit pricing page bootstrap error:", error);
    return {
      bootstrap: null,
      error: "Fiyat optimizasyonu ekranı hazırlanamadı. Veri kaynağına erişim tekrar denenmeli.",
    };
  }
}

export default async function ProfitPricingRoute(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { bootstrap, error } = await resolveProfitPricingBootstrap(searchParams);

  if (!bootstrap) {
    return (
      <div className="page-shell">
        <ProfitPricingErrorState message={error ?? "Fiyat optimizasyonu verisi yüklenemedi."} />
      </div>
    );
  }

  return <ProfitPricingPage bootstrap={bootstrap} />;
}
