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

export default async function ProfitPricingRoute(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const bootstrap = await buildProfitPricingBootstrap({
    productId: parseProductId(readFirstValue(searchParams.productId)),
    channel: readFirstValue(searchParams.channel),
  });

  return <ProfitPricingPage bootstrap={bootstrap} />;
}
